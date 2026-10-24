// Termos de Uso (#/termos) e Política de Privacidade (#/privacidade): topo escuro, sumário e o texto.
// O texto fica em dados/termos.js e dados/privacidade.js; os dados da empresa em dados/empresa.js.
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import { DOCUMENTOS_ATUALIZADOS_EM, EMPRESA } from '../dados/empresa'
import { PRIVACIDADE } from '../dados/privacidade'
import { TERMOS } from '../dados/termos'
import { useStore } from '../estado/hooks'

const DOCUMENTOS = {
  termos: { ...TERMOS, outro: { href: '#/privacidade', titulo: 'Política de Privacidade' } },
  privacidade: { ...PRIVACIDADE, outro: { href: '#/termos', titulo: 'Termos de Uso' } },
}

// "5564999258218" -> "(64) 9 9925-8218"
const formatarWhatsapp = (n) => {
  const d = String(n ?? '').replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d
}

// Texto com **negrito** e [link](#/endereco)
function Texto({ children }) {
  const partes = String(children).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return partes.map((p, i) => {
    const negrito = p.match(/^\*\*([^*]+)\*\*$/)
    if (negrito) return <strong key={i}>{negrito[1]}</strong>
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) return <a key={i} href={link[2]}>{link[1]}</a>
    return p
  })
}

function Contato() {
  const { settings } = useStore()
  const whatsapp = settings?.whatsapp
  const email = settings?.contactEmail
  const empresa = [EMPRESA.razaoSocial, EMPRESA.cnpj && `CNPJ ${EMPRESA.cnpj}`, EMPRESA.endereco].filter(Boolean)
  return (
    <div className="doc__contato">
      {whatsapp && (
        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
          <Icone name="message" size={18} /> WhatsApp {formatarWhatsapp(whatsapp)}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`}>
          <Icone name="mail" size={18} /> {email}
        </a>
      )}
      {!whatsapp && !email && <p>Use o botão de WhatsApp do site para falar com a nossa equipe.</p>}
      {empresa.length > 0 && <p className="doc__empresa">{empresa.join(' · ')}</p>}
    </div>
  )
}

function Bloco({ bloco }) {
  if (typeof bloco === 'string') {
    return (
      <p>
        <Texto>{bloco}</Texto>
      </p>
    )
  }
  if (bloco.contato) return <Contato />
  return (
    <ul>
      {bloco.lista.map((item) => (
        <li key={item}>
          <Texto>{item}</Texto>
        </li>
      ))}
    </ul>
  )
}

export default function Documento({ doc }) {
  const d = DOCUMENTOS[doc]
  // o sumário rola até a seção (os links # do site são rotas, então não dá para usar âncoras normais)
  const irPara = (id) => document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <main className="member doc" id="conteudo">
      <section className="member-top">
        <div className="container">
          <div className="member-top__bar">
            <Logo light className="member-top__logo" />
          </div>
          <a href="#inicio" className="member-top__back">
            <Icone name="arrowLeft" size={16} /> Voltar ao site
          </a>
          <span className="eyebrow eyebrow--dark">{EMPRESA.nome}</span>
          <h1 className="member-top__title member-top__title--sm">{d.titulo}</h1>
          <p className="doc__resumo">{d.resumo}</p>
          <p className="doc__data">
            <Icone name="clock" size={15} /> Última atualização: {DOCUMENTOS_ATUALIZADOS_EM}
          </p>
        </div>
      </section>

      <section className="section doc__corpo">
        <div className="container doc__grade">
          <nav className="doc__sumario" aria-label="Sumário">
            <p>Nesta página</p>
            <ol>
              {d.secoes.map((s, i) => (
                <li key={s.id}>
                  <button type="button" onClick={() => irPara(s.id)}>
                    <span>{String(i + 1).padStart(2, '0')}</span> {s.titulo}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <article className="doc__texto">
            {d.secoes.map((s, i) => (
              <section key={s.id} id={`doc-${s.id}`} className="doc__secao">
                <h2>
                  <span>{String(i + 1).padStart(2, '0')}</span> {s.titulo}
                </h2>
                {s.blocos.map((b, k) => (
                  <Bloco key={k} bloco={b} />
                ))}
              </section>
            ))}

            <a href={d.outro.href} className="doc__outro">
              <span>Leia também</span>
              <strong>{d.outro.titulo}</strong>
              <Icone name="arrowRight" size={20} />
            </a>
          </article>
        </div>
      </section>
    </main>
  )
}
