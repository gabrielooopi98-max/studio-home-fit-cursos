// Finalizar compra: dados do comprador, cupom e ida para o pagamento.
import { useEffect, useState } from 'react'
import Janela from '../componentes/Janela'
import Icone from '../componentes/Icone'
import logoEscura from '../imagens/logo-homefit-escura.svg'
import { FormasDePagamento } from '../componentes/Seguranca'
import { formatBRL, img } from '../dados/site'
import { backend } from '../servicos/banco'
import { useAuth, useStore } from '../estado/hooks'

const STEPS = ['Identificação', 'Pagamento', 'Confirmação']

const digits = (v) => v.replace(/\D/g, '')

const maskCpf = (v) =>
  digits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')

const maskPhone = (v) => {
  const d = digits(v).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function isValidCpf(value) {
  const cpf = digits(value)
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  const calc = (len) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10])
}

function validate(form) {
  const errors = {}
  if (form.name.trim().split(/\s+/).length < 2) errors.name = 'Informe seu nome completo.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = 'Informe um e-mail válido.'
  if (digits(form.phone).length < 10) errors.phone = 'Informe um WhatsApp com DDD.'
  if (form.cpf && !isValidCpf(form.cpf)) errors.cpf = 'CPF inválido. Confira os números.'
  return errors
}

function Field({ id, label, icon, error, ...props }) {
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <Icone name={icon} size={18} />
        <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props} />
      </div>
      {error && (
        <p className="field__error" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  )
}

// Sem login não dá para comprar (o curso fica na conta do aluno)
function LoginFirst({ onClose }) {
  const go = (path) => {
    try {
      window.sessionStorage.setItem('hf-continuar-compra', '1')
    } catch {
      // sem armazenamento: o aluno abre o carrinho de novo depois de entrar
    }
    onClose()
    window.location.hash = path
  }
  return (
    <div className="co__login">
      <span className="co__done-icon co__done-icon--blue">
        <Icone name="user" size={36} strokeWidth={1.8} />
      </span>
      <h3>Entre na sua conta para comprar</h3>
      <p>Seus cursos ficam guardados na sua conta e você assiste de qualquer aparelho. Leva menos de um minuto.</p>
      <div className="co__done-actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={() => go('#/entrar?next=checkout')}>
          Entrar <Icone name="arrowRight" size={18} />
        </button>
        <button type="button" className="btn btn--outline btn--lg" onClick={() => go('#/cadastro?next=checkout')}>
          Criar conta
        </button>
      </div>
    </div>
  )
}

