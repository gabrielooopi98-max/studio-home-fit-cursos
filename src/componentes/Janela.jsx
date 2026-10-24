// Janela por cima da página (modal): fecha no X, no Esc ou clicando fora.
import { useEffect, useRef } from 'react'
import Icone from './Icone'

// Montado apenas quando aberto: trava o scroll, foca o painel e devolve o foco ao fechar.
export default function Janela({ onClose, label, size = 'md', children }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [])

  return (
    <div className="modal">
      <div className="modal__overlay" onClick={() => closeRef.current()} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`modal__panel modal__panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <button type="button" className="modal__close" onClick={() => closeRef.current()} aria-label="Fechar">
          <Icone name="x" size={20} />
        </button>
        {children}
      </div>
    </div>
  )
}
