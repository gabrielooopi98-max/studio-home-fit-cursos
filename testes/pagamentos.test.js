/*
  Testes de segurança do pagamento: as Edge Functions de verdade (supabase/functions/_compartilhado)
  rodando contra o banco de verdade (migrações 0001 a 0004 num PostgreSQL PGlite), com um
  Mercado Pago de mentira. Rodar: npm test
*/
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, describe, test } from 'node:test'
import { conferirPagamento, criarPagamento, receberAviso } from '../supabase/functions/_compartilhado/pagamentos.js'
import { bancoDasFuncoes, como, criarBancoDeTeste, criarUsuario, idDoCurso, tentar, tokenDe } from './apoio/banco-de-teste.js'
import { SEGREDO_WEBHOOK, avisoDoMercadoPago, chamadaDoSite, criarMercadoPagoFalso } from './apoio/mercadopago-falso.js'

const URL_CRIAR = 'https://projeto.supabase.co/functions/v1/criar-pagamento'
const URL_CONFERIR = 'https://projeto.supabase.co/functions/v1/conferir-pagamento'
const CONFIG = {
  ready: true,
  siteUrl: 'https://studio-home-fit-cursos.vercel.app',
  mpToken: 'APP_USR-credencial-de-teste',
  mpSecret: SEGREDO_WEBHOOK,
  conciliacaoSecret: 'segredo-da-rotina-agendada',
}

let pg
let db
let admin
const cursos = {}

before(async () => {
  pg = await criarBancoDeTeste()
  db = bancoDasFuncoes(pg)
  for (const slug of ['terra', 'agachamento', 'fundamentos']) cursos[slug] = await idDoCurso(pg, slug)
  const id = await criarUsuario(pg, 'gabrielooopi98@gmail.com', { nome: 'Dono' })
  admin = { id, token: tokenDe(id) }
})

// ---------- ajudantes ----------
const preparar = (config = {}) => {
  const mp = criarMercadoPagoFalso()
  return { mp, deps: { config: { ...CONFIG, ...config }, db, mp: mp.api } }
}
async function novoAluno(nome = 'aluno', opcoes) {
  const id = await criarUsuario(pg, `${nome}-${randomUUID().slice(0, 8)}@teste.com`, { nome, ...opcoes })
  return { id, token: tokenDe(id) }
}
async function comprar(deps, aluno, corpo) {
  const res = await criarPagamento(chamadaDoSite(URL_CRIAR, corpo, aluno?.token), deps)
  return { status: res.status, corpo: await res.json() }
}
async function aviso(deps, pagamentoId, opcoes) {
  const res = await receberAviso(avisoDoMercadoPago(pagamentoId, opcoes), deps)
  return { status: res.status, texto: await res.text() }
}
async function conferir(deps, corpo, { token, headers = {} } = {}) {
  const req = chamadaDoSite(URL_CONFERIR, corpo, token)
  for (const [k, v] of Object.entries(headers)) req.headers.set(k, v)
  const res = await conferirPagamento(req, deps)
  return { status: res.status, corpo: await res.json() }
}
const cursosDo = async (alunoId) =>
  (await pg.query('select c.slug from enrollments e join courses c on c.id = e.course_id where e.user_id = $1 order by 1', [alunoId])).rows.map(
    (r) => r.slug,
  )
const pedido = async (id) => (await pg.query('select * from orders where id = $1', [id])).rows[0]
const eventos = async (id) => (await pg.query('select result from payment_events where order_id = $1 order by id', [id])).rows.map((r) => r.result)
const preco = async (slug) => Number((await pg.query('select price from courses where slug = $1', [slug])).rows[0].price)

// pedido pendente de um curso, já com a página de pagamento criada
async function pedidoPendente(deps, aluno, slug = 'terra', extra = {}) {
  const r = await comprar(deps, aluno, { courseIds: [cursos[slug]], ...extra })
  assert.equal(r.status, 200, JSON.stringify(r.corpo))
  return { id: r.corpo.orderId, total: Number((await pedido(r.corpo.orderId)).total) }
}

