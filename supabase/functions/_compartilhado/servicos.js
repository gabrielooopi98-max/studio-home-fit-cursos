/*
  Ligações reais das Edge Functions: banco (Supabase, com a chave secreta do servidor) e
  API do Mercado Pago. Só roda no Deno (servidor do Supabase); os testes usam versões de teste.

  Secrets (Supabase > Edge Functions > Secrets):
    MP_ACCESS_TOKEN      credencial do Mercado Pago (obrigatório)
    MP_WEBHOOK_SECRET    assinatura secreta do webhook (obrigatório para receber avisos)
    SITE_URL             endereço do site, ex.: https://studio-home-fit-cursos.vercel.app
    CONCILIACAO_SECRET   opcional: senha da rotina agendada que confere pagamentos
  SUPABASE_URL e a chave secreta do servidor já vêm prontos no Supabase.
*/
import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (name) => (Deno.env.get(name) ?? '').trim()

// Chave do servidor: a nova (SUPABASE_SECRET_KEYS.default) ou a antiga service_role
function serverKey() {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}')
    if (typeof keys.default === 'string' && keys.default) return keys.default
  } catch {
    // formato inesperado: usa a chave antiga
  }
  return env('SUPABASE_SERVICE_ROLE_KEY')
}

export function criarDependencias() {
  const supabaseUrl = env('SUPABASE_URL')
  const key = serverKey()
  const config = {
    ready: !!supabaseUrl && !!key,
    siteUrl: env('SITE_URL').replace(/\/+$/, ''),
    mpToken: env('MP_ACCESS_TOKEN'),
    mpSecret: env('MP_WEBHOOK_SECRET'),
    conciliacaoSecret: env('CONCILIACAO_SECRET'),
  }
  const sb = config.ready ? createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null
  return { config, db: banco(sb), mp: mercadoPago(config.mpToken) }
}

// Resposta do Supabase: devolve os dados ou lança o erro com o código do Postgres (P0001 = regra do banco)
function must({ data, error }) {
  if (error) {
    const e = new Error(error.message)
    e.code = error.code
    throw e
  }
  return data
}

function banco(sb) {
  return {
    async getUser(token) {
      const { data, error } = await sb.auth.getUser(token)
      if (error || !data?.user) return null
      return { id: data.user.id, email: data.user.email ?? '', emailConfirmed: !!data.user.email_confirmed_at }
    },
    async getRole(userId) {
      return must(await sb.from('profiles').select('role').eq('id', userId).maybeSingle())?.role ?? null
    },
    async countRecentPending(userId, since) {
      const { count, error } = await sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('created_at', since)
      if (error) throw new Error(error.message)
      return count ?? 0
    },
    async getProfileName(userId) {
      return must(await sb.from('profiles').select('full_name').eq('id', userId).maybeSingle())?.full_name ?? ''
    },
    async createOrder({ userId, courseIds, combo, coupon, payerName, payerEmail }) {
      return must(
        await sb.rpc('create_order', {
          p_user_id: userId,
          p_course_ids: courseIds,
          p_combo: combo,
          p_coupon: coupon,
          p_provider: 'mercadopago',
          p_payer_name: payerName,
          p_payer_email: payerEmail,
        }),
      )
    },
    async applyPayment({ orderId, paymentId, status, amount, currency, method = null, source = 'mercadopago' }) {
      return must(
        await sb.rpc('apply_payment', {
          p_order_id: orderId,
          p_payment_id: paymentId,
          p_status: status,
          p_amount: amount,
          p_currency: currency,
          p_method: method,
          p_source: source,
        }),
      )
    },
    async getComboInstallments() {
      return must(await sb.from('settings').select('combo_installments').eq('id', 1).maybeSingle())?.combo_installments ?? 12
    },
    async getOrder(id) {
      return must(await sb.from('orders').select('id, user_id, status, checked_at').eq('id', id).maybeSingle())
    },
    async markChecked(id) {
      must(await sb.from('orders').update({ checked_at: new Date().toISOString() }).eq('id', id))
    },
    // pendentes (ou recusados, que podem ter um novo pagamento) dos últimos 7 dias, sem conferência no último minuto
    async listOrdersToCheck(limit) {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
      return must(
        await sb
          .from('orders')
          .select('id')
          .in('status', ['pending', 'failed'])
          .eq('payment_provider', 'mercadopago')
          .gte('created_at', weekAgo)
          .or(`checked_at.is.null,checked_at.lt."${minuteAgo}"`)
          .order('created_at', { ascending: false })
          .limit(limit),
      )
    },
    async repairPaidOrders() {
      return must(await sb.rpc('repair_paid_orders'))
    },
  }
}

const MP_API = 'https://api.mercadopago.com'
const MP_TIMEOUT_MS = 8000

function mercadoPago(token) {
  let accountId = null

  async function call(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(MP_API + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(MP_TIMEOUT_MS),
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  return {
    async createPreference(preference, idempotencyKey) {
      const { res, data } = await call('/checkout/preferences', {
        method: 'POST',
        body: preference,
        headers: { 'X-Idempotency-Key': idempotencyKey },
      })
      if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}: ${String(data?.message ?? '').slice(0, 150)}`)
      return data
    },
    async getPayment(id) {
      const { res, data } = await call(`/v1/payments/${encodeURIComponent(id)}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}`)
      return data
    },
    async searchPayments(orderId) {
      const q = new URLSearchParams({ external_reference: orderId, sort: 'date_created', criteria: 'desc', limit: '30' })
      const { res, data } = await call(`/v1/payments/search?${q}`)
      if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}`)
      return Array.isArray(data?.results) ? data.results : []
    },
    // conta dona da credencial: o pagamento precisa ter sido recebido por ela (collector_id)
    async getAccountId() {
      if (accountId) return accountId
      const { res, data } = await call('/users/me')
      if (!res.ok || !data?.id) throw new Error(`Mercado Pago respondeu ${res.status} ao buscar a conta`)
      accountId = String(data.id)
      return accountId
    },
  }
}
