/*
  Testes da proteção contra "assistir tudo e pedir reembolso" (0005_protecao_reembolso.sql):
  liberação gradual, registro das aulas abertas, link do vídeo e números do painel.
  Rodam no banco de verdade (PGlite com as migrações). Rodar: npm test
*/
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, describe, test } from 'node:test'
import { bancoDasFuncoes, como, criarBancoDeTeste, criarUsuario, idDoCurso, tentar } from './apoio/banco-de-teste.js'

let pg
let db
let admin
const cursos = {}

before(async () => {
  pg = await criarBancoDeTeste()
  db = bancoDasFuncoes(pg)
  for (const slug of ['terra', 'agachamento', 'fundamentos']) cursos[slug] = await idDoCurso(pg, slug)
  admin = await criarUsuario(pg, 'gabrielooopi98@gmail.com', { nome: 'Dono' })
})

// ---------- ajudantes ----------
const novoAluno = (nome = 'aluno') => criarUsuario(pg, `${nome}-${randomUUID().slice(0, 8)}@teste.com`, { nome })

// compra paga pelo Mercado Pago (como o webhook faria), com a data do pagamento ajustável
async function comprar(aluno, { slug, combo = false, diasAtras = 0, cupom = null } = {}) {
  const pedido = await db.createOrder({
    userId: aluno,
    courseIds: combo ? null : [cursos[slug]],
    combo,
    coupon: cupom,
    payerName: 'Aluno',
    payerEmail: 'a@a.com',
  })
  const r = await db.applyPayment({
    orderId: pedido.id,
    paymentId: String(Date.now()) + Math.floor(Math.random() * 1e6),
    status: 'approved',
    amount: Number(pedido.total),
    currency: 'BRL',
  })
  assert.equal(r, 'liberado')
  if (diasAtras) await voltarNoTempo(pedido.id, diasAtras)
  return pedido.id
}
// estorno do mesmo pagamento que pagou o pedido (como o Mercado Pago avisa)
async function estornar(pedidoId) {
  const { payment_id } = (await pg.query('select payment_id from orders where id = $1', [pedidoId])).rows[0]
  assert.equal(await db.applyPayment({ orderId: pedidoId, paymentId: payment_id, status: 'refunded', amount: 0, currency: 'BRL' }), 'acesso_removido')
}
async function voltarNoTempo(pedidoId, dias) {
  await pg.query(`update orders set paid_at = paid_at - make_interval(days => $2), created_at = created_at - make_interval(days => $2) where id = $1`, [
    pedidoId,
    dias,
  ])
}
// aulas do curso por módulo, na ordem: [[aulas do módulo 1], [módulo 2], ...]
async function modulosDo(slug) {
  const r = await pg.query(
    `select m.id as modulo, l.id as aula from modules m join lessons l on l.module_id = m.id
     where m.course_id = $1 order by m.position, l.position`,
    [cursos[slug]],
  )
  const grupos = new Map()
  for (const row of r.rows) grupos.set(row.modulo, [...(grupos.get(row.modulo) ?? []), row.aula])
  return [...grupos.values()]
}
const abrir = (aluno, aula) => tentar(como(pg, 'authenticated', aluno)('select public.open_lesson($1) as r', [aula]))
const resultado = async (aluno, aula) => {
  const r = await abrir(aluno, aula)
  return r.error ? { erro: r.error } : r.rows[0].r
}
const diasAte = (iso) => Math.round((Date.parse(iso) - Date.now()) / 864e5) || 0
const comConfig = async (campos, fn) => {
  const antes = (await pg.query('select drip_enabled, drip_days from settings where id = 1')).rows[0]
  await pg.query('update settings set drip_enabled = $1, drip_days = $2 where id = 1', [campos.drip_enabled ?? antes.drip_enabled, campos.drip_days ?? antes.drip_days])
  try {
    await fn()
  } finally {
    await pg.query('update settings set drip_enabled = $1, drip_days = $2 where id = 1', [antes.drip_enabled, antes.drip_days])
  }
}