// =============================================================================
describe('1. pagamento aprovado e confirmado', () => {
  test('libera exatamente o curso comprado', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno('ana')
    const r = await comprar(deps, aluno, { courseIds: [cursos.terra] })
    assert.equal(r.status, 200)
    assert.match(r.corpo.url, /^https:\/\/www\.mercadopago\.com\.br\//)

    const pref = mp.preferencias.at(-1)
    assert.equal(pref.external_reference, r.corpo.orderId)
    assert.equal(pref.items[0].unit_price, await preco('terra'))
    assert.equal(pref.items[0].currency_id, 'BRL')
    assert.ok(!('notification_url' in pref), 'avisos só pelo webhook do painel (assinado)')

    assert.deepEqual(await cursosDo(aluno.id), [], 'nada liberado só por abrir o pagamento')
    const pag = mp.pagar({ pedido: r.corpo.orderId, valor: await preco('terra') })
    assert.equal((await aviso(deps, pag.id)).status, 200)

    assert.deepEqual(await cursosDo(aluno.id), ['terra'])
    const o = await pedido(r.corpo.orderId)
    assert.equal(o.status, 'paid')
    assert.equal(o.payment_id, String(pag.id))
  })
})

describe('2. pagamento pendente', () => {
  test('pending e in_process não liberam acesso', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total, status: 'pending' })
    await aviso(deps, pag.id)
    mp.mudar(pag.id, { status: 'in_process' })
    await aviso(deps, pag.id)
    assert.equal((await pedido(p.id)).status, 'pending')
    assert.deepEqual(await cursosDo(aluno.id), [])
  })
})

describe('3. pagamento recusado', () => {
  test('rejected marca como recusado e não libera', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total, status: 'rejected' })
    await aviso(deps, pag.id)
    assert.equal((await pedido(p.id)).status, 'failed')
    assert.deepEqual(await cursosDo(aluno.id), [])
  })
})

