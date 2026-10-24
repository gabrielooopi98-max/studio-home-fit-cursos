// Testes das regras do Mercado Pago (o mesmo arquivo que roda nas Edge Functions). Rodar: npm test
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, test } from 'node:test'
import * as mp from '../supabase/functions/_compartilhado/mercadopago.js'

const id1 = '0b0b3a8e-3c8d-4f6a-9a51-7d2a1b3c4d5e'
const id2 = '1c1c3a8e-3c8d-4f6a-9a51-7d2a1b3c4d5e'

describe('o que vem do navegador', () => {
  test('limpa e valida o carrinho e os dados do pagador', () => {
    const b = mp.validateCheckoutBody({
      courseIds: [id1, id1, id2],
      combo: false,
      coupon: ' homefit10 ',
      payer: { name: '  Maria   Silva ', phone: '(64) 99925-8218', cpf: '529.982.247-25' },
    })
    assert.equal(b.courseIds.length, 2)
    assert.equal(b.coupon, 'HOMEFIT10')
    assert.equal(b.payer.name, 'Maria Silva')
    assert.equal(b.payer.phone, '64999258218')
    assert.equal(b.payer.cpf, '52998224725')
  })

  test('recusa carrinho vazio, ids estranhos, cupom estranho e corpo inválido', () => {
    assert.throws(() => mp.validateCheckoutBody({ courseIds: [] }), /Carrinho vazio/)
    assert.throws(() => mp.validateCheckoutBody({ courseIds: ['1; drop table orders'] }))
    assert.throws(() => mp.validateCheckoutBody({ courseIds: [id1], coupon: "x' or 1=1" }))
    assert.throws(() => mp.validateCheckoutBody(null))
    assert.throws(() => mp.validateCheckoutBody([id1]))
    assert.throws(() => mp.validateCheckoutBody({ courseIds: Array.from({ length: 51 }, (_, i) => id1.slice(0, -2) + String(i).padStart(2, '0')) }))
  })

  test('preço, status e dono enviados pelo navegador não passam adiante', () => {
    const b = mp.validateCheckoutBody({ courseIds: [id1], price: 0.01, total: 0, status: 'approved', userId: id2 })
    assert.deepEqual(Object.keys(b).sort(), ['combo', 'coupon', 'courseIds', 'payer'])
  })

  test('combo dispensa a lista de cursos', () => {
    assert.deepEqual(mp.validateCheckoutBody({ combo: true, courseIds: [id1] }).courseIds, [])
  })
})

describe('preferência do Checkout Pro', () => {
  const pref = mp.buildPreference({
    order: { id: id1, total: '201.6', items: [{ title: 'Terra' }, { title: 'Agachamento' }] },
    siteUrl: 'https://studiohomefit.com.br/',
    payer: { name: 'Maria Silva', email: 'maria@x.com', phone: '64999258218', cpf: '52998224725' },
    installments: 12,
  })

  test('um item com o total do pedido, em reais', () => {
    assert.equal(pref.items.length, 1)
    assert.equal(pref.items[0].unit_price, 201.6)
    assert.equal(pref.items[0].currency_id, 'BRL')
    assert.equal(pref.items[0].title, 'Studio HomeFit: 2 cursos')
  })

  test('referência é o pedido e a volta é para o site', () => {
    assert.equal(pref.external_reference, id1)
    assert.equal(pref.back_urls.success, `https://studiohomefit.com.br/?pedido=${id1}`)
    assert.ok(!('notification_url' in pref))
  })

  test('dados do pagador e parcelas', () => {
    assert.equal(pref.payer.identification.number, '52998224725')
    assert.equal(pref.payer.phone.area_code, '64')
    assert.equal(pref.payment_methods.installments, 12)
  })
})

