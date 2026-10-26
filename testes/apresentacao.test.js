/*
  Testes da apresentação do curso (0006_apresentacao_do_curso.sql): o vídeo é aberto para
  todos, mas só o arquivo atual de um curso publicado; as aulas continuam protegidas.
  Rodar: npm test
*/
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { como, criarBancoDeTeste, criarUsuario, idDoCurso, tentar } from './apoio/banco-de-teste.js'

let pg
let admin
let aluno
let terra
let agach

before(async () => {
  pg = await criarBancoDeTeste()
  admin = await criarUsuario(pg, 'gabrielooopi98@gmail.com', { nome: 'Dono' })
  aluno = await criarUsuario(pg, 'aluno-apresentacao@teste.com', { nome: 'Aluno' })
  terra = await idDoCurso(pg, 'terra')
  agach = await idDoCurso(pg, 'agachamento')
})

const arquivo = (curso, nome) => `courses/${curso}/apresentacao/${nome}`
const guardar = (nome) => pg.query(`insert into storage.objects (bucket_id, name) values ('lesson-videos', $1)`, [nome])
const visiveis = async (papel, usuario, padrao) =>
  (await como(pg, papel, usuario)(`select name from storage.objects where bucket_id = 'lesson-videos' and name like $1 order by name`, [padrao])).rows.map(
    (r) => r.name.split('/').pop(),
  )

describe('apresentação do curso', () => {
  test('o curso tem o campo da apresentação, vazio por padrão e público', async () => {
    const r = (await como(pg, 'anon')('select intro_video_url from courses where id = $1', [terra])).rows[0]
    assert.equal(r.intro_video_url, '')
  })

  test('só o admin define a apresentação', async () => {
    const tentativa = await tentar(como(pg, 'authenticated', aluno)(`update courses set intro_video_url = 'https://youtu.be/xxxxxxxxxxx' where id = $1`, [terra]))
    assert.equal(tentativa.affected, 0)
    const r = await como(pg, 'authenticated', admin)(`update courses set intro_video_url = 'https://www.youtube-nocookie.com/embed/abcdefghijk' where id = $1`, [terra])
    assert.equal(r.affected, 1)
    assert.equal((await como(pg, 'anon')('select intro_video_url from courses where id = $1', [terra])).rows[0].intro_video_url.includes('abcdefghijk'), true)
  })

  test('arquivo enviado: visitante vê só o arquivo atual da apresentação, sem erro', async () => {
    const atual = arquivo(agach, 'atual.mp4')
    await guardar(atual)
    await guardar(arquivo(agach, 'antigo.mp4'))
    await pg.query(`update courses set intro_video_url = $1 where id = $2`, [`storage:lesson-videos/${atual}`, agach])

    const r = await tentar(como(pg, 'anon')(`select name from storage.objects where bucket_id = 'lesson-videos' and name like $1`, [`courses/${agach}/apresentacao/%`]))
    assert.equal(r.error, null)
    assert.deepEqual(r.rows.map((x) => x.name.split('/').pop()), ['atual.mp4'])
    assert.deepEqual(await visiveis('authenticated', aluno, `courses/${agach}/apresentacao/%`), ['atual.mp4'], 'aluno sem compra também vê')
  })

  test('curso não publicado: a apresentação não abre para o público', async () => {
    await pg.query('update courses set published = false where id = $1', [agach])
    try {
      assert.deepEqual(await visiveis('anon', null, `courses/${agach}/apresentacao/%`), [])
      assert.deepEqual(await visiveis('authenticated', admin, `courses/${agach}/apresentacao/%`), ['antigo.mp4', 'atual.mp4'], 'admin vê tudo')
    } finally {
      await pg.query('update courses set published = true where id = $1', [agach])
    }
  })

  test('a pasta da apresentação não abre os vídeos das aulas', async () => {
    const aula = (await pg.query('select id from lessons where course_id = $1 limit 1', [agach])).rows[0].id
    await guardar(`courses/${agach}/${aula}/aula.mp4`)
    // mesmo apontando a apresentação para o arquivo de uma aula, a aula continua fechada
    await pg.query(`update courses set intro_video_url = $1 where id = $2`, [`storage:lesson-videos/courses/${agach}/${aula}/aula.mp4`, agach])
    assert.deepEqual(await visiveis('anon', null, `courses/${agach}/${aula}/%`), [])
  })
})