// =============================================================================
describe('liberação gradual', () => {
  test('compra paga: 1º módulo na hora, os outros fechados, o último só no 8º dia', async () => {
    const aluno = await novoAluno()
    await comprar(aluno, { slug: 'terra' })
    const mods = await modulosDo('terra')
    assert.ok(mods.length >= 3, 'curso de teste com 3 ou mais módulos')

    assert.equal((await resultado(aluno, mods[0][0])).locked, false)
    const segundo = await resultado(aluno, mods[1][0])
    assert.equal(segundo.locked, true)
    assert.ok(segundo.unlock_at && diasAte(segundo.unlock_at) > 0)
    const ultimo = await resultado(aluno, mods.at(-1)[0])
    assert.equal(ultimo.locked, true)
    assert.equal(diasAte(ultimo.unlock_at), 8, 'curso inteiro só depois do prazo de 7 dias')
    assert.equal(ultimo.video_url, undefined, 'aula fechada não entrega vídeo')
  })

  test('módulos espaçados por igual entre o dia 0 e o último dia', async () => {
    const aluno = await novoAluno()
    await comprar(aluno, { slug: 'terra' })
    const mods = await modulosDo('terra')
    const datas = (await como(pg, 'authenticated', aluno)('select module_id, unlock_at from public.my_course_unlocks($1)', [cursos.terra])).rows
    const porModulo = new Map(datas.map((d) => [d.module_id, d.unlock_at]))
    const ids = (await pg.query('select id from modules where course_id = $1 order by position', [cursos.terra])).rows.map((r) => r.id)
    const dias = ids.map((id) => diasAte(new Date(porModulo.get(id)).toISOString()))
    const n = mods.length
    assert.deepEqual(
      dias,
      ids.map((_, i) => (n <= 1 ? 0 : Math.round((i * 8) / (n - 1)))),
    )
  })

  test('com o tempo passando, tudo libera (8 dias depois do pagamento)', async () => {
    const aluno = await novoAluno()
    await comprar(aluno, { slug: 'terra', diasAtras: 8 })
    for (const modulo of await modulosDo('terra')) assert.equal((await resultado(aluno, modulo[0])).locked, false)
  })

  test('liberação gradual desligada no painel: tudo na hora', async () => {
    await comConfig({ drip_enabled: false }, async () => {
      const aluno = await novoAluno()
      await comprar(aluno, { slug: 'agachamento' })
      for (const modulo of await modulosDo('agachamento')) assert.equal((await resultado(aluno, modulo[0])).locked, false)
    })
  })

  test('o número de dias vem do painel', async () => {
    await comConfig({ drip_days: 14 }, async () => {
      const aluno = await novoAluno()
      await comprar(aluno, { slug: 'agachamento' })
      const mods = await modulosDo('agachamento')
      assert.equal(diasAte((await resultado(aluno, mods.at(-1)[0])).unlock_at), 14)
    })
  })

  test('curso dado pelo admin, compra de teste e cupom de 100% ficam liberados por completo', async () => {
    const mods = await modulosDo('fundamentos')
    const ultimo = mods.at(-1)[0]

    const dado = await novoAluno()
    await como(pg, 'authenticated', admin)('insert into enrollments (user_id, course_id) values ($1, $2)', [dado, cursos.fundamentos])
    assert.equal((await resultado(dado, ultimo)).locked, false)

    await pg.query('update settings set test_mode = true')
    try {
      await como(pg, 'authenticated', admin)('select public.create_test_order(array[$1]::uuid[])', [cursos.fundamentos])
    } finally {
      await pg.query('update settings set test_mode = false')
    }
    assert.equal((await resultado(admin, ultimo)).locked, false)

    await pg.query(`insert into coupons (code, kind, value) values ('GRATIS100', 'percent', 100) on conflict do nothing`)
    const gratis = await novoAluno()
    const pedido = await db.createOrder({ userId: gratis, courseIds: [cursos.fundamentos], combo: false, coupon: 'GRATIS100', payerName: '', payerEmail: '' })
    await db.applyPayment({ orderId: pedido.id, paymentId: `gratis-${pedido.id}`, status: 'approved', amount: 0, currency: 'BRL', source: 'free' })
    assert.equal((await resultado(gratis, ultimo)).locked, false)
  })

  test('aula de prévia grátis abre para qualquer um, até sem login', async () => {
    const mods = await modulosDo('terra')
    const previa = mods.at(-1)[0]
    await pg.query('update lessons set is_preview = true where id = $1', [previa])
    try {
      assert.equal((await tentar(como(pg, 'anon')('select public.open_lesson($1) as r', [previa]))).rows[0].r.locked, false)
      const aluno = await novoAluno()
      await comprar(aluno, { slug: 'terra' })
      assert.equal((await resultado(aluno, previa)).locked, false)
    } finally {
      await pg.query('update lessons set is_preview = false where id = $1', [previa])
    }
  })

  test('quem não comprou não abre nenhuma aula (nem a do 1º módulo)', async () => {
    const aluno = await novoAluno()
    const mods = await modulosDo('terra')
    assert.match((await resultado(aluno, mods[0][0])).erro, /não tem acesso/)
    assert.match((await tentar(como(pg, 'anon')('select public.open_lesson($1)', [mods[0][0]]))).error, /não tem acesso/)
  })

  test('estorno de um pedido e acesso refeito por outro pedido mantêm a data do pagamento antigo', async () => {
    const aluno = await novoAluno()
    const avulso = await comprar(aluno, { slug: 'terra', diasAtras: 2 })
    await comprar(aluno, { combo: true, diasAtras: 20 })
    await estornar(avulso)
    // o curso volta pelo combo, pago há 20 dias: tudo liberado, sem recomeçar a contagem
    const mods = await modulosDo('terra')
    assert.equal((await resultado(aluno, mods.at(-1)[0])).locked, false)
  })
})