describe('assinatura do webhook (x-signature)', () => {
  const secret = 'segredo-de-teste'
  const ts = String(Math.floor(Date.now() / 1000))
  const assinar = (texto, chave = secret) => createHmac('sha256', chave).update(texto).digest('hex')
  const sig = assinar(`id:123;request-id:req-1;ts:${ts};`)

  test('aceita a assinatura calculada como na documentação', async () => {
    assert.equal(await mp.verifySignature({ secret, xSignature: `ts=${ts},v1=${sig}`, xRequestId: 'req-1', dataId: '123' }), true)
    assert.equal(await mp.verifySignature({ secret, xSignature: ` ts=${ts} , v1=${sig.toUpperCase()} `, xRequestId: 'req-1', dataId: '123' }), true)
  })

  test('recusa outro pagamento, outra chave, outro request-id ou outro horário', async () => {
    assert.equal(await mp.verifySignature({ secret, xSignature: `ts=${ts},v1=${sig}`, xRequestId: 'req-1', dataId: '999' }), false)
    assert.equal(await mp.verifySignature({ secret: 'outra', xSignature: `ts=${ts},v1=${sig}`, xRequestId: 'req-1', dataId: '123' }), false)
    assert.equal(await mp.verifySignature({ secret, xSignature: `ts=${ts},v1=${sig}`, xRequestId: 'req-2', dataId: '123' }), false)
    assert.equal(await mp.verifySignature({ secret, xSignature: `ts=${Number(ts) + 1},v1=${sig}`, xRequestId: 'req-1', dataId: '123' }), false)
  })

  test('recusa assinatura ausente, malformada ou sem chave configurada', async () => {
    for (const xSignature of [null, '', 'lixo', `ts=${ts}`, `v1=${sig}`, `ts=abc,v1=${sig}`, `ts=${ts},v1=123`]) {
      assert.equal(await mp.verifySignature({ secret, xSignature, xRequestId: 'req-1', dataId: '123' }), false, String(xSignature))
    }
    assert.equal(await mp.verifySignature({ secret: '', xSignature: `ts=${ts},v1=${sig}`, xRequestId: 'req-1', dataId: '123' }), false)
  })

  test('sem x-request-id, o texto assinado fica sem ele (regra da documentação)', async () => {
    const s = assinar(`id:123;ts:${ts};`)
    assert.equal(await mp.verifySignature({ secret, xSignature: `ts=${ts},v1=${s}`, xRequestId: null, dataId: '123' }), true)
  })

  test('id com letras vai em minúsculas', async () => {
    const s = assinar(`id:abc123;request-id:r;ts:${ts};`)
    assert.equal(await mp.verifySignature({ secret, xSignature: `ts=${ts},v1=${s}`, xRequestId: 'r', dataId: 'ABC123' }), true)
  })

  test('limite de idade opcional', async () => {
    const velho = '1000'
    const s = assinar(`id:123;request-id:req-1;ts:${velho};`)
    assert.equal(await mp.verifySignature({ secret, xSignature: `ts=${velho},v1=${s}`, xRequestId: 'req-1', dataId: '123', maxAgeSeconds: 600 }), false)
  })
})

describe('leitura do aviso e escolha do pagamento', () => {
  test('lê o id da URL e o do corpo separadamente', () => {
    const n = mp.readNotification(new URL('https://x/fn?data.id=123&type=payment'), { type: 'payment', data: { id: 456 } })
    assert.deepEqual(n, { type: 'payment', queryId: '123', bodyId: '456' })
  })

  test('entre vários pagamentos do pedido, vale o aprovado; depois o estorno; depois o mais recente', () => {
    const t = (s) => new Date(Date.UTC(2026, 0, 1, 0, 0, s)).toISOString()
    const recusado = { id: 1, status: 'rejected', date_created: t(3) }
    const aprovado = { id: 2, status: 'approved', date_created: t(1) }
    const estornado = { id: 3, status: 'refunded', date_created: t(2) }
    const pendente = { id: 4, status: 'pending', date_created: t(4) }
    assert.equal(mp.pickPayment([recusado, aprovado, estornado, pendente]).id, 2)
    assert.equal(mp.pickPayment([recusado, estornado, pendente]).id, 3)
    assert.equal(mp.pickPayment([recusado, pendente]).id, 4)
    assert.equal(mp.pickPayment([]), null)
  })

  test('pagamento de outra conta ou sem pedido do site é recusado', () => {
    const ok = { external_reference: id1, collector_id: 42 }
    assert.equal(mp.paymentProblem(ok, '42'), null)
    assert.equal(mp.paymentProblem({ ...ok, collector_id: 7 }, '42'), 'outra_conta')
    assert.equal(mp.paymentProblem({ ...ok, external_reference: 'pedido-123' }, '42'), 'sem_pedido_do_site')
    assert.equal(mp.paymentProblem(null, '42'), 'pagamento_invalido')
  })
})
