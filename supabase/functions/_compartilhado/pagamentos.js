/*
  O que cada Edge Function de pagamento faz. Sem dependências do Deno nem do Supabase:
  o banco (db) e o Mercado Pago (mp) chegam prontos em `deps` (ver servicos.js), e nos
  testes chegam versões de teste. Assim as mesmas regras rodam no servidor e nos testes.

  deps = {
    config: { ready, siteUrl, mpToken, mpSecret, conciliacaoSecret },
    db: { getUser, getRole, countRecentPending, getProfileName, createOrder, applyPayment,
          getComboInstallments, getOrder, markChecked, listOrdersToCheck, repairPaidOrders },
    mp: { createPreference, getPayment, searchPayments, getAccountId },
  }
*/
import { corsHeaders, json, log, readJson, safeEqual, text } from './http.js'
import {
  buildPreference,
  isPaymentId,
  isUuid,
  paymentForDb,
  paymentProblem,
  pickPayment,
  readNotification,
  validateCheckoutBody,
  verifySignature,
} from './mercadopago.js'

const NOT_CONFIGURED = 'O pagamento ainda não foi configurado. Fale com o Studio HomeFit pelo WhatsApp.'

// Erro de regra do banco (raise exception: "Cupom expirado", "Você já tem o curso"...) pode ir para a tela.
// Qualquer outro erro vira uma mensagem genérica: detalhes internos ficam só no log.
const publicMessage = (err, fallback) => (err?.code === 'P0001' && err.message ? err.message : fallback)

// Usuário logado a partir do cabeçalho Authorization (o token é conferido no Supabase Auth)
async function currentUser(req, db) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token || token.length > 4096) return null
  try {
    return await db.getUser(token)
  } catch {
    return null
  }
}