describe('registro das aulas abertas e link do vídeo', () => {
  test('abrir a aula registra; abrir de novo soma; o aluno não grava o registro direto', async () => {
    const aluno = await novoAluno()
    await comprar(aluno, { slug: 'terra' })
    const aula = (await modulosDo('terra'))[0][0]
    await resultado(aluno, aula)
    await resultado(aluno, aula)
    const v = (await pg.query('select views from lesson_views where user_id = $1 and lesson_id = $2', [aluno, aula])).rows[0]
    assert.equal(v.views, 2)

    const q = como(pg, 'authenticated', aluno)
    const outra = (await modulosDo('terra'))[1][0]
    assert.ok((await tentar(q('insert into lesson_views (user_id, lesson_id, course_id) values ($1, $2, $3)', [aluno, outra, cursos.terra]))).error)
    assert.ok((await tentar(q('update lesson_views set last_viewed_at = now() + interval \'1 day\''))).error)
    assert.ok((await tentar(q('delete from lesson_views'))).error)
  })

  test('aula fechada não é registrada como aberta', async () => {
    const aluno = await novoAluno()
    await comprar(aluno, { slug: 'terra' })
    await resultado(aluno, (await modulosDo('terra')).at(-1)[0])
    assert.equal((await pg.query('select count(*)::int as n from lesson_views where user_id = $1', [aluno])).rows[0].n, 0)
  })

  test('arquivo do vídeo: só depois de abrir a aula, só nos 10 minutos seguintes e só se ela estiver liberada', async () => {
    const aluno = await novoAluno()
    await comprar(aluno, { slug: 'agachamento' })
    const mods = await modulosDo('agachamento')
    const [aberta, fechada] = [mods[0][0], mods.at(-1)[0]]
    for (const aula of [aberta, fechada]) {
      await pg.query(`insert into storage.objects (bucket_id, name) values ('lesson-videos', $1)`, [`courses/${cursos.agachamento}/${aula}/v.mp4`])
    }
    const arquivos = async () =>
      (await como(pg, 'authenticated', aluno)(`select name from storage.objects where bucket_id = 'lesson-videos' and name like $1`, [`courses/${cursos.agachamento}/%`])).rows.map(
        (r) => r.name.split('/')[2],
      )

    assert.deepEqual(await arquivos(), [])
    await resultado(aluno, aberta)
    await resultado(aluno, fechada)
    assert.deepEqual(await arquivos(), [aberta], 'só o da aula liberada e aberta')

    await pg.query(`update lesson_views set last_viewed_at = now() - interval '11 minutes' where user_id = $1`, [aluno])
    assert.deepEqual(await arquivos(), [], 'link novo exige abrir a aula de novo')
  })

  test('visitante: a regra do Storage não dá erro, a prévia grátis abre e o resto não', async () => {
    const mods = await modulosDo('fundamentos')
    const [previa, fechada] = [mods.at(-1)[0], mods.at(-1)[1] ?? mods[0][0]]
    for (const aula of [previa, fechada]) {
      await pg.query(`insert into storage.objects (bucket_id, name) values ('lesson-videos', $1)`, [`courses/${cursos.fundamentos}/${aula}/visitante.mp4`])
    }
    await pg.query(`insert into storage.objects (bucket_id, name) values ('course-images', 'capa-visitante.webp')`)
    await pg.query('update lessons set is_preview = true where id = $1', [previa])
    try {
      const r = await tentar(como(pg, 'anon')(`select bucket_id, name from storage.objects where name like '%visitante%'`))
      assert.equal(r.error, null, 'ler o Storage como visitante não pode dar erro')
      assert.deepEqual(
        r.rows.map((x) => x.name.split('/')[2]),
        [previa],
      )
    } finally {
      await pg.query('update lessons set is_preview = false where id = $1', [previa])
    }
  })

  test('depois do estorno, nada abre (nem com um registro recente)', async () => {
    const aluno = await novoAluno()
    const pedido = await comprar(aluno, { slug: 'fundamentos' })
    const aula = (await modulosDo('fundamentos'))[0][0]
    await pg.query(`insert into storage.objects (bucket_id, name) values ('lesson-videos', $1)`, [`courses/${cursos.fundamentos}/${aula}/x.mp4`])
    await resultado(aluno, aula)
    await estornar(pedido)

    assert.match((await resultado(aluno, aula)).erro, /não tem acesso/)
    const r = await como(pg, 'authenticated', aluno)(`select 1 from storage.objects where name like $1`, [`courses/${cursos.fundamentos}/${aula}/%`])
    assert.equal(r.rows.length, 0)
  })

  test('não dá para marcar como concluída uma aula ainda fechada', async () => {
    const aluno = await novoAluno()
    await comprar(aluno, { slug: 'terra' })
    const mods = await modulosDo('terra')
    const q = como(pg, 'authenticated', aluno)
    assert.equal((await tentar(q('insert into lesson_progress (user_id, lesson_id) values ($1, $2)', [aluno, mods[0][0]]))).error, null)
    assert.ok((await tentar(q('insert into lesson_progress (user_id, lesson_id) values ($1, $2)', [aluno, mods.at(-1)[0]]))).error)
  })

  test('o link do vídeo não é lido direto da tabela (só pelo admin)', async () => {
    const aluno = await novoAluno()
    await comprar(aluno, { slug: 'terra' })
    const aula = (await modulosDo('terra'))[0][0]
    await pg.query(`insert into lesson_media (lesson_id, course_id, video_url) values ($1, $1, 'https://player/x') on conflict (lesson_id) do update set video_url = excluded.video_url`, [aula])
    assert.equal((await como(pg, 'authenticated', aluno)('select * from lesson_media')).rows.length, 0)
    assert.ok((await como(pg, 'authenticated', admin)('select * from lesson_media')).rows.length > 0)
    assert.equal((await resultado(aluno, aula)).video_url, 'https://player/x')
  })
})

