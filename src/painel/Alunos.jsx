// Painel > Alunos: lista, detalhes, liberar ou remover cursos e permissão de administrador.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import EtiquetaStatus from '../componentes/EtiquetaStatus'
import { backend } from '../servicos/banco'
import { formatDate, shortId } from '../servicos/pedidos'
import { useAuth } from '../estado/hooks'
import { brl, downloadCsv, int } from './formatos'
import { useAdmin, useAsync } from './hooks'
import { Confirm, Drawer, Empty, ErrorBox, PageHead, SearchInput } from './interface'

function StudentDetail({ student, onChanged }) {
  const { notify, refreshSite } = useAdmin()
  const auth = useAuth()
  const detail = useAsync(() => backend.admin.getStudent(student.id), [student.id])
  const courses = useAsync(() => backend.admin.listCourses(), [])
  const [grantId, setGrantId] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const owned = new Set((detail.data?.enrollments ?? []).map((e) => e.course_id))
  const courseById = Object.fromEntries((courses.data ?? []).map((c) => [c.id, c]))
  const available = (courses.data ?? []).filter((c) => !owned.has(c.id))
  // "liberar todos" vale para os cursos publicados (rascunhos ficam escondidos até de quem tem acesso)
  const missing = available.filter((c) => c.published)
  const draftsLeft = available.length - missing.length
  const name = student.full_name || student.email
  const isMe = student.id === auth.user?.id

  const grantAll = async () => {
    setBusy(true)
    try {
      await backend.admin.grantCourses(
        student.id,
        missing.map((c) => c.id),
      )
      notify(`${missing.length === 1 ? 'Curso liberado' : `${missing.length} cursos liberados`} para ${name}.`)
      setConfirm(null)
      setGrantId('')
      detail.reload()
      onChanged()
      refreshSite()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const grant = async () => {
    if (!grantId) return
    setBusy(true)
    try {
      await backend.admin.grantCourse(student.id, grantId)
      notify(`Curso liberado para ${name}.`)
      setGrantId('')
      detail.reload()
      onChanged()
      refreshSite()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    setBusy(true)
    try {
      if (confirm.kind === 'revoke') {
        await backend.admin.revokeCourse(student.id, confirm.course.id)
        notify('Acesso ao curso removido.')
        detail.reload()
      } else {
        await backend.admin.setRole(student.id, confirm.role)
        notify(confirm.role === 'admin' ? 'Agora essa pessoa é administradora.' : 'Permissão de administrador removida.')
      }
      setConfirm(null)
      onChanged()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="detail">
      <dl className="detail__list">
        <div>
          <dt>E-mail</dt>
          <dd>
            {student.email}
            <span>{student.confirmed ? 'E-mail confirmado' : 'E-mail ainda não confirmado'}</span>
          </dd>
        </div>
        {student.phone && (
          <div>
            <dt>WhatsApp</dt>
            <dd>
              <a href={`https://wa.me/55${student.phone}`} target="_blank" rel="noreferrer">
                {student.phone}
              </a>
            </dd>
          </div>
        )}
        <div>
          <dt>Cadastro</dt>
          <dd>{formatDate(student.created_at)}</dd>
        </div>
        <div>
          <dt>Total gasto</dt>
          <dd>{brl(student.spent)}</dd>
        </div>
      </dl>

      <h3 className="detail__title">Cursos ({owned.size})</h3>
      <ErrorBox error={detail.error} onRetry={detail.reload} />
      {detail.data?.enrollments?.length === 0 && <p className="detail__muted">Nenhum curso liberado.</p>}
      <ul className="detail__items">
        {(detail.data?.enrollments ?? []).map((e) => (
          <li key={e.course_id}>
            <span>
              {courseById[e.course_id]?.title ?? 'Curso removido'}
              <small>{e.order_id ? `Pedido #${shortId(e.order_id)}` : 'Liberado manualmente'}</small>
            </span>
            <button
              type="button"
              className="xicon-btn xicon-btn--danger"
              onClick={() => setConfirm({ kind: 'revoke', course: courseById[e.course_id] ?? { id: e.course_id, title: 'este curso' } })}
              aria-label="Remover acesso"
              title="Remover acesso"
            >
              <Icone name="x" size={16} />
            </button>
          </li>
        ))}
      </ul>

      {courses.data && (
        <div className="grant-box">
          {available.length > 0 ? (
            <>
              <div className="grant">
                <select className="xselect" value={grantId} onChange={(e) => setGrantId(e.target.value)} aria-label="Curso para liberar">
                  <option value="">Liberar um curso...</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {!c.published ? ' (rascunho)' : ''}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn--outline btn--sm" onClick={grant} disabled={!grantId || busy}>
                  <Icone name="plus" size={15} /> Liberar
                </button>
              </div>
              {missing.length > 1 && (
                <button type="button" className="btn btn--primary btn--sm grant-all" onClick={() => setConfirm({ kind: 'all' })} disabled={busy}>
                  <Icone name="checkCircle" size={15} /> Liberar todos os cursos ({missing.length})
                </button>
              )}
              {draftsLeft > 0 && (
                <p className="detail__muted">
                  {draftsLeft === 1 ? '1 curso em rascunho fica' : `${draftsLeft} cursos em rascunho ficam`} de fora do "liberar todos".
                  Libere {draftsLeft === 1 ? 'ele' : 'eles'} pela lista acima se quiser.
                </p>
              )}
            </>
          ) : (
            <p className="grant-done">
              <Icone name="checkCircle" size={16} /> {name} já tem acesso a todos os cursos.
            </p>
          )}
        </div>
      )}

      <h3 className="detail__title">Pedidos</h3>
      {detail.data?.orders?.length === 0 && <p className="detail__muted">Nenhum pedido.</p>}
      <ul className="detail__items">
        {(detail.data?.orders ?? []).map((o) => (
          <li key={o.id}>
            <span>
              #{shortId(o.id)} · {o.order_items.map((i) => i.title).join(', ')}
              <small>{formatDate(o.created_at)}</small>
            </span>
            <span className="detail__right">
              <strong>{brl(o.total)}</strong>
              <EtiquetaStatus status={o.status} />
            </span>
          </li>
        ))}
      </ul>

      <h3 className="detail__title">Permissão</h3>
      <div className="role-box">
        <p>
          {student.role === 'admin' ? (
            <>
              <Icone name="shield" size={16} /> <strong>Administrador:</strong> acessa este painel.
            </>
          ) : (
            <>
              <Icone name="user" size={16} /> <strong>Aluno:</strong> acessa só os próprios cursos.
            </>
          )}
        </p>
        {student.role === 'admin' ? (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirm({ kind: 'role', role: 'student' })}>
            Remover de administrador
          </button>
        ) : (
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirm({ kind: 'role', role: 'admin' })}>
            Tornar administrador
          </button>
        )}
      </div>

      <Confirm
        open={!!confirm}
        title={
          confirm?.kind === 'all'
            ? `Liberar todos os cursos para ${name}?`
            : confirm?.kind === 'revoke'
            ? `Remover o acesso a "${confirm.course.title}"?`
            : confirm?.role === 'admin'
              ? 'Tornar esta pessoa administradora?'
              : isMe
                ? 'Remover o SEU acesso de administrador?'
                : 'Remover a permissão de administrador?'
        }
        text={
          confirm?.kind === 'all'
            ? `${missing.length} cursos serão liberados sem cobrança: ${missing.map((c) => c.title).join(', ')}. Cursos criados depois não entram automaticamente.`
            : confirm?.kind === 'revoke'
            ? 'O aluno deixa de ver as aulas deste curso. O pedido continua registrado.'
            : confirm?.role === 'admin'
              ? 'Ela vai poder ver vendas, alunos e editar cursos, preços e configurações. Só faça isso com pessoas de confiança.'
              : isMe
                ? 'Você sai do painel na hora. Outro administrador precisa existir para isso funcionar.'
                : 'A pessoa volta a ser aluna e perde o acesso ao painel.'
        }
        confirmLabel={confirm?.kind === 'all' ? 'Liberar todos' : confirm?.kind === 'revoke' ? 'Remover acesso' : 'Confirmar'}
        tone={confirm?.role === 'admin' || confirm?.kind === 'all' ? 'primary' : 'danger'}
        busy={busy}
        onConfirm={confirm?.kind === 'all' ? grantAll : run}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

export default function Alunos() {
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [openId, setOpenId] = useState(null)
  const list = useAsync(() => backend.admin.listStudents(term), [term])
  const people = list.data ?? []
  const open = people.find((p) => p.id === openId)

  const exportCsv = () =>
    downloadCsv(`alunos-homefit-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Nome', 'E-mail', 'WhatsApp', 'Cadastro', 'Cursos', 'Total gasto', 'Papel'],
      ...people.map((p) => [
        p.full_name,
        p.email,
        p.phone,
        formatDate(p.created_at, false),
        p.courses,
        Number(p.spent).toFixed(2).replace('.', ','),
        p.role === 'admin' ? 'Administrador' : 'Aluno',
      ]),
    ])

  return (
    <>
      <PageHead
        title="Alunos"
        subtitle="Quem tem conta, quais cursos tem e quanto já comprou."
        actions={
          <button type="button" className="btn btn--outline" onClick={exportCsv} disabled={!people.length}>
            <Icone name="download" size={17} /> Exportar planilha
          </button>
        }
      />

      <form
        className="xfilters"
        onSubmit={(e) => {
          e.preventDefault()
          setTerm(search.trim())
        }}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Nome ou e-mail" />
        <button type="submit" className="btn btn--outline btn--sm">
          Buscar
        </button>
        {term && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => {
              setSearch('')
              setTerm('')
            }}
          >
            Limpar
          </button>
        )}
      </form>

      <ErrorBox error={list.error} onRetry={list.reload} />

      <section className={`acardx ${list.loading ? 'is-busy' : ''}`}>
        {list.firstLoad ? (
          <div className="xtable-skeleton" />
        ) : people.length === 0 ? (
          <Empty icon="users" title="Nenhum aluno encontrado" text={term ? 'Tente outro nome ou e-mail.' : 'Os alunos aparecem aqui quando criarem a conta.'} />
        ) : (
          <div className="xtable-wrap">
            <table className="xtable xtable--click">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Cadastro</th>
                  <th className="num">Cursos</th>
                  <th className="num">Total gasto</th>
                  <th>Último pedido</th>
                  <th>Papel</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} onClick={() => setOpenId(p.id)}>
                    <td>
                      <button type="button" className="linklike cell-main" onClick={() => setOpenId(p.id)}>
                        {p.full_name || 'Sem nome'}
                      </button>
                      <span className="cell-sub">
                        {p.email}
                        {!p.confirmed && <em className="xbadge xbadge--warn">não confirmado</em>}
                      </span>
                    </td>
                    <td>{formatDate(p.created_at, false)}</td>
                    <td className="num">{int(p.courses)}</td>
                    <td className="num">{brl(p.spent)}</td>
                    <td>{p.last_order ? formatDate(p.last_order, false) : 'Nenhum'}</td>
                    <td>{p.role === 'admin' ? <em className="xbadge xbadge--blue">Admin</em> : 'Aluno'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer
        open={!!open}
        title={open ? open.full_name || open.email : ''}
        subtitle={open?.role === 'admin' ? 'Administrador' : 'Aluno'}
        onClose={() => setOpenId(null)}
        wide
      >
        {open && <StudentDetail key={open.id} student={open} onChanged={list.reload} />}
      </Drawer>
    </>
  )
}