export default function FinalizarCompra({ items, onClose, onComplete, onClearCart }) {
  const auth = useAuth()
  const { settings } = useStore()
  const needsLogin = auth.enabled && !auth.user
  const testMode = !!settings?.testMode
  const demo = backend.mode === 'static'

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => ({
    name: auth.profile?.full_name ?? '',
    email: auth.user?.email ?? '',
    phone: auth.profile?.phone ? maskPhone(auth.profile.phone) : '',
    cpf: '',
  }))
  const [touched, setTouched] = useState({})
  const [coupon, setCoupon] = useState('')
  const [applied, setApplied] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [payError, setPayError] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(null)

  const courseIds = items.filter((i) => i.kind === 'course').map((i) => i.id)
  const combo = items.some((i) => i.kind === 'combo')
  const itemsKey = items.map((i) => i.id).join(',')

  // Preço calculado pelo servidor (com cupom), sempre que o carrinho ou o cupom muda
  useEffect(() => {
    if (needsLogin || !items.length) return
    let alive = true
    backend
      .quote({ courseIds, combo, coupon: applied })
      .then((q) => {
        if (!alive) return
        setQuote(q)
        setQuoteError(q.coupon_error ?? '')
      })
      .catch((e) => alive && setQuoteError(e.message))
    return () => {
      alive = false
    }
    // itemsKey resume o carrinho; courseIds/combo derivam dele
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, applied, needsLogin])

  const localTotal = items.reduce((s, i) => s + i.price, 0)
  const total = quote ? Number(quote.total) : localTotal
  const discount = quote ? Number(quote.discount) : 0
  const errors = validate(form)
  const showError = (k) => (touched[k] ? errors[k] : undefined)

  const set = (key, mask) => (e) => setForm((f) => ({ ...f, [key]: mask ? mask(e.target.value) : e.target.value }))
  const blur = (key) => () => setTouched((t) => ({ ...t, [key]: true }))

  const submitData = (e) => {
    e.preventDefault()
    setTouched({ name: true, email: true, phone: true, cpf: true })
    if (Object.keys(errors).length) return
    // guarda nome e WhatsApp no perfil para a próxima compra (falha aqui não impede a compra)
    if (auth.user && backend.updateProfile) {
      backend
        .updateProfile(auth.user.id, { fullName: form.name.trim(), phone: digits(form.phone) })
        .then(() => auth.refreshProfile())
        .catch(() => {})
    }
    setStep(1)
  }

  const pay = async () => {
    setPayError('')
    setLoading(true)
    try {
      const result = await backend.checkout({
        courseIds,
        combo,
        coupon: applied,
        testMode,
        payer: { name: form.name.trim(), phone: digits(form.phone), cpf: digits(form.cpf) },
      })
      if (result.mode === 'redirect') {
        // vai para a página segura do Mercado Pago; o carrinho é esvaziado quando o pagamento confirmar
        window.location.assign(result.url)
        return
      }
      setOrder({
        id: result.orderId,
        items: quote?.items?.map((i) => ({ id: i.course_id ?? 'combo', title: i.title, price: Number(i.price) })) ?? items,
        total,
        email: form.email.trim(),
        firstName: form.name.trim().split(/\s+/)[0],
        demo: !!result.demo,
      })
      setStep(2)
      onComplete()
      onClearCart()
    } catch (e) {
      setPayError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const summaryItems = order ? order.items : items

  return (
    <Janela onClose={onClose} label="Finalizar compra" size="xl">
      <div className="co">
        <div className="co__main">
          <div className="co__head">
            <img className="co__logo" src={logoEscura} alt="Studio HomeFit" width="626" height="178" />
            <p className="co__secure">
              <Icone name="lock" size={14} /> Compra segura
            </p>
            <h2>{step === 2 ? 'Pedido confirmado!' : 'Finalizar compra'}</h2>
          </div>

          {needsLogin ? (
            <LoginFirst onClose={onClose} />
          ) : (
            <>
              <ol className="stepper" aria-label="Etapas da compra">
                {STEPS.map((s, i) => (
                  <li
                    key={s}
                    className={`stepper__item ${i < step ? 'is-done' : ''} ${i === step ? 'is-current' : ''}`}
                    aria-current={i === step ? 'step' : undefined}
                  >
                    <span className="stepper__dot">{i < step ? <Icone name="check" size={14} strokeWidth={3} /> : i + 1}</span>
                    <span className="stepper__label">{s}</span>
                  </li>
                ))}
              </ol>

              {step === 0 && (
                <form className="co__form" onSubmit={submitData} noValidate>
                  <Field
                    id="co-name"
                    label="Nome completo"
                    icon="user"
                    autoComplete="name"
                    placeholder="Como está no seu documento"
                    value={form.name}
                    onChange={set('name')}
                    onBlur={blur('name')}
                    error={showError('name')}
                  />
                  <Field
                    id="co-email"
                    label="E-mail"
                    icon="mail"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@email.com"
                    value={form.email}
                    onChange={set('email')}
                    onBlur={blur('email')}
                    error={showError('email')}
                    readOnly={!!auth.user}
                  />
                  <div className="co__row">
                    <Field
                      id="co-phone"
                      label="WhatsApp"
                      icon="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="(00) 00000-0000"
                      value={form.phone}
                      onChange={set('phone', maskPhone)}
                      onBlur={blur('phone')}
                      error={showError('phone')}
                    />
                    <Field
                      id="co-cpf"
                      label="CPF (opcional)"
                      icon="idCard"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={form.cpf}
                      onChange={set('cpf', maskCpf)}
                      onBlur={blur('cpf')}
                      error={showError('cpf')}
                    />
                  </div>
                  <p className="co__hint">
                    <Icone name="shield" size={15} /> Usamos seus dados apenas para liberar o acesso e emitir a nota fiscal.
                  </p>
                  <button type="submit" className="btn btn--primary btn--lg btn--block">
                    Continuar para pagamento <Icone name="arrowRight" size={18} className="arrow" />
                  </button>
                </form>
              )}

              {step === 1 && (
                <div className="co__pay">
                  {!demo && (
                    <form
                      className="co__coupon"
                      onSubmit={(e) => {
                        e.preventDefault()
                        setApplied(coupon.trim().toUpperCase())
                      }}
                    >
                      <label htmlFor="co-coupon">Cupom de desconto</label>
                      <div>
                        <input
                          id="co-coupon"
                          value={coupon}
                          onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30))}
                          placeholder="Ex.: HOMEFIT10"
                          autoComplete="off"
                        />
                        <button type="submit" className="btn btn--outline btn--sm" disabled={!coupon.trim()}>
                          Aplicar
                        </button>
                      </div>
                      {applied && quoteError && <p className="field__error">{quoteError}</p>}
                      {applied && !quoteError && discount > 0 && (
                        <p className="co__coupon-ok">
                          <Icone name="check" size={14} strokeWidth={3} /> Cupom {applied} aplicado: -{formatBRL(discount)}
                        </p>
                      )}
                    </form>
                  )}

                  {/* aviso só quando não há cobrança de verdade */}
                  {(demo || testMode) && (
                    <div className="co__notice">
                      <Icone name="lock" size={20} />
                      <p>
                        {demo ? (
                          <>
                            <strong>Modo demonstração:</strong> nenhuma cobrança é feita e os cursos ficam liberados neste
                            navegador.
                          </>
                        ) : (
                          <>
                            <strong>Modo de teste ligado:</strong> a compra é registrada sem cobrança, para testar o site.
                            Desligue no painel de ADM antes de vender.
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  {payError && (
                    <p className="co__error" role="alert">
                      <Icone name="alert" size={18} /> {payError}
                    </p>
                  )}

                  <div className="co__actions">
                    <button type="button" className="btn btn--outline" onClick={() => setStep(0)} disabled={loading}>
                      <Icone name="arrowLeft" size={18} /> Voltar
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--lg co__pay-btn"
                      onClick={pay}
                      disabled={loading || (!demo && !quote)}
                    >
                      {loading ? (
                        <>
                          <span className="spinner" aria-hidden="true" /> Conectando ao pagamento seguro…
                        </>
                      ) : (
                        <>
                          <Icone name="lock" size={18} /> Finalizar compra
                        </>
                      )}
                    </button>
                  </div>
                  <p className="co__termos">
                    Ao finalizar a compra, você concorda com os{' '}
                    <a href="#/termos" target="_blank" rel="noreferrer">
                      Termos de Uso
                    </a>{' '}
                    e a{' '}
                    <a href="#/privacidade" target="_blank" rel="noreferrer">
                      Política de Privacidade
                    </a>
                    . Você tem 7 dias de garantia para pedir o reembolso.
                    {settings?.dripEnabled && (
                      <>
                        {' '}
                        As aulas são liberadas aos poucos: o 1º módulo de cada curso na hora e o curso inteiro até o{' '}
                        {settings.dripDays}º dia depois da compra.
                      </>
                    )}
                  </p>
                </div>
              )}

              {step === 2 && order && (
                <div className="co__done">
                  <span className="co__done-icon">
                    <Icone name="checkCircle" size={44} strokeWidth={1.8} />
                  </span>
                  <h3>Obrigado, {order.firstName}!</h3>
                  <p>Seu pedido foi confirmado e os cursos já estão liberados na sua área do aluno.</p>
                  {order.demo && (
                    <p className="co__demo">
                      Modo demonstração: nenhuma cobrança foi feita. Configure o Supabase no arquivo <code>.env</code> para
                      ativar contas, painel de ADM e pagamentos reais.
                    </p>
                  )}
                  <div className="co__done-actions">
                    <a href="#/meus-cursos" className="btn btn--primary btn--lg" onClick={onClose}>
                      <Icone name="play" size={18} /> Acessar meus cursos
                    </a>
                    <button type="button" className="btn btn--outline btn--lg" onClick={onClose}>
                      Voltar ao site
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="co__summary">
          <h3>Resumo do pedido</h3>
          <ul className="co__items">
            {summaryItems.map((i) => (
              <li key={i.id}>
                <span className="co__thumb">
                  {i.image ? <img src={img(i.image, 160)} alt="" /> : <Icone name="award" size={20} />}
                </span>
                <span className="co__item-name">{i.title}</span>
                <strong>{formatBRL(i.price)}</strong>
              </li>
            ))}
          </ul>
          <div className="co__totals">
            <div>
              <span>Subtotal</span>
              <span>{formatBRL(quote ? Number(quote.subtotal) : localTotal)}</span>
            </div>
            {discount > 0 && (
              <div className="co__discount">
                <span>Desconto</span>
                <span>-{formatBRL(discount)}</span>
              </div>
            )}
            <div className="co__total">
              <span>Total</span>
              <strong>{formatBRL(order ? order.total : total)}</strong>
            </div>
          </div>
          <ul className="co__guarantees">
            <li>
              <Icone name="shield" size={18} />
              <div>
                <strong>Garantia de 7 dias</strong>
                <span>Não gostou? Devolvemos 100%.</span>
              </div>
            </li>
            <li>
              <Icone name="lock" size={18} />
              <div>
                <strong>Compra protegida</strong>
                <span>Pagamento processado pelo Mercado Pago.</span>
              </div>
            </li>
            <li>
              <Icone name="zap" size={18} />
              <div>
                <strong>Acesso imediato</strong>
                <span>Liberado assim que o pagamento é aprovado.</span>
              </div>
            </li>
          </ul>
          <FormasDePagamento compact />
        </aside>
      </div>
    </Janela>
  )
}
