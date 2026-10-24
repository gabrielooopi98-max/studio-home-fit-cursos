/*
  Mercado Pago de mentira para os testes: guarda pagamentos em memória e responde como a API
  (mesma interface de supabase/functions/_compartilhado/servicos.js). Nenhuma cobrança real.
*/
import { createHmac } from 'node:crypto'

export const CONTA_DA_LOJA = '123456789'
export const SEGREDO_WEBHOOK = 'segredo-do-webhook-de-teste'

// ids de pagamento únicos entre todos os testes, como no Mercado Pago de verdade
let proximoId = 50000000001

export function criarMercadoPagoFalso() {
  const pagamentos = new Map()
  let foraDoAr = false
  const chamadas = { createPreference: 0, getPayment: 0, searchPayments: 0, getAccountId: 0 }
  const preferencias = []

  const falharSeForaDoAr = () => {
    if (foraDoAr) throw new Error('Mercado Pago respondeu 500')
  }

  return {
    chamadas,
    preferencias,
    foraDoAr(valor = true) {
      foraDoAr = valor
    },
    // cria um pagamento como se o comprador tivesse pago no Mercado Pago
    pagar({ pedido, valor, status = 'approved', moeda = 'BRL', conta = CONTA_DA_LOJA, id }) {
      const p = {
        id: id ?? proximoId++,
        status,
        transaction_amount: valor,
        currency_id: moeda,
        external_reference: pedido,
        collector_id: Number(conta),
        payment_type_id: 'bank_transfer',
        date_created: new Date().toISOString(),
        date_last_updated: new Date().toISOString(),
      }
      pagamentos.set(String(p.id), p)
      return p
    },
    // muda um pagamento existente (ex.: aprovado -> estornado)
    mudar(id, campos) {
      const p = pagamentos.get(String(id))
      Object.assign(p, campos, { date_last_updated: new Date(Date.now() + 1000).toISOString() })
      return p
    },
    api: {
      async createPreference(preferencia) {
        chamadas.createPreference++
        falharSeForaDoAr()
        preferencias.push(preferencia)
        return {
          id: `pref-${preferencias.length}`,
          init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-${preferencias.length}`,
          sandbox_init_point: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-${preferencias.length}`,
        }
      },
      async getPayment(id) {
        chamadas.getPayment++
        falharSeForaDoAr()
        const p = pagamentos.get(String(id))
        return p ? { ...p } : null
      },
      async searchPayments(pedido) {
        chamadas.searchPayments++
        falharSeForaDoAr()
        return [...pagamentos.values()].filter((p) => p.external_reference === pedido).map((p) => ({ ...p }))
      },
      async getAccountId() {
        chamadas.getAccountId++
        falharSeForaDoAr()
        return CONTA_DA_LOJA
      },
    },
  }
}

// Aviso de webhook como o Mercado Pago manda: ?data.id=...&type=payment e cabeçalho x-signature.
// A assinatura é calculada aqui com node:crypto, separado do código do site (confere a implementação).
export function avisoDoMercadoPago(pagamentoId, { segredo = SEGREDO_WEBHOOK, requestId = 'req-teste-1', ts, assinatura, corpo } = {}) {
  const momento = ts ?? String(Math.floor(Date.now() / 1000))
  const v1 = createHmac('sha256', segredo).update(`id:${pagamentoId};request-id:${requestId};ts:${momento};`).digest('hex')
  const headers = { 'Content-Type': 'application/json', 'x-request-id': requestId }
  if (assinatura !== null) headers['x-signature'] = assinatura ?? `ts=${momento},v1=${v1}`
  return new Request(`https://projeto.supabase.co/functions/v1/webhook-mercadopago?data.id=${pagamentoId}&type=payment`, {
    method: 'POST',
    headers,
    body: JSON.stringify(corpo ?? { action: 'payment.updated', type: 'payment', data: { id: String(pagamentoId) } }),
  })
}

// Chamada do site para uma Edge Function (com o login do aluno)
export function chamadaDoSite(url, corpo, token) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://studio-home-fit-cursos.vercel.app',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  })
}