describe('4. o navegador não consegue liberar curso', () => {
  test('gravações diretas pela API pública são bloqueadas', async () => {
    const { deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const q = como(pg, 'authenticated', aluno.id)

    assert.ok((await tentar(q('insert into enrollments (user_id, course_id) values ($1, $2)', [aluno.id, cursos.terra]))).error)
    assert.ok((await tentar(q(`insert into orders (user_id, status, total) values ($1, 'paid', 0)`, [aluno.id]))).error)
    const up = await tentar(q(`update orders set status = 'paid', paid_at = now() where id = $1`, [p.id]))
    assert.equal(up.affected, 0)
    assert.ok((await tentar(q(`select public.apply_payment($1, '1', 'approved', $2, 'BRL')`, [p.id, p.total]))).error)
    assert.ok((await tentar(q('select public.grant_order_courses($1)', [p.id]))).error)
    assert.ok((await tentar(q(`select public.create_order($1, array[$2]::uuid[], false, null, 'test', '', '')`, [aluno.id, cursos.terra]))).error)

    assert.equal((await pedido(p.id)).status, 'pending')
    assert.deepEqual(await cursosDo(aluno.id), [])
  })

  test('"status: approved" enviado pelo navegador é ignorado', async () => {
    const { deps } = preparar()
    const aluno = await novoAluno()
    const r = await comprar(deps, aluno, { courseIds: [cursos.terra], status: 'approved', paid: true, userId: admin.id })
    const o = await pedido(r.corpo.orderId)
    assert.equal(o.status, 'pending')
    assert.equal(o.user_id, aluno.id, 'dono do pedido é quem está logado, não o que o navegador mandou')
    // voltar para o site com ?pedido= sem ter pago: o servidor confere no Mercado Pago e nada muda
    const c = await conferir(deps, { orderId: r.corpo.orderId }, { token: aluno.token })
    assert.equal(c.corpo.status, 'pending')
    assert.deepEqual(await cursosDo(aluno.id), [])
  })

  test('compra de teste: só admin, e só com o modo de teste ligado', async () => {
    const aluno = await novoAluno()
    const comprarTeste = (u) => tentar(como(pg, 'authenticated', u)(`select public.create_test_order(array[$1]::uuid[]) as o`, [cursos.fundamentos]))
    assert.match((await comprarTeste(aluno.id)).error, /desligado/)
    await pg.query('update settings set test_mode = true')
    try {
      assert.match((await comprarTeste(aluno.id)).error, /modo de teste/)
      const r = await comprarTeste(admin.id)
      assert.equal(r.error, null)
      assert.equal(r.rows[0].o.status, 'paid')
    } finally {
      await pg.query('update settings set test_mode = false')
    }
    assert.deepEqual(await cursosDo(aluno.id), [])
  })
})

describe('5. um aluno não acessa o curso de outro', () => {
  test('vídeos, arquivos, pedidos e conferência ficam restritos ao dono', async () => {
    const { mp, deps } = preparar()
    const alice = await novoAluno('alice')
    const bob = await novoAluno('bob')
    const p = await pedidoPendente(deps, alice)
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total }).id)

    // primeira aula do primeiro módulo (liberada na hora, mesmo com a liberação gradual)
    const aula = (
      await pg.query(
        'select l.id from lessons l join modules m on m.id = l.module_id where l.course_id = $1 order by m.position, l.position limit 1',
        [cursos.terra],
      )
    ).rows[0].id
    await pg.query(`insert into lesson_media (lesson_id, course_id, video_url) values ($1, $1, 'https://player.exemplo/aula') on conflict do nothing`, [aula])
    await pg.query(`insert into storage.objects (bucket_id, name) values ('lesson-videos', $1)`, [`courses/${cursos.terra}/${aula}/aula.mp4`])

    const comoAlice = como(pg, 'authenticated', alice.id)
    const comoBob = como(pg, 'authenticated', bob.id)
    const contar = async (q, sql, params) => (await q(sql, params)).rows.length
    const abrir = async (q) => (await tentar(q('select public.open_lesson($1) as r', [aula])))

    // o link só sai pela open_lesson (que registra a abertura); leitura direta da tabela é só do admin
    assert.equal(await contar(comoAlice, 'select 1 from lesson_media where course_id = $1', [cursos.terra]), 0)
    assert.equal(await contar(comoAlice, `select 1 from storage.objects where bucket_id = 'lesson-videos'`), 0, 'arquivo só depois de abrir a aula')
    assert.equal((await abrir(comoAlice)).rows[0].r.video_url, 'https://player.exemplo/aula')
    assert.equal(await contar(comoAlice, `select 1 from storage.objects where bucket_id = 'lesson-videos'`), 1)

    assert.match((await abrir(comoBob)).error, /não tem acesso/)
    assert.equal(await contar(comoBob, 'select 1 from lesson_media where course_id = $1', [cursos.terra]), 0)
    assert.equal(await contar(comoBob, `select 1 from storage.objects where bucket_id = 'lesson-videos'`), 0)
    assert.equal(await contar(comoBob, 'select 1 from orders where id = $1', [p.id]), 0)
    assert.equal(await contar(comoBob, 'select 1 from order_items where order_id = $1', [p.id]), 0)
    assert.equal(await contar(comoBob, 'select 1 from enrollments where user_id = $1', [alice.id]), 0)

    // pedido de outra pessoa responde igual a pedido que não existe
    const c = await conferir(deps, { orderId: p.id }, { token: bob.token })
    assert.equal(c.status, 404)
    assert.equal((await conferir(deps, { orderId: randomUUID() }, { token: bob.token })).status, 404)
  })
})

describe('6. o preço vem do banco, nunca do navegador', () => {
  test('preço, total e itens enviados na requisição são ignorados', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const r = await comprar(deps, aluno, {
      courseIds: [cursos.terra],
      price: 0.01,
      total: 0.01,
      amount: 0.01,
      items: [{ title: 'Terra', price: 0.01 }],
    })
    assert.equal(Number((await pedido(r.corpo.orderId)).total), await preco('terra'))
    assert.equal(mp.preferencias.at(-1).items[0].unit_price, await preco('terra'))
  })

  test('curso inexistente, não publicado ou id malformado é recusado', async () => {
    const { deps } = preparar()
    const aluno = await novoAluno()
    assert.equal((await comprar(deps, aluno, { courseIds: [randomUUID()] })).status, 400)
    assert.equal((await comprar(deps, aluno, { courseIds: ["1' or '1'='1"] })).status, 400)
    assert.equal((await comprar(deps, aluno, { courseIds: [] })).status, 400)
  })

  test('não deixa comprar de novo um curso que já tem', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total }).id)
    const r = await comprar(deps, aluno, { courseIds: [cursos.terra] })
    assert.equal(r.status, 400)
    assert.match(r.corpo.error, /já tem o curso/)
  })

  test('cupom de 100% libera sem passar pelo Mercado Pago', async () => {
    const { mp, deps } = preparar()
    await pg.query(`insert into coupons (code, kind, value) values ('TUDOGRATIS', 'percent', 100) on conflict do nothing`)
    const aluno = await novoAluno()
    const r = await comprar(deps, aluno, { courseIds: [cursos.fundamentos], coupon: 'tudogratis' })
    assert.equal(r.corpo.free, true)
    assert.equal(mp.chamadas.createPreference, 0)
    assert.deepEqual(await cursosDo(aluno.id), ['fundamentos'])
  })
})

