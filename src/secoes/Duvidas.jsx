// Perguntas frequentes, que abrem e fecham ao clicar.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import { FAQ } from '../dados/conteudo'
import { useStore } from '../estado/hooks'

export default function Duvidas() {
  const [open, setOpen] = useState(0)
  const whatsapp = useStore().settings?.whatsapp

  return (
    <section className="section faq" id="faq">
      <div className="container faq__grid">
        <div className="faq__intro reveal">
          <span className="eyebrow">Dúvidas frequentes</span>
          <h2 className="section__title">
            Ficou com alguma <span className="hl">dúvida?</span>
          </h2>
          <p className="section__lead">Se não encontrar sua resposta aqui, fale com a nossa equipe no WhatsApp.</p>
          {whatsapp && (
          <a
            className="btn btn--dark"
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Tenho uma dúvida sobre os cursos do Studio HomeFit.')}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icone name="message" size={18} /> Falar com a equipe
          </a>
          )}
        </div>

        <div className="accordion">
          {FAQ.map((item, i) => {
            const isOpen = open === i
            return (
              <div className={`acc ${isOpen ? 'acc--open' : ''}`} key={item.q}>
                <h3>
                  <button
                    type="button"
                    id={`faq-btn-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    {item.q}
                    <span className="acc__icon">
                      <Icone name="chevronDown" size={18} />
                    </span>
                  </button>
                </h3>
                <div className="acc__panel" id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`}>
                  <div>
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
