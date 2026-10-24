// Minha conta (#/minha-conta): dados pessoais, troca de senha e pedidos.
import { useEffect, useState } from 'react'
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import { EsqueletoCartoes } from '../componentes/Esqueletos'
import EtiquetaStatus from '../componentes/EtiquetaStatus'
import { formatBRL } from '../dados/site'
import { backend } from '../servicos/banco'
import { formatDate, shortId } from '../servicos/pedidos'
import { passwordScore } from '../servicos/senha'
import { useAuth } from '../estado/hooks'

const digits = (v) => v.replace(/\D/g, '')
const maskPhone = (v) => {
  const d = digits(v).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function Top({ children }) {
  return (
    <section className="member-top">
      <div className="container">
        <div className="member-top__bar">
          <Logo light className="member-top__logo" />
        </div>
        <a href="#inicio" className="member-top__back">
          <Icone name="arrowLeft" size={16} /> Voltar ao site
        </a>
        {children}
      </div>
    </section>
  )
}

function ProfileCard({ auth }) {
  const [name, setName] = useState(auth.profile?.full_name ?? '')
  const [phone, setPhone] = useState(maskPhone(auth.profile?.phone ?? ''))
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (name.trim().length < 3) {
      setMsg({ ok: false, text: 'Informe seu nome.' })
      return
    }
    setBusy(true)
    try {
      await backend.updateProfile(auth.user.id, { fullName: name.trim(), phone: digits(phone) })
      auth.refreshProfile()
      setMsg({ ok: true, text: 'Dados salvos.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="acard" onSubmit={save}>
      <h2>
        <Icone name="user" size={20} /> Seus dados
      </h2>
      <label className="acard__field">
        <span>Nome completo</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
      </label>
      <label className="acard__field">
        <span>E-mail</span>
        <input value={auth.user.email} readOnly />
      </label>
      <label className="acard__field">
        <span>WhatsApp</span>
        <input
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="(00) 00000-0000"
        />
      </label>
      {msg && <p className={`acard__msg ${msg.ok ? 'is-ok' : 'is-error'}`}>{msg.text}</p>}
      <button type="submit" className="btn btn--primary" disabled={busy}>
        {busy && <span className="spinner" aria-hidden="true" />} Salvar dados
      </button>
    </form>
  )
}

function PasswordCard({ auth }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (!passwordScore(next).valid) {
      setMsg({ ok: false, text: 'A nova senha precisa ter 8 caracteres ou mais, com letras e números.' })
      return
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: 'As senhas não são iguais.' })
      return
    }
    setBusy(true)
    try {
      // confirma a senha atual antes de trocar (protege se alguém pegar o aparelho logado)
      await auth.signIn({ email: auth.user.email, password: current })
      await auth.updatePassword(next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setMsg({ ok: true, text: 'Senha alterada. Sua conta foi desconectada dos outros aparelhos.' })
    } catch (err) {
      setMsg({ ok: false, text: /incorretos/.test(err.message) ? 'A senha atual está incorreta.' : err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="acard" onSubmit={save}>
      <h2>
        <Icone name="key" size={20} /> Trocar senha
      </h2>
      <label className="acard__field">
        <span>Senha atual</span>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label className="acard__field">
        <span>Nova senha</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required maxLength={72} />
      </label>
      <label className="acard__field">
        <span>Repita a nova senha</span>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required maxLength={72} />
      </label>
      {msg && <p className={`acard__msg ${msg.ok ? 'is-ok' : 'is-error'}`}>{msg.text}</p>}
      <button type="submit" className="btn btn--outline" disabled={busy || !current || !next}>
        {busy && <span className="spinner" aria-hidden="true" />} Alterar senha
      </button>
    </form>
  )
}

function OrdersCard({ userId }) {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    backend
      .getMyOrders(userId)
      .then((o) => alive && setOrders(o))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [userId])

  return (
    <section className="acard acard--wide">
      <h2>
        <Icone name="list" size={20} /> Meus pedidos
      </h2>
      {error && <p className="acard__msg is-error">{error}</p>}
      {!orders && !error && <p className="acard__muted">Carregando…</p>}
      {orders?.length === 0 && <p className="acard__muted">Você ainda não fez nenhum pedido.</p>}
      {orders?.length > 0 && (
        <ul className="aorders">
          {orders.map((o) => (
            <li key={o.id}>
              <a href={`#/pedido/${o.id}`}>
                <span className="aorders__main">
                  <strong>Pedido #{shortId(o.id)}</strong>
                  <span>{o.order_items.map((i) => i.title).join(', ')}</span>
                </span>
                <span className="aorders__meta">
                  <span>{formatDate(o.created_at)}</span>
                  <strong>{formatBRL(Number(o.total))}</strong>
                  <EtiquetaStatus status={o.status} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function MinhaConta() {
  const auth = useAuth()

  if (!auth.enabled || (auth.ready && !auth.user)) {
    return (
      <main className="member" id="conteudo">
        <Top>
          <span className="eyebrow eyebrow--dark">Minha conta</span>
          <h1 className="member-top__title member-top__title--sm">Entre para ver sua conta</h1>
        </Top>
        <section className="section member-body">
          <div className="container">
            <div className="member-empty">
              <span className="member-empty__icon">
                <Icone name="lock" size={28} />
              </span>
              <h2>Acesse sua conta</h2>
              <p>{auth.enabled ? 'Entre para ver seus dados e pedidos.' : 'As contas ainda não estão ativas neste site.'}</p>
              {auth.enabled && (
                <a href="#/entrar?next=%2Fminha-conta" className="btn btn--primary btn--lg">
                  Entrar <Icone name="arrowRight" size={18} />
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (!auth.ready || auth.profileLoading) {
    return (
      <main className="member" id="conteudo" aria-busy="true">
        <Top>
          <h1 className="member-top__title member-top__title--sm">Minha conta</h1>
        </Top>
        <EsqueletoCartoes />
      </main>
    )
  }

  return (
    <main className="member" id="conteudo">
      <Top>
        <span className="eyebrow eyebrow--dark">Minha conta</span>
        <h1 className="member-top__title member-top__title--sm">
          Olá, <span className="hl">{(auth.profile?.full_name || auth.user.email).split(' ')[0]}</span>
        </h1>
        <div className="account-links">
          <a href="#/meus-cursos" className="btn btn--primary">
            <Icone name="play" size={16} /> Meus cursos
          </a>
          {auth.isAdmin && (
            <a href="#/admin" className="btn btn--ghost">
              <Icone name="grid" size={16} /> Painel de ADM
            </a>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              await auth.signOut()
              window.location.hash = '#inicio'
            }}
          >
            <Icone name="logOut" size={16} /> Sair
          </button>
        </div>
      </Top>

      <section className="section member-body">
        <div className="container account-grid">
          <ProfileCard key={auth.profile?.id} auth={auth} />
          <PasswordCard auth={auth} />
          <OrdersCard userId={auth.user.id} />
        </div>
      </section>
    </main>
  )
}
