// Selos de compra segura e formas de pagamento aceitas.
import Icone from './Icone'

const METHODS = [
  { id: 'pix', label: 'Pix' },
  { id: 'visa', label: 'VISA' },
  { id: 'master', label: 'Mastercard' },
  { id: 'elo', label: 'elo' },
  { id: 'amex', label: 'AMEX' },
  { id: 'boleto', label: 'Boleto' },
]

export function FormasDePagamento({ compact = false }) {
  return (
    <ul className={`paymethods ${compact ? 'paymethods--compact' : ''}`} aria-label="Formas de pagamento aceitas">
      {METHODS.map((m) => (
        <li key={m.id} className={`paymethod paymethod--${m.id}`}>
          {m.id === 'master' ? (
            <span className="paymethod__mc" aria-label="Mastercard">
              <i />
              <i />
            </span>
          ) : (
            m.label
          )}
        </li>
      ))}
    </ul>
  )
}

const BADGES = [
  { icon: 'lock', title: 'Site 100% seguro', text: 'Criptografia SSL 256 bits' },
  { icon: 'shield', title: 'Garantia de 7 dias', text: 'Seu dinheiro de volta' },
  { icon: 'idCard', title: 'Dados protegidos', text: 'Em conformidade com a LGPD' },
  { icon: 'zap', title: 'Acesso imediato', text: 'Liberação após o pagamento' },
]

export function BarraDeSeguranca() {
  return (
    <div className="secure-bar reveal">
      <div className="secure-bar__badges">
        {BADGES.map((b) => (
          <div className="secure-badge" key={b.title}>
            <span className="secure-badge__icon">
              <Icone name={b.icon} size={20} />
            </span>
            <div>
              <strong>{b.title}</strong>
              <span>{b.text}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="secure-bar__pay">
        <span>Formas de pagamento</span>
        <FormasDePagamento />
      </div>
    </div>
  )
}