describe('7. assinatura inválida é recusada', () => {
  test('sem assinatura, assinatura falsa ou com outra chave: 401 e nada é consultado', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total })

    assert.equal((await aviso(deps, pag.id, { assinatura: null })).status, 401)
    assert.equal((await aviso(deps, pag.id, { assinatura: `ts=1,v1=${'a'.repeat(64)}` })).status, 401)
    assert.equal((await aviso(deps, pag.id, { segredo: 'chave-errada' })).status, 401)
    assert.equal((await aviso(deps, pag.id, { assinatura: 'lixo' })).status, 401)
    // assinatura válida de um pagamento, reaproveitada para outro id no corpo
    assert.equal((await aviso(deps, pag.id, { corpo: { type: 'payment', data: { id: '999' } } })).status, 400)

    assert.equal(mp.chamadas.getPayment, 0, 'nem chega a consultar o Mercado Pago')
    assert.deepEqual(await cursosDo(aluno.id), [])
  })
})

describe('8. aviso falso não libera', () => {
  test('pagamento que não existe no Mercado Pago', async () => {
    const { deps } = preparar()
    const aluno = await novoAluno()
    await pedidoPendente(deps, aluno)
    const r = await aviso(deps, '987654321')
    assert.equal(r.status, 200)
    assert.deepEqual(await cursosDo(aluno.id), [])
  })

  test('pagamento recebido por outra conta, com o número do nosso pedido', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total, conta: '555' })
    await aviso(deps, pag.id)
    assert.deepEqual(await cursosDo(aluno.id), [])
    assert.equal((await conferir(deps, { orderId: p.id }, { token: aluno.token })).corpo.status, 'pending')
  })

  test('"approved" no corpo do aviso não vale: vale o que a API do Mercado Pago diz', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total, status: 'pending' })
    await aviso(deps, pag.id, { corpo: { type: 'payment', data: { id: String(pag.id), status: 'approved' }, status: 'approved' } })
    assert.deepEqual(await cursosDo(aluno.id), [])
  })
})

describe('9. aviso repetido não duplica', () => {
  test('mesmo aviso várias vezes (inclusive ao mesmo tempo): uma liberação, cupom contado uma vez', async () => {
    const { mp, deps } = preparar()
    await pg.query(`insert into coupons (code, kind, value) values ('REPETE10', 'percent', 10) on conflict do nothing`)
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno, 'terra', { coupon: 'REPETE10' })
    assert.equal(p.total, Math.round((await preco('terra')) * 0.9 * 100) / 100)
    const pag = mp.pagar({ pedido: p.id, valor: p.total })

    await aviso(deps, pag.id)
    await Promise.all([aviso(deps, pag.id), aviso(deps, pag.id), aviso(deps, pag.id, { requestId: 'req-2' })])

    assert.deepEqual(await cursosDo(aluno.id), ['terra'])
    assert.equal((await pg.query(`select count(*)::int as n from enrollments where user_id = $1`, [aluno.id])).rows[0].n, 1)
    assert.equal((await pg.query(`select used_count from coupons where code = 'REPETE10'`)).rows[0].used_count, 1)
    const ev = await eventos(p.id)
    assert.equal(ev.filter((e) => e === 'liberado').length, 1)
    assert.equal(ev.filter((e) => e === 'repetido').length, 3)
  })
})

describe('10. pagamento de um pedido não libera outro', () => {
  test('pedido B continua pendente e o pagamento de A é recusado em B', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const a = await pedidoPendente(deps, aluno, 'terra')
    const b = await pedidoPendente(deps, aluno, 'agachamento')
    const pag = mp.pagar({ pedido: a.id, valor: a.total })
    await aviso(deps, pag.id)

    assert.equal((await pedido(a.id)).status, 'paid')
    assert.equal((await pedido(b.id)).status, 'pending')
    assert.deepEqual(await cursosDo(aluno.id), ['terra'])

    // mesmo forçando no servidor, o pagamento de A não serve para B
    const r = await db.applyPayment({ orderId: b.id, paymentId: String(pag.id), status: 'approved', amount: b.total, currency: 'BRL' })
    assert.equal(r, 'recusado:pagamento_de_outro_pedido')
    assert.equal((await pedido(b.id)).status, 'pending')
    assert.deepEqual(await cursosDo(aluno.id), ['terra'])
  })
})

