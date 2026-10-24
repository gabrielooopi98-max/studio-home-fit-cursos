// Regras do Mercado Pago usadas pelas Edge Functions (sem dependências: roda no Deno e nos testes em Node).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

export type CheckoutBody = {
  courseIds: string[]
  combo: boolean
  coupon: string | null
  payer: { name: string; phone: string; cpf: string }
}

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

// Valida o que vem do navegador. Preço NÃO vem daqui: é calculado no banco (create_order).
export function validateCheckoutBody(raw: unknown): CheckoutBody {
  if (!raw || typeof raw !== 'object') throw new Error('Pedido inválido.')
  const b = raw as Record<string, unknown>
  const combo = b.combo === true
  const courseIds = Array.isArray(b.courseIds) ? [...new Set(b.courseIds)] : []
  if (!combo) {
    if (!courseIds.length) throw new Error('Carrinho vazio.')
    if (courseIds.length > 50 || !courseIds.every(isUuid)) throw new Error('Cursos inválidos no carrinho.')
  }
  const coupon = typeof b.coupon === 'string' && b.coupon.trim() ? b.coupon.trim().toUpperCase() : null
  if (coupon && !/^[A-Z0-9_-]{3,30}$/.test(coupon)) throw new Error('Cupom inválido.')
  const p = (b.payer && typeof b.payer === 'object' ? b.payer : {}) as Record<string, unknown>
  const name = String(p.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const phone = digits(p.phone).slice(0, 11)
  const cpf = digits(p.cpf)
  return {
    courseIds: combo ? [] : (courseIds as string[]),
    combo,
    coupon,
    payer: { name, phone: phone.length >= 10 ? phone : '', cpf: cpf.length === 11 ? cpf : '' },
  }
}

type OrderForPreference = {
  id: string
  total: number | string
  items?: { title: string }[]
}

// Preferência do Checkout Pro: um item só com o total já com desconto (o cupom é nosso, não do Mercado Pago)
export function buildPreference(opts: {
  order: OrderForPreference
  siteUrl: string
  notificationUrl: string
  payer: { name?: string; email: string; phone?: string; cpf?: string }
  installments: number
}) {
  const { order, siteUrl, notificationUrl, payer, installments } = opts
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
    notification_url: notificationUrl,
    back_urls: { success: back, pending: back, failure: back },
    auto_return: 'approved',
    statement_descriptor: 'HOMEFIT',
    payment_methods: { installments: Math.min(24, Math.max(1, Math.round(installments || 1))) },
    metadata: { order_id: order.id },
  }
}

// Notificação do Mercado Pago: aceita o formato novo (Webhooks) e o antigo (IPN)
export function readNotification(url: URL, body: Record<string, unknown>) {
  const data = (body?.data ?? {}) as Record<string, unknown>
  const type = String(body?.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '')
  const dataId = String(url.searchParams.get('data.id') ?? data.id ?? url.searchParams.get('id') ?? '')
  return { type, dataId }
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

// comparação em tempo constante (não revela onde as assinaturas diferem)
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/*
  Assinatura x-signature do Mercado Pago ("ts=...,v1=...").
  Texto assinado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com HMAC-SHA256 e a chave secreta do webhook.
*/
export async function verifySignature(opts: {
  secret: string
  xSignature: string | null
  xRequestId: string | null
  dataId: string
  maxAgeSeconds?: number
}) {
  // maxAgeSeconds é opcional: reenvios do Mercado Pago podem trazer o horário original do aviso
  const { secret, xSignature, xRequestId, dataId, maxAgeSeconds } = opts
  if (!xSignature) return false
  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, ...v] = p.split('=')
      return [k.trim(), v.join('=').trim()]
    }),
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false
  const tsSeconds = Number(ts) > 1e12 ? Number(ts) / 1000 : Number(ts)
  if (!Number.isFinite(tsSeconds)) return false
  if (maxAgeSeconds && Math.abs(Date.now() / 1000 - tsSeconds) > maxAgeSeconds) return false

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  let manifest = ''
  if (id) manifest += `id:${id};`
  if (xRequestId) manifest += `request-id:${xRequestId};`
  manifest += `ts:${ts};`

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)))
  return safeEqual(sig, v1.toLowerCase())
}
