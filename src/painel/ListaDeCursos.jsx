// Painel > Cursos: lista, ordem no site, publicar e excluir.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import { img } from '../dados/site'
import { backend } from '../servicos/banco'
import { brl, int } from './formatos'
import { useAdmin, useAsync } from './hooks'
import { Confirm, Empty, ErrorBox, PageHead, SearchInput, Segmented, Toggle } from './interface'

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'published', label: 'Publicados' },
  { id: 'draft', label: 'Rascunhos' },
]

export default function ListaDeCursos() {
  const { notify, refreshSite } = useAdmin()
  const list = useAsync(() => backend.admin.listCourses(), [])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const courses = list.data ?? []
  const q = search.trim().toLowerCase()
  const visible = courses.filter(
    (c) =>
      (filter === 'all' || (filter === 'published' ? c.published : !c.published)) &&
      (!q || c.title.toLowerCase().includes(q) || c.slug.includes(q) || c.tag.toLowerCase().includes(q)),
  )

  const togglePublished = async (course) => {
    setBusyId(course.id)
    try {
      await backend.admin.saveCourse({ ...course, published: !course.published })
      list.mutate((cs) => cs.map((c) => (c.id === course.id ? { ...c, published: !c.published } : c)))
      notify(course.published ? `"${course.title}" saiu do site (rascunho).` : `"${course.title}" está publicado no site.`)
      refreshSite()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  // sobe/desce um curso na ordem do site (renumera todos para não deixar posições repetidas)
  const move = async (course, dir) => {
    const ordered = courses.slice()
    const i = ordered.findIndex((c) => c.id === course.id)
    const j = i + dir
    if (j < 0 || j >= ordered.length) return
    ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
    const positions = ordered.map((c, k) => ({ id: c.id, position: k + 1 }))
    list.mutate(ordered.map((c, k) => ({ ...c, position: k + 1 })))
    try {
      await backend.admin.setCoursePositions(positions)
      refreshSite()
    } catch (e) {
      notify(e.message, 'error')
      list.reload()
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await backend.admin.deleteCourse(toDelete.id)
      list.mutate((cs) => cs.filter((c) => c.id !== toDelete.id))
      notify(`"${toDelete.title}" foi excluído.`)
      setToDelete(null)
      refreshSite()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHead
        title="Cursos"
        subtitle="Crie, edite, publique e organize os cursos e as aulas."
        actions={
          <a href="#/admin/cursos/novo" className="btn btn--primary">
            <Icone name="plus" size={18} /> Novo curso
          </a>
        }
      />

      <div className="xfilters">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar curso..." />
        <Segmented label="Situação" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <ErrorBox error={list.error} onRetry={list.reload} />

      <section className={`acardx ${list.loading ? 'is-busy' : ''}`}>
        {list.firstLoad ? (
          <div className="xtable-skeleton" />
        ) : visible.length === 0 ? (
          <Empty
            icon="book"
            title={courses.length ? 'Nenhum curso encontrado' : 'Nenhum curso ainda'}
            text={courses.length ? 'Tente outra busca ou filtro.' : 'Crie o primeiro curso para começar a vender.'}
            action={
              !courses.length && (
                <a href="#/admin/cursos/novo" className="btn btn--primary">
                  <Icone name="plus" size={18} /> Criar curso
                </a>
              )
            }
          />
        ) : (
          <div className="xtable-wrap">
            <table className="xtable xtable--courses">
              <thead>
                <tr>
                  <th className="col-order">
                    <span className="sr-only">Ordem</span>
                  </th>
                  <th>Curso</th>
                  <th>Nível</th>
                  <th className="num">Preço</th>
                  <th className="num">Aulas</th>
                  <th className="num">Alunos</th>
                  <th>No site</th>
                  <th className="col-actions">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const idx = courses.findIndex((x) => x.id === c.id)
                  const off = c.oldPrice > c.price ? Math.round((1 - c.price / c.oldPrice) * 100) : 0
                  return (
                    <tr key={c.id}>
                      <td className="col-order">
                        <div className="order-btns">
                          <button type="button" onClick={() => move(c, -1)} disabled={idx === 0 || !!q || filter !== 'all'} aria-label={`Subir ${c.title}`}>
                            <Icone name="chevronUp" size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(c, 1)}
                            disabled={idx === courses.length - 1 || !!q || filter !== 'all'}
                            aria-label={`Descer ${c.title}`}
                          >
                            <Icone name="chevronDown" size={16} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <a href={`#/admin/cursos/${c.id}`} className="course-cell">
                          <span className="course-cell__thumb">{c.image ? <img src={img(c.image, 160)} alt="" /> : <Icone name="image" size={18} />}</span>
                          <span>
                            <span className="cell-main">{c.title}</span>
                            <span className="cell-sub">
                              /{c.slug}
                              {c.bestseller && <em className="xbadge">Mais vendido</em>}
                            </span>
                          </span>
                        </a>
                      </td>
                      <td>{c.level}</td>
                      <td className="num">
                        <span className="cell-main">{brl(c.price)}</span>
                        {off > 0 && (
                          <span className="cell-sub">
                            <s>{brl(c.oldPrice)}</s> <em className="xbadge xbadge--good">-{off}%</em>
                          </span>
                        )}
                      </td>
                      <td className="num">
                        {int(c.lessonCount)}
                        <span className="cell-sub">{int(c.moduleCount)} módulos</span>
                      </td>
                      <td className="num">{int(c.studentCount)}</td>
                      <td>
                        <Toggle
                          checked={c.published}
                          onChange={() => togglePublished(c)}
                          disabled={busyId === c.id}
                          label={c.published ? 'Publicado' : 'Rascunho'}
                        />
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <a href={`#/admin/cursos/${c.id}`} className="xicon-btn" aria-label={`Editar ${c.title}`} title="Editar">
                            <Icone name="edit" size={17} />
                          </a>
                          <button type="button" className="xicon-btn xicon-btn--danger" onClick={() => setToDelete(c)} aria-label={`Excluir ${c.title}`} title="Excluir">
                            <Icone name="trash" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Confirm
        open={!!toDelete}
        title={`Excluir "${toDelete?.title}"?`}
        text={
          <>
            <p>Os módulos, as aulas e os vídeos deste curso também serão apagados. Isso não tem volta.</p>
            {toDelete?.studentCount > 0 && (
              <p className="xwarn">
                <Icone name="alert" size={16} /> {int(toDelete.studentCount)} aluno(s) têm este curso e vão perder o acesso.
                Se quiser só tirar do site, use o botão "No site" (rascunho).
              </p>
            )}
          </>
        }
        confirmLabel="Excluir curso"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
