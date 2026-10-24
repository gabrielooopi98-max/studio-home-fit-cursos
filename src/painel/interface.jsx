// Peças de tela do painel: título, cartão, campo, chave liga/desliga, confirmação, gaveta...
import { useEffect, useId, useRef } from 'react'
import Icone from '../componentes/Icone'

// Peças visuais repetidas em todas as telas do painel

export function PageHead({ title, subtitle, actions }) {
  return (
    <div className="ahead">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ahead__actions">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className = '', busy }) {
  return (
    <section className={`acardx ${busy ? 'is-busy' : ''} ${className}`}>
      {(title || actions) && (
        <header className="acardx__head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="acardx__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Toggle({ checked, onChange, label, disabled, hideLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-label={hideLabel ? label : undefined}
    >
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      {!hideLabel && <span className="toggle__label">{label}</span>}
    </button>
  )
}

// Campo de formulário com rótulo, dica e erro ligados ao input (acessível)
//   about: o que é o campo e onde aparece no site (fica sempre visível, logo abaixo do rótulo)
//   hint: exemplo ou observação embaixo do campo (some quando há erro)
//   aside: algo pequeno à direita do rótulo, como um contador de letras
export function Field({ label, hint, error, about, optional, aside, children, className = '' }) {
  const id = useId()
  const describedBy = [about && `${id}-about`, error ? `${id}-err` : hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return (
    <div className={`xfield ${error ? 'xfield--error' : ''} ${className}`}>
      <div className="xfield__top">
        <label htmlFor={id}>
          {label}
          {optional && <span className="xfield__opt">opcional</span>}
        </label>
        {aside && <span className="xfield__aside">{aside}</span>}
      </div>
      {about && (
        <p className="xfield__about" id={`${id}-about`}>
          {about}
        </p>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': !!error })}
      {error ? (
        <p className="xfield__error" id={`${id}-err`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="xfield__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}

// Janela de confirmação para ações que não têm volta
export function Confirm({ open, title, text, confirmLabel = 'Confirmar', tone = 'danger', busy, onConfirm, onCancel }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])
  if (!open) return null
  return (
    <div className="xmodal" role="presentation">
      <div className="xmodal__overlay" onClick={() => !busy && onCancel()} />
      <div className="xmodal__panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" tabIndex={-1} ref={ref}>
        <span className={`xmodal__icon xmodal__icon--${tone}`}>
          <Icone name={tone === 'danger' ? 'alert' : 'check'} size={22} />
        </span>
        <h2 id="confirm-title">{title}</h2>
        <div className="xmodal__text">{text}</div>
        <div className="xmodal__actions">
          <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Painel lateral com detalhes (pedido, aluno, cupom...)
export function Drawer({ open, title, subtitle, onClose, children, footer, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="xdrawer" role="presentation">
      <div className="xdrawer__overlay" onClick={onClose} />
      <aside
        className={`xdrawer__panel ${wide ? 'xdrawer__panel--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header className="xdrawer__head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="xicon-btn" onClick={onClose} aria-label="Fechar">
            <Icone name="x" size={20} />
          </button>
        </header>
        <div className="xdrawer__body">{children}</div>
        {footer && <footer className="xdrawer__foot">{footer}</footer>}
      </aside>
    </div>
  )
}

export function Empty({ icon = 'list', title, text, action }) {
  return (
    <div className="xempty">
      <span className="xempty__icon">
        <Icone name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="xerror" role="alert">
      <Icone name="alert" size={18} />
      <span>{error.message ?? String(error)}</span>
      {onRetry && (
        <button type="button" className="btn btn--outline btn--sm" onClick={onRetry}>
          <Icone name="refresh" size={14} /> Tentar de novo
        </button>
      )}
    </div>
  )
}

// Seletor de período em botões (filtro do topo das telas)
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'is-active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="xsearch">
      <Icone name="search" size={17} />
      <span className="sr-only">Buscar</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={60} />
    </label>
  )
}
