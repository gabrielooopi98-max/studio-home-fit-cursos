// Edge Function: recebe os avisos do Mercado Pago e atualiza o pedido (libera ou remove o acesso).
// Nunca confia no conteúdo do aviso: busca o pagamento direto na API do Mercado Pago com a nossa credencial.
// Secrets: MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET (assinatura secreta do webhook, recomendada).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isUuid, readNotification, verifySignature } from '../_compartilhado/mercadopago.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const MP_SECRET = Deno.env.get('MP_WEBHOOK_SECRET') ?? ''

const reply = (text: string, status = 200) => new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

Deno.serve(async (req) => {
  // o Mercado Pago só envia POST; qualquer outra coisa recebe 200 e é ignorada
  if (req.method !== 'POST') return reply('ok')

  const url = new URL(req.url)
  let body: Record<string, unknown> = {}
  try {
    const raw = await req.text()
    body = raw ? JSON.parse(raw) : {}
  } catch {
    body = {}
  }

  const { type, dataId } = readNotification(url, body)
  if (type !== 'payment' || !/^\d{1,20}$/.test(dataId)) return reply('ignorado')

  if (MP_SECRET) {
    const valid = await verifySignature({
      secret: MP_SECRET,
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId: url.searchParams.get('data.id') ?? dataId,
    })
    if (!valid) return reply('assinatura inválida', 401)
  }

  if (!MP_TOKEN) return reply('pagamento não configurado', 503)

  // busca o pagamento real no Mercado Pago
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  })
  if (res.status === 404) return reply('pagamento não encontrado')
  if (!res.ok) return reply('erro ao consultar o Mercado Pago', 502) // o Mercado Pago tenta de novo
  const payment = await res.json()

  const orderId = payment.external_reference
  if (!isUuid(orderId)) return reply('pedido de fora do site')

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: status, error } = await admin.rpc('apply_payment', {
    p_order_id: orderId,
    p_payment_id: String(payment.id),
    p_status: String(payment.status),
    p_amount: Number(payment.transaction_amount),
    p_method: payment.payment_type_id ?? payment.payment_method_id ?? null,
  })

  if (error) {
    console.error('apply_payment falhou', orderId, payment.id, error.message)
    // erro de regra (pedido inexistente, valor diferente): não adianta repetir; outros erros: o Mercado Pago tenta de novo
    const permanent = /não encontrado|diferente/i.test(error.message)
    return reply(permanent ? 'recusado' : 'erro', permanent ? 200 : 500)
  }
  return reply(`pedido ${orderId}: ${status}`)
})