describe('11. valor ou moeda diferente', () => {
  test('valor menor, maior ou moeda estrangeira: nada liberado e fica registrado', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)

    await aviso(deps, mp.pagar({ pedido: p.id, valor: 1 }).id)
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total - 0.02 }).id)
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total + 50 }).id)
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total, moeda: 'USD' }).id)

    assert.equal((await pedido(p.id)).status, 'pending')
    assert.deepEqual(await cursosDo(aluno.id), [])
    assert.deepEqual(await eventos(p.id), ['recusado:valor', 'recusado:valor', 'recusado:valor', 'recusado:moeda'])
  })
})

describe('12. o aluno não altera status de pagamento', () => {
  test('pedido, eventos e cupons não podem ser mexidos pela API pública', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total, status: 'rejected' }).id)
    const q = como(pg, 'authenticated', aluno.id)

    assert.equal((await tentar(q(`update orders set status = 'paid' where id = $1`, [p.id]))).affected, 0)
    assert.equal((await tentar(q(`update orders set total = 0.01 where id = $1`, [p.id]))).affected, 0)
    assert.ok((await tentar(q(`insert into payment_events (order_id, result) values ($1, 'liberado')`, [p.id]))).error)
    assert.ok((await tentar(q(`update payment_events set result = 'liberado'`))).error)
    assert.ok((await tentar(q(`select public.admin_set_order_status($1, 'paid')`, [p.id]))).error)
    assert.equal((await tentar(q(`update coupons set used_count = 0`))).affected, 0)
    assert.equal((await pedido(p.id)).status, 'failed')
  })
})

describe('13. estorno e contestação (chargeback)', () => {
  test('estorno remove o acesso daquele pedido', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total })
    await aviso(deps, pag.id)
    mp.mudar(pag.id, { status: 'refunded' })
    await aviso(deps, pag.id)
    assert.equal((await pedido(p.id)).status, 'refunded')
    assert.deepEqual(await cursosDo(aluno.id), [])
  })

  test('chargeback remove o acesso', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno, 'agachamento')
    const pag = mp.pagar({ pedido: p.id, valor: p.total })
    await aviso(deps, pag.id)
    mp.mudar(pag.id, { status: 'charged_back' })
    await aviso(deps, pag.id)
    assert.deepEqual(await cursosDo(aluno.id), [])
  })

  test('estornar um pedido não tira curso pago em outro pedido (curso avulso + combo)', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const avulso = await pedidoPendente(deps, aluno, 'terra')
    const pagAvulso = mp.pagar({ pedido: avulso.id, valor: avulso.total })
    await aviso(deps, pagAvulso.id)
    const combo = await comprar(deps, aluno, { combo: true })
    const totalCombo = Number((await pedido(combo.corpo.orderId)).total)
    await aviso(deps, mp.pagar({ pedido: combo.corpo.orderId, valor: totalCombo }).id)
    const todos = (await pg.query('select count(*)::int as n from courses where published')).rows[0].n
    assert.equal((await cursosDo(aluno.id)).length, todos)

    mp.mudar(pagAvulso.id, { status: 'refunded' })
    await aviso(deps, pagAvulso.id)
    assert.equal((await pedido(avulso.id)).status, 'refunded')
    assert.ok((await cursosDo(aluno.id)).includes('terra'), 'o combo pago continua dando o curso')
    assert.equal((await cursosDo(aluno.id)).length, todos)
  })

  test('pagou duas vezes: estornar um pagamento não tira o acesso; estornar os dois tira', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag1 = mp.pagar({ pedido: p.id, valor: p.total })
    const pag2 = mp.pagar({ pedido: p.id, valor: p.total })
    await aviso(deps, pag1.id)
    await aviso(deps, pag2.id)
    assert.deepEqual(await eventos(p.id), ['liberado', 'alerta:pagamento_em_dobro'])

    mp.mudar(pag1.id, { status: 'refunded' })
    await aviso(deps, pag1.id)
    assert.equal((await pedido(p.id)).status, 'paid')
    assert.equal((await pedido(p.id)).payment_id, String(pag2.id))
    assert.deepEqual(await cursosDo(aluno.id), ['terra'])

    mp.mudar(pag2.id, { status: 'refunded' })
    await aviso(deps, pag2.id)
    assert.equal((await pedido(p.id)).status, 'refunded')
    assert.deepEqual(await cursosDo(aluno.id), [])
  })

  test('estorno feito pelo admin no painel fica registrado e remove o acesso', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total }).id)
    const r = await como(pg, 'authenticated', admin.id)(`select public.admin_set_order_status($1, 'refunded') as s`, [p.id])
    assert.equal(r.rows[0].s, 'refunded')
    assert.deepEqual(await cursosDo(aluno.id), [])
    assert.match((await eventos(p.id)).at(-1), /^admin:refunded/)
  })
})

