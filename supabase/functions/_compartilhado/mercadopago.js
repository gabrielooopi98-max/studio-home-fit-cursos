// Regras do Mercado Pago usadas pelas Edge Functions (sem dependências: roda no Deno e nos testes em Node).
import { safeEqual } from './http.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v)

// id de pagamento do Mercado Pago: só números
export const isPaymentId = (v) => typeof v === 'string' && /^\d{1,20}$/.test(v)

const digits = (v) => String(v ?? '').replace(/\D/g, '')

// Valida o que vem do navegador. Preço, dono do pedido e status NÃO vêm daqui:
// o preço é calculado no banco (create_order) e o dono é quem está logado.
export function validateCheckoutBody(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Pedido inválido.')
  const combo = raw.combo === true
  const courseIds = Array.isArray(raw.courseIds) ? [...new Set(raw.courseIds)] : []
  if (!combo) {
    if (!courseIds.length) throw new Error('Carrinho vazio.')
    if (courseIds.length > 50 || !courseIds.every(isUuid)) throw new Error('Cursos inválidos no carrinho.')
  }
  const coupon = typeof raw.coupon === 'string' && raw.coupon.trim() ? raw.coupon.trim().toUpperCase() : null
  if (coupon && !/^[A-Z0-9_-]{3,30}$/.test(coupon)) throw new Error('Cupom inválido.')
  const p = raw.payer && typeof raw.payer === 'object' ? raw.payer : {}
  const name = String(p.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const phone = digits(p.phone).slice(0, 11)
  const cpf = digits(p.cpf)
  return {
    courseIds: combo ? [] : courseIds.map((id) => id.toLowerCase()),
    combo,
    coupon,
    payer: { name, phone: phone.length >= 10 ? phone : '', cpf: cpf.length === 11 ? cpf : '' },
  }
}

/*
  Preferência do Checkout Pro: um item só, com o total já com desconto (o cupom é nosso).
  Sem notification_url de propósito: os avisos vêm do webhook cadastrado no painel do
  Mercado Pago, que é o que a documentação garante que chega assinado (x-signature).
*/
export function buildPreference({ order, siteUrl, payer, installments }) {
  const items = order.items ?? []
  const title = items.length === 1 ? items[0].title : `Studio HomeFit: ${items.length} cursos`
  const back = `${siteUrl.replace(/\/+$/, '')}/?pedido=${order.id}`
  const [first, ...rest] = (payer.name ?? '').split(' ')
  return {
    items: [
      {
        id: order.id,
        title: title.slice(0, 250),
        description: 'Cursos online Studio HomeFit',
        category_id: 'learnings',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Math.round(Number(order.total) * 100) / 100,
      },
    ],
    payer: {
      email: payer.email,
      ...(first ? { name: first, surname: rest.join(' ') } : {}),
      ...(payer.cpf ? { identification: { type: 'CPF', number: payer.cpf } } : {}),
      ...(payer.phone ? { phone: { area_code: payer.phone.slice(0, 2), number: payer.phone.slice(2) } } : {}),
    },
    external_reference: order.id,
    back_urls: { success: back, pending: back, failure: back },
    auto_return: 'approved',
    statement_descriptor: 'HOMEFIT',
    payment_methods: {
      installments: Math.min(24, Math.max(1, Math.round(installments || 1))),
      // só Pix e cartão: boleto ("ticket" no Mercado Pago) não aparece no pagamento
      excluded_payment_types: [{ id: 'ticket' }],
    },
    metadata: { order_id: order.id },
  }
}

// Aviso do Mercado Pago: tipo e id do pagamento (formato Webhooks: ?data.id=...&type=payment)
export function readNotification(url, body) {
  const data = body?.data && typeof body.data === 'object' ? body.data : {}
  const type = String(url.searchParams.get('type') ?? body?.type ?? url.searchParams.get('topic') ?? '')
  const queryId = url.searchParams.get('data.id')
  const bodyId = data.id == null ? null : String(data.id)
  return { type, queryId, bodyId }
}

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/*
  Assinatura x-signature do Mercado Pago ("ts=...,v1=..."), igual ao SDK oficial (mercadopago 3.6):
  texto assinado "id:<data.id da URL>;request-id:<x-request-id>;ts:<ts>;" com HMAC-SHA256 em hexadecimal
  e a assinatura secreta do webhook (Suas integrações > Webhooks). Valores ausentes saem do texto.
*/
export async function verifySignature({ secret, xSignature, xRequestId, dataId, maxAgeSeconds }) {
  if (!secret || !xSignature) return false
  let ts = ''
  let v1 = ''
  for (const part of String(xSignature).split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim().toLowerCase()
    const value = part.slice(eq + 1).trim()
    if (key === 'ts') ts = value
    else if (key === 'v1') v1 = value
  }
  if (!/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/i.test(v1)) return false
  if (maxAgeSeconds) {
    const tsSeconds = Number(ts) > 1e12 ? Number(ts) / 1000 : Number(ts)
    if (Math.abs(Date.now() / 1000 - tsSeconds) > maxAgeSeconds) return false
  }

  // a documentação pede o id em minúsculas quando ele tem letras (ids de pagamento são só números)
  const id = dataId ? String(dataId).trim() : ''
  const requestId = xRequestId ? String(xRequestId).trim() : ''
  let manifest = ''
  if (id) manifest += `id:${/^[a-z0-9]+$/i.test(id) ? id.toLowerCase() : id};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  return safeEqual(sig, v1.toLowerCase())
}

// Entre vários pagamentos do mesmo pedido, qual vale: aprovado > estornado > em andamento > recusado
const RANK = { approved: 4, refunded: 3, charged_back: 3, authorized: 2, in_process: 2, in_mediation: 2, pending: 2, rejected: 1, cancelled: 1 }

export function pickPayment(payments) {
  const time = (p) => Date.parse(p.date_last_updated ?? p.date_created ?? '') || 0
  return [...payments].sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0) || time(b) - time(a))[0] ?? null
}

// O pagamento é deste site? (conta que recebeu = a nossa, e referência = um pedido nosso)
export function paymentProblem(payment, accountId) {
  if (!payment || typeof payment !== 'object') return 'pagamento_invalido'
  if (!isUuid(String(payment.external_reference ?? ''))) return 'sem_pedido_do_site'
  if (accountId && String(payment.collector_id ?? '') !== String(accountId)) return 'outra_conta'
  return null
}

// Dados do pagamento que vão para o banco (apply_payment confere valor, moeda e pedido)
export const paymentForDb = (payment) => ({
  orderId: String(payment.external_reference).toLowerCase(),
  paymentId: String(payment.id),
  status: String(payment.status ?? ''),
  amount: Number(payment.transaction_amount),
  currency: String(payment.currency_id ?? ''),
  method: payment.payment_type_id ?? payment.payment_method_id ?? null,
})
