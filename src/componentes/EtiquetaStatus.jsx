// Etiqueta colorida com a situação de um pedido (pago, pendente, estornado...).
import Icone from './Icone'
import { ORDER_STATUS } from '../servicos/pedidos'

// Selo de situação do pedido (texto + ícone + cor)
export default function EtiquetaStatus({ status }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: 'neutral', icon: 'alert' }
  return (
    <span className={`chip-status chip-status--${s.tone}`}>
      <Icone name={s.icon} size={12} strokeWidth={3} /> {s.label}
    </span>
  )
}
