// Acompanhar um pedido (#/pedido/...): atualiza sozinho até o pagamento ser confirmado.
import { useEffect, useRef, useState } from 'react'
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import EtiquetaStatus from '../componentes/EtiquetaStatus'
import { formatBRL } from '../dados/site'
import { backend } from '../servicos/banco'
import { formatDate, shortId } from '../servicos/pedidos'
import { useAuth } from '../estado/hooks'

// Volta do Mercado Pago: acompanha o pedido até o pagamento ser confirmado pelo servidor
const POLL_MS = 5000
const MAX_TRIES = 72

const COPY = {
  paid: {
    icon: 'checkCircle',
    tone: 'ok',
    title: 'Pagamento aprovado!',
    text: 'Seus cursos já estão liberados. Bons treinos!',
  },
  pending: {
    icon: 'clock',
    tone: 'wait',
    title: 'Aguardando a confirmação do pagamento',
    text: 'Pix costuma confirmar em segundos; boleto, em até 2 dias úteis. Esta página atualiza sozinha e o acesso é liberado automaticamente.',
  },
  failed: {
    icon: 'alert',
    tone: 'error',
    title: 'O pagamento não foi aprovado',
    text: 'Nenhum valor foi cobrado. Você pode tentar de novo com outra forma de pagamento.',
  },
  cancelled: {
    icon: 'x',
    tone: 'error',
    title: 'Pedido cancelado',
    text: 'Este pedido foi cancelado. Se foi um engano, faça a compra novamente.',
  },
  refunded: {
    icon: 'refresh',
    tone: 'neutral',
    title: 'Pedido estornado',
    text: 'O valor deste pedido foi devolvido e o acesso aos cursos dele foi encerrado.',
  },
}

export default function Pedido({ orderId, onPaid }) {
  const auth = useAuth()
  const [order, setOrder] = useState(undefined)
  const [error, setError] = useState('')
  const [tries, setTries] = useState(0)
  const paidHandled = useRef(false)
  const userId = auth.user?.id

  useEffect(() => {
    if (!userId) return
    let alive = true
    // o servidor confere o pagamento direto no Mercado Pago (libera mesmo se o aviso atrasar);
    // se a conferência falhar, só lê o pedido como está
    backend
      .verifyOrder(orderId)
      .catch(() => null)
      .then(() => backend.getOrder(orderId))
      .then((o) => {
        if (!alive) return
        setOrder(o ?? null)
        setError('')
      })
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [orderId, userId, tries])

  // enquanto estiver pendente, consulta de novo a cada 5 segundos (por até 6 minutos)
  const pending = order?.status === 'pending'
  useEffect(() => {
    if (!pending || tries >= MAX_TRIES) return
    const t = setTimeout(() => setTries((n) => n + 1), POLL_MS)
    return () => clearTimeout(t)
  }, [pending, tries])

  // pago: atualiza "Meus cursos" e esvazia o carrinho (uma vez só)
  useEffect(() => {
    if (order?.status === 'paid' && !paidHandled.current) {
      paidHandled.current = true
      onPaid()
    }
  }, [order?.status, onPaid])

  const top = (
    <section className="member-top">
      <div className="container">
        <div className="member-top__bar">
          <Logo light className="member-top__logo" />
        </div>
        <a href="#inicio" className="member-top__back">
          <Icone name="arrowLeft" size={16} /> Voltar ao site
        </a>
        <span className="eyebrow eyebrow--dark">Seu pedido</span>
        <h1 className="member-top__title member-top__title--sm">Pedido #{shortId(orderId)}</h1>
      </div>
    </section>
  )

  let body
  if (auth.enabled && auth.ready && !auth.user) {
    body = (
      <div className="member-empty">
        <span className="member-empty__icon">
          <Icone name="lock" size={28} />
        </span>
        <h2>Entre para ver seu pedido</h2>
        <p>Use a mesma conta com que fez a compra.</p>
        <a href={`#/entrar?next=${encodeURIComponent(`/pedido/${orderId}`)}`} className="btn btn--primary btn--lg">
          Entrar <Icone name="arrowRight" size={18} />
        </a>
      </div>
    )
  } else if (error) {
    body = (
      <div className="member-empty">
        <span className="member-empty__icon">
          <Icone name="alert" size={28} />
        </span>
        <h2>Não foi possível carregar o pedido</h2>
        <p>{error}</p>
        <button type="button" className="btn btn--primary btn--lg" onClick={() => setTries((n) => n + 1)}>
          <Icone name="refresh" size={18} /> Tentar de novo
        </button>
      </div>
    )
  } else if (order === undefined) {
    body = (
      <div className="member-empty" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        <p>Carregando seu pedido…</p>
      </div>
    )
  } else if (order === null) {
    body = (
      <div className="member-empty">
        <span className="member-empty__icon">
          <Icone name="alert" size={28} />
        </span>
        <h2>Pedido não encontrado</h2>
        <p>Confira se você entrou com a mesma conta usada na compra.</p>
        <a href="#/minha-conta" className="btn btn--primary btn--lg">
          Ver meus pedidos <Icone name="arrowRight" size={18} />
        </a>
      </div>
    )
  } else {
    const copy = COPY[order.status] ?? COPY.pending
    body = (
      <div className={`order-card order-card--${copy.tone}`}>
        <div className="order-card__status">
          <span className="order-card__icon">
            {order.status === 'pending' ? <span className="spinner" aria-hidden="true" /> : <Icone name={copy.icon} size={30} />}
          </span>
          <div>
            <h2>{copy.title}</h2>
            <p>{copy.text}</p>
            {pending && tries >= MAX_TRIES && (
              <p className="order-card__hint">
                Ainda não recebemos a confirmação. Você pode fechar esta página: o acesso é liberado assim que o pagamento
                cair, e você vê tudo em Minha conta.
              </p>
            )}
          </div>
        </div>

        <dl className="order-card__info">
          <div>
            <dt>Data</dt>
            <dd>{formatDate(order.created_at)}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>
              <EtiquetaStatus status={order.status} />
            </dd>
          </div>
        </dl>

        <ul className="order-card__items">
          {order.order_items.map((i) => (
            <li key={i.id}>
              <span>{i.title}</span>
              <strong>{formatBRL(Number(i.price))}</strong>
            </li>
          ))}
          {Number(order.discount) > 0 && (
            <li className="order-card__discount">
              <span>Desconto{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
              <strong>-{formatBRL(Number(order.discount))}</strong>
            </li>
          )}
          <li className="order-card__total">
            <span>Total</span>
            <strong>{formatBRL(Number(order.total))}</strong>
          </li>
        </ul>

        <div className="notfound__actions">
          {order.status === 'paid' ? (
            <a href="#/meus-cursos" className="btn btn--primary btn--lg">
              <Icone name="play" size={18} /> Acessar meus cursos
            </a>
          ) : order.status === 'pending' ? (
            <a href="#/minha-conta" className="btn btn--outline btn--lg">
              Ver meus pedidos
            </a>
          ) : (
            <a href="#cursos" className="btn btn--primary btn--lg">
              Tentar de novo <Icone name="arrowRight" size={18} />
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <main className="member" id="conteudo">
      {top}
      <section className="section member-body">
        <div className="container">{body}</div>
      </section>
    </main>
  )
}
