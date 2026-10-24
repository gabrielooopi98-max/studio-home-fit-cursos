// Edge Function: cria o pedido (preço calculado no banco) e a página de pagamento do Mercado Pago.
// Secrets necessários: MP_ACCESS_TOKEN e SITE_URL. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontos.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_compartilhado/http.ts'
import { buildPreference, validateCheckoutBody } from '../_compartilhado/mercadopago.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '')

Deno.serve(async (req) => {
  const cors = corsHeaders(req, SITE_URL)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, cors)

  if (!MP_TOKEN || !/^https?:\/\//.test(SITE_URL)) {
    return json({ error: 'O pagamento ainda não foi configurado. Fale com o Studio HomeFit pelo WhatsApp.' }, 503, cors)
  }

  // quem está comprando (login obrigatório e e-mail confirmado)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Faça login para continuar.' }, 401, cors)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth?.user) return json({ error: 'Sua sessão expirou. Entre de novo.' }, 401, cors)
  const user = auth.user
  if (!user.email_confirmed_at) return json({ error: 'Confirme seu e-mail antes de comprar.' }, 403, cors)

  let body
  try {
    body = validateCheckoutBody(await req.json())
  } catch (e) {
    return json({ error: (e as Error).message }, 400, cors)
  }

  // freio contra abuso: no máximo 10 pedidos pendentes em 10 minutos por conta
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .gte('created_at', since)
  if ((count ?? 0) >= 10) return json({ error: 'Muitas tentativas de compra seguidas. Aguarde alguns minutos.' }, 429, cors)

  const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).single()
  const payerName = body.payer.name || profile?.full_name || ''

  const { data: order, error: orderError } = await admin.rpc('create_order', {
    p_user_id: user.id,
    p_course_ids: body.combo ? null : body.courseIds,
    p_combo: body.combo,
    p_coupon: body.coupon,
    p_provider: 'mercadopago',
    p_payer_name: payerName,
    p_payer_email: user.email ?? '',
  })
  if (orderError || !order) return json({ error: orderError?.message ?? 'Não foi possível criar o pedido.' }, 400, cors)

  // cupom de 100%: não há o que cobrar, libera na hora
  if (Number(order.total) <= 0) {
    const { error } = await admin.rpc('apply_payment', {
      p_order_id: order.id,
      p_payment_id: `gratis-${order.id}`,
      p_status: 'approved',
      p_amount: 0,
      p_method: 'cupom',
    })
    if (error) return json({ error: 'Não foi possível liberar o pedido.' }, 500, cors)
    return json({ free: true, orderId: order.id }, 200, cors)
  }

  const { data: settings } = await admin.from('settings').select('combo_installments').eq('id', 1).single()
  const preference = buildPreference({
    order,
    siteUrl: SITE_URL,
    notificationUrl: `${SUPABASE_URL}/functions/v1/webhook-mercadopago`,
    payer: { name: payerName, email: user.email ?? '', phone: body.payer.phone, cpf: body.payer.cpf },
    installments: settings?.combo_installments ?? 12,
  })

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': order.id,
    },
    body: JSON.stringify(preference),
  })
  const pref = await res.json().catch(() => ({}))

  if (!res.ok || !(pref.init_point || pref.sandbox_init_point)) {
    console.error('Mercado Pago recusou a preferência', res.status, JSON.stringify(pref))
    await admin.rpc('apply_payment', { p_order_id: order.id, p_payment_id: '', p_status: 'cancelled', p_amount: 0, p_method: null })
    return json({ error: 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.' }, 502, cors)
  }

  // credencial de teste abre o ambiente de testes do Mercado Pago
  const url = MP_TOKEN.startsWith('TEST-') ? pref.sandbox_init_point ?? pref.init_point : pref.init_point
  return json({ url, orderId: order.id }, 200, cors)
})