// -----------------------------------------------------------------------------
// criar-pagamento: cria o pedido (preço do banco) e a página de pagamento
// -----------------------------------------------------------------------------
export async function criarPagamento(req, { config, db, mp }) {
  const cors = corsHeaders(req, config.siteUrl)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, cors)

  if (!config.ready || !config.mpToken || !/^https?:\/\//.test(config.siteUrl)) {
    log('error', 'criar-pagamento:sem_configuracao')
    return json({ error: NOT_CONFIGURED }, 503, cors)
  }

  const user = await currentUser(req, db)
  if (!user) return json({ error: 'Faça login para continuar.' }, 401, cors)
  if (!user.emailConfirmed) return json({ error: 'Confirme seu e-mail antes de comprar.' }, 403, cors)

  let body
  try {
    body = validateCheckoutBody(await readJson(req))
  } catch (e) {
    return json({ error: e.message }, 400, cors)
  }

  // freio contra abuso: no máximo 10 pedidos pendentes em 10 minutos por conta (contado no banco,
  // então vale para todas as instâncias da função)
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  if ((await db.countRecentPending(user.id, since)) >= 10) {
    return json({ error: 'Muitas tentativas de compra seguidas. Aguarde alguns minutos.' }, 429, cors)
  }

  const payerName = body.payer.name || (await db.getProfileName(user.id)) || ''

  let order
  try {
    order = await db.createOrder({
      userId: user.id,
      courseIds: body.combo ? null : body.courseIds,
      combo: body.combo,
      coupon: body.coupon,
      payerName,
      payerEmail: user.email ?? '',
    })
  } catch (e) {
    if (e?.code !== 'P0001') log('error', 'criar-pagamento:create_order', { user: user.id, code: e?.code, message: e?.message })
    return json({ error: publicMessage(e, 'Não foi possível criar o pedido. Tente de novo.') }, 400, cors)
  }

  // cupom de 100%: não há o que cobrar, libera na hora
  if (Number(order.total) <= 0) {
    const result = await db.applyPayment({
      orderId: order.id,
      paymentId: `gratis-${order.id}`,
      status: 'approved',
      amount: 0,
      currency: 'BRL',
      method: 'cupom',
      source: 'free',
    })
    if (result !== 'liberado') {
      log('error', 'criar-pagamento:gratis', { order: order.id, result })
      return json({ error: 'Não foi possível liberar o pedido.' }, 500, cors)
    }
    return json({ free: true, orderId: order.id }, 200, cors)
  }

  const preference = buildPreference({
    order,
    siteUrl: config.siteUrl,
    payer: { name: payerName, email: user.email ?? '', phone: body.payer.phone, cpf: body.payer.cpf },
    installments: await db.getComboInstallments(),
  })

  let pref
  try {
    pref = await mp.createPreference(preference, order.id)
  } catch (e) {
    log('error', 'criar-pagamento:preferencia', { order: order.id, message: e?.message })
    await db
      .applyPayment({ orderId: order.id, paymentId: null, status: 'cancelled', amount: 0, currency: 'BRL', source: 'mercadopago' })
      .catch(() => {})
    return json({ error: 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.' }, 502, cors)
  }

  // credencial de teste abre o ambiente de testes do Mercado Pago
  const url = config.mpToken.startsWith('TEST-') ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point
  if (!/^https:\/\//.test(url ?? '')) {
    log('error', 'criar-pagamento:sem_link', { order: order.id })
    return json({ error: 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.' }, 502, cors)
  }
  return json({ url, orderId: order.id }, 200, cors)
}

// -----------------------------------------------------------------------------
// Busca os pagamentos de um pedido no Mercado Pago e aplica o que vale
// -----------------------------------------------------------------------------
async function reconcileOrder(orderId, { db, mp }) {
  const accountId = await mp.getAccountId()
  const payments = (await mp.searchPayments(orderId)).filter(
    (p) => !paymentProblem(p, accountId) && String(p.external_reference).toLowerCase() === orderId,
  )
  const best = pickPayment(payments)
  if (!best) return 'sem_pagamento'
  return db.applyPayment({ ...paymentForDb(best), source: 'mercadopago' })
}

// -----------------------------------------------------------------------------
// webhook-mercadopago: aviso do Mercado Pago
//
// O aviso só diz "o pagamento X mudou". Nada do conteúdo dele é usado como prova:
// a assinatura é conferida, o pagamento é buscado direto na API com a nossa credencial,
// e o banco confere pedido, valor e moeda antes de liberar.
// Respostas: 200 = recebido (ou recusado de vez, sem repetir); 401 = assinatura inválida;
// 500/503 = falha temporária (o Mercado Pago tenta de novo a cada 15 minutos).
// -----------------------------------------------------------------------------
export async function receberAviso(req, { config, db, mp }) {
  if (req.method !== 'POST') return text('método não permitido', 405)

  if (!config.ready || !config.mpToken || !config.mpSecret) {
    log('error', 'webhook:sem_configuracao', { token: !!config.mpToken, segredo: !!config.mpSecret })
    return text('pagamento não configurado', 503)
  }

  const url = new URL(req.url)
  const body = await readJson(req)
  if (body === null) return text('corpo inválido', 400)

  const { type, queryId, bodyId } = readNotification(url, body)
  const requestId = req.headers.get('x-request-id')

  // o id assinado é o da URL (?data.id=); se o corpo trouxer outro, é montagem
  if (!queryId || (bodyId && bodyId !== queryId)) return text('aviso inválido', 400)

  const valid = await verifySignature({
    secret: config.mpSecret,
    xSignature: req.headers.get('x-signature'),
    xRequestId: requestId,
    dataId: queryId,
  })
  if (!valid) {
    log('warn', 'webhook:assinatura_invalida', { requestId })
    return text('assinatura inválida', 401)
  }

  if (type !== 'payment') return text('ignorado')
  if (!isPaymentId(queryId)) return text('ignorado')

  let payment
  try {
    payment = await mp.getPayment(queryId)
  } catch (e) {
    log('error', 'webhook:consulta_falhou', { payment: queryId, message: e?.message })
    return text('erro ao consultar o Mercado Pago', 500)
  }
  if (!payment) return text('pagamento não encontrado')

  let accountId
  try {
    accountId = await mp.getAccountId()
  } catch (e) {
    log('error', 'webhook:conta_falhou', { message: e?.message })
    return text('erro ao consultar o Mercado Pago', 500)
  }

  const problem = paymentProblem(payment, accountId)
  if (problem) {
    log('warn', 'webhook:pagamento_recusado', { payment: queryId, problem })
    return text('ignorado')
  }

  let result
  try {
    result = await db.applyPayment({ ...paymentForDb(payment), source: 'mercadopago' })
  } catch (e) {
    log('error', 'webhook:banco_falhou', { payment: queryId, message: e?.message })
    return text('erro', 500)
  }

  const level = /^(recusado|alerta)/.test(result) ? 'warn' : 'info'
  log(level, 'webhook:aplicado', { order: paymentForDb(payment).orderId, payment: queryId, status: payment.status, result })
  return text('ok')
}

// -----------------------------------------------------------------------------
// conferir-pagamento: pergunta direto ao Mercado Pago como está o pagamento
//
// { orderId }      o dono do pedido (ou admin) confere um pedido; usado na volta do
//                  Mercado Pago, então o curso é liberado mesmo se o aviso atrasar.
// { todos: true }  admin (ou a rotina agendada, com CONCILIACAO_SECRET) confere os
//                  pedidos pendentes dos últimos 7 dias e corrige pagos sem acesso.
// -----------------------------------------------------------------------------
const CHECK_INTERVAL_MS = 5000

export async function conferirPagamento(req, { config, db, mp }) {
  const cors = corsHeaders(req, config.siteUrl)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, cors)

  if (!config.ready || !config.mpToken) {
    log('error', 'conferir:sem_configuracao')
    return json({ error: NOT_CONFIGURED }, 503, cors)
  }

  // quem está pedindo: rotina agendada (segredo próprio) ou alguém logado
  const cronSecret = req.headers.get('x-conciliacao-secret')
  const isCron = !!config.conciliacaoSecret && !!cronSecret && safeEqual(cronSecret, config.conciliacaoSecret)
  const user = isCron ? null : await currentUser(req, db)
  if (!isCron && !user) return json({ error: 'Faça login para continuar.' }, 401, cors)
  const isAdmin = isCron || (user.emailConfirmed && (await db.getRole(user.id)) === 'admin')

  const body = await readJson(req)
  if (body === null) return json({ error: 'Pedido inválido.' }, 400, cors)

  try {
    if (body.todos === true) {
      if (!isAdmin) return json({ error: 'Acesso negado.' }, 403, cors)
      const orders = await db.listOrdersToCheck(50)
      const results = {}
      for (const o of orders) {
        await db.markChecked(o.id)
        const r = await reconcileOrder(o.id, { db, mp })
        results[r] = (results[r] ?? 0) + 1
      }
      const repaired = await db.repairPaidOrders()
      log('info', 'conferir:todos', { conferidos: orders.length, results, repaired, origem: isCron ? 'agendada' : 'admin' })
      return json({ checked: orders.length, results, repaired }, 200, cors)
    }

    const orderId = typeof body.orderId === 'string' ? body.orderId.toLowerCase() : ''
    if (!isUuid(orderId)) return json({ error: 'Pedido inválido.' }, 400, cors)

    // pedido de outra pessoa responde igual a pedido inexistente (não revela que existe)
    const order = await db.getOrder(orderId)
    if (!order || (!isAdmin && order.user_id !== user.id)) return json({ error: 'Pedido não encontrado.' }, 404, cors)

    if (!['pending', 'failed'].includes(order.status)) return json({ status: order.status }, 200, cors)

    // no máximo uma consulta ao Mercado Pago a cada 5 segundos por pedido (marcado no banco)
    const last = order.checked_at ? Date.parse(order.checked_at) : 0
    if (Date.now() - last < CHECK_INTERVAL_MS) return json({ status: order.status }, 200, cors)

    await db.markChecked(orderId)
    await reconcileOrder(orderId, { db, mp })
    const fresh = await db.getOrder(orderId)
    return json({ status: fresh?.status ?? order.status }, 200, cors)
  } catch (e) {
    log('error', 'conferir:falhou', { message: e?.message })
    return json({ error: 'Não foi possível conferir o pagamento agora. Tente de novo em instantes.' }, 502, cors)
  }
}