describe('14. sem configuração, nada sensível acontece', () => {
  test('criar-pagamento sem token do Mercado Pago, sem banco ou sem SITE_URL: 503 e nenhum pedido', async () => {
    const aluno = await novoAluno()
    for (const config of [{ mpToken: '' }, { ready: false }, { siteUrl: '' }]) {
      const { mp, deps } = preparar(config)
      const r = await comprar(deps, aluno, { courseIds: [cursos.terra] })
      assert.equal(r.status, 503)
      assert.equal(mp.chamadas.createPreference, 0)
    }
    assert.equal((await pg.query('select count(*)::int as n from orders where user_id = $1', [aluno.id])).rows[0].n, 0)
  })

  test('webhook sem assinatura secreta configurada: 503 e não consulta nada', async () => {
    const { mp, deps } = preparar({ mpSecret: '' })
    assert.equal((await aviso(deps, '123')).status, 503)
    assert.equal(mp.chamadas.getPayment, 0)
  })

  test('conferir-pagamento sem token do Mercado Pago: 503', async () => {
    const { deps } = preparar({ mpToken: '' })
    const aluno = await novoAluno()
    assert.equal((await conferir(deps, { orderId: randomUUID() }, { token: aluno.token })).status, 503)
  })

  test('sem login ou com e-mail não confirmado não compra', async () => {
    const { deps } = preparar()
    assert.equal((await comprar(deps, null, { courseIds: [cursos.terra] })).status, 401)
    assert.equal((await comprar(deps, { token: 'token-invalido' }, { courseIds: [cursos.terra] })).status, 401)
    const naoConfirmado = await novoAluno('novo', { confirmado: false })
    assert.equal((await comprar(deps, naoConfirmado, { courseIds: [cursos.terra] })).status, 403)
  })
})

describe('15. regras de acesso do banco (RLS)', () => {
  test('visitante não lê nem grava dados de pedidos, alunos ou pagamentos', async () => {
    const anon = como(pg, 'anon')
    for (const tabela of ['orders', 'order_items', 'enrollments', 'profiles', 'coupons', 'lesson_media', 'lesson_progress']) {
      const r = await tentar(anon(`select * from ${tabela}`))
      assert.ok(r.error || r.rows.length === 0, `anon leu ${tabela}`)
    }
    assert.ok((await tentar(anon('select * from payment_events'))).error)
    assert.ok((await tentar(anon(`insert into orders (status) values ('paid')`))).error)
    assert.ok((await tentar(anon(`select public.admin_payment_issues()`))).error)
  })

  test('aluno não lê o registro de pagamentos nem as inconsistências; admin lê', async () => {
    const aluno = await novoAluno()
    assert.equal((await como(pg, 'authenticated', aluno.id)('select * from payment_events')).rows.length, 0)
    assert.ok((await tentar(como(pg, 'authenticated', aluno.id)('select public.admin_payment_issues()'))).error)
    assert.ok((await como(pg, 'authenticated', admin.id)('select * from payment_events')).rows.length > 0)
    const issues = (await como(pg, 'authenticated', admin.id)('select public.admin_payment_issues() as i')).rows[0].i
    assert.ok(Array.isArray(issues.alerts) && issues.alerts.length > 0)
  })

  test('aluno vê só o próprio perfil e não vira admin', async () => {
    const aluno = await novoAluno()
    const q = como(pg, 'authenticated', aluno.id)
    assert.equal((await q('select * from profiles')).rows.length, 1)
    assert.ok((await tentar(q(`update profiles set role = 'admin' where id = $1`, [aluno.id]))).error)
  })
})