describe('painel: uso dos cursos e reembolsos', () => {
  test('mostra quantas aulas o aluno abriu no pedido e quantos reembolsos ele já teve', async () => {
    const aluno = await novoAluno()
    // compra antiga, quase toda assistida e estornada
    const antigo = await comprar(aluno, { slug: 'fundamentos', diasAtras: 30 })
    for (const modulo of await modulosDo('fundamentos')) for (const aula of modulo) await resultado(aluno, aula)
    await estornar(antigo)

    const novo = await comprar(aluno, { slug: 'terra' })
    const [m1] = await modulosDo('terra')
    for (const aula of m1) await resultado(aluno, aula)

    const c = (await como(pg, 'authenticated', admin)('select public.admin_order_consumption($1) as c', [novo])).rows[0].c
    const totalTerra = (await pg.query('select count(*)::int as n from lessons where course_id = $1', [cursos.terra])).rows[0].n
    assert.equal(Number(c.lessons_total), totalTerra)
    assert.equal(Number(c.lessons_opened), m1.length)
    assert.equal(Number(c.refunds), 1)
    assert.equal(Number(c.refunds_with_access), 1, 'reembolso depois de assistir metade ou mais')
    assert.ok(c.first_view && c.last_view)

    const contagem = (await como(pg, 'authenticated', admin)('select * from public.admin_refund_counts()')).rows
    assert.equal(Number(contagem.find((r) => r.user_id === aluno).refunds), 1)
  })

  test('aulas abertas antes do pedido não contam para ele', async () => {
    const aluno = await novoAluno()
    await como(pg, 'authenticated', admin)('insert into enrollments (user_id, course_id) values ($1, $2)', [aluno, cursos.agachamento])
    await resultado(aluno, (await modulosDo('agachamento'))[0][0])
    await pg.query(`update lesson_views set first_viewed_at = now() - interval '1 day' where user_id = $1`, [aluno])
    await como(pg, 'authenticated', admin)('delete from enrollments where user_id = $1', [aluno])
    const pedido = await comprar(aluno, { slug: 'agachamento' })
    const c = (await como(pg, 'authenticated', admin)('select public.admin_order_consumption($1) as c', [pedido])).rows[0].c
    assert.equal(Number(c.lessons_opened), 0)
  })

  test('só o admin vê esses números e o registro de outros alunos', async () => {
    const aluno = await novoAluno()
    const outro = await novoAluno()
    const pedido = await comprar(aluno, { slug: 'terra' })
    await resultado(aluno, (await modulosDo('terra'))[0][0])
    const q = como(pg, 'authenticated', outro)
    assert.ok((await tentar(q('select public.admin_order_consumption($1)', [pedido]))).error)
    assert.ok((await tentar(q('select * from public.admin_refund_counts()'))).error)
    assert.equal((await q('select * from lesson_views where user_id = $1', [aluno])).rows.length, 0)
    assert.equal((await como(pg, 'authenticated', aluno)('select * from lesson_views')).rows.length, 1, 'o aluno vê o próprio registro')
    assert.ok((await tentar(como(pg, 'anon')('select * from lesson_views'))).error)
  })
})