describe('16. falhas temporárias e avisos fora de ordem', () => {
  test('Mercado Pago fora do ar: webhook pede nova tentativa e libera quando voltar', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total })
    mp.foraDoAr(true)
    assert.equal((await aviso(deps, pag.id)).status, 500)
    assert.equal((await pedido(p.id)).status, 'pending')
    mp.foraDoAr(false)
    assert.equal((await aviso(deps, pag.id)).status, 200)
    assert.deepEqual(await cursosDo(aluno.id), ['terra'])
  })

  test('aviso atrasado de "pendente" ou "recusado" não desfaz um pagamento aprovado', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total })
    await aviso(deps, pag.id)
    assert.equal(await db.applyPayment({ orderId: p.id, paymentId: String(pag.id), status: 'pending', amount: p.total, currency: 'BRL' }), 'ignorado:fora_de_ordem')
    assert.equal(await db.applyPayment({ orderId: p.id, paymentId: 'x1', status: 'rejected', amount: p.total, currency: 'BRL' }), 'ignorado:fora_de_ordem')
    assert.equal((await pedido(p.id)).status, 'paid')
    assert.deepEqual(await cursosDo(aluno.id), ['terra'])
  })

  test('aviso atrasado de "aprovado" não reativa um pedido estornado', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    const pag = mp.pagar({ pedido: p.id, valor: p.total })
    await aviso(deps, pag.id)
    mp.mudar(pag.id, { status: 'refunded' })
    await aviso(deps, pag.id)
    const r = await db.applyPayment({ orderId: p.id, paymentId: String(pag.id), status: 'approved', amount: p.total, currency: 'BRL' })
    assert.equal(r, 'ignorado:pedido_encerrado')
    assert.deepEqual(await cursosDo(aluno.id), [])
  })

  test('recusado e depois aprovado (nova tentativa do aluno) libera', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total, status: 'rejected' }).id)
    assert.equal((await pedido(p.id)).status, 'failed')
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total, status: 'pending' }).id)
    assert.equal((await pedido(p.id)).status, 'pending')
    await aviso(deps, mp.pagar({ pedido: p.id, valor: p.total }).id)
    assert.equal((await pedido(p.id)).status, 'paid')
  })

  test('aviso perdido: a volta para o site confere no Mercado Pago e libera (no máximo 1 consulta a cada 5 s)', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const p = await pedidoPendente(deps, aluno)
    mp.pagar({ pedido: p.id, valor: p.total }) // pago, mas o aviso nunca chegou

    const c = await conferir(deps, { orderId: p.id }, { token: aluno.token })
    assert.equal(c.corpo.status, 'paid')
    assert.deepEqual(await cursosDo(aluno.id), ['terra'])

    const p2 = await pedidoPendente(deps, aluno, 'agachamento')
    await conferir(deps, { orderId: p2.id }, { token: aluno.token })
    const buscas = mp.chamadas.searchPayments
    await conferir(deps, { orderId: p2.id }, { token: aluno.token })
    assert.equal(mp.chamadas.searchPayments, buscas, 'segunda conferência em menos de 5 s não chama o Mercado Pago')
  })

  test('conferência geral: só admin ou rotina agendada; libera pagos e corrige acesso perdido', async () => {
    const { mp, deps } = preparar()
    const aluno = await novoAluno()
    const perdido = await pedidoPendente(deps, aluno, 'agachamento')
    mp.pagar({ pedido: perdido.id, valor: perdido.total })

    assert.equal((await conferir(deps, { todos: true }, { token: aluno.token })).status, 403)
    assert.equal((await conferir(deps, { todos: true }, { headers: { 'x-conciliacao-secret': 'errado' } })).status, 401)

    const r = await conferir(deps, { todos: true }, { token: admin.token })
    assert.equal(r.status, 200)
    assert.ok(r.corpo.results.liberado >= 1, JSON.stringify(r.corpo))
    assert.deepEqual(await cursosDo(aluno.id), ['agachamento'])

    // acesso apagado por engano num pedido pago: a rotina agendada devolve
    await pg.query('delete from enrollments where user_id = $1', [aluno.id])
    const cron = await conferir(deps, { todos: true }, { headers: { 'x-conciliacao-secret': CONFIG.conciliacaoSecret } })
    assert.equal(cron.status, 200)
    assert.ok(cron.corpo.repaired >= 1)
    assert.deepEqual(await cursosDo(aluno.id), ['agachamento'])
  })
})
