// Faixa de benefícios logo abaixo do banner e a seção "problema" (o jeito errado x o certo).
import Icone from '../componentes/Icone'
import { BENEFITS, PAINS } from '../dados/conteudo'

export function FaixaDeBeneficios() {
  return (
    <section className="benefits" aria-label="Benefícios">
      {/* Formas geométricas discretas no fundo claro, no estilo da seção Professores */}
      <span className="decor shape shape--corner shape--corner--bl" aria-hidden="true" />
      <span className="decor shape shape--xo benefits__xo" aria-hidden="true" />
      <span className="decor shape shape--squares benefits__squares" aria-hidden="true" />

      <div className="container benefits__grid">
        {BENEFITS.map((b) => (
          <div className="benefit" key={b.title}>
            <span className="benefit__icon">
              <Icone name={b.icon} size={22} />
            </span>
            <div>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function SecaoProblema() {
  return (
    <section className="section problem">
      <div className="container problem__grid">
        <div className="problem__intro reveal">
          <span className="eyebrow">O problema</span>

          <h2 className="section__title">
            Treinar mais não significa evoluir mais!{' '}
            <span className="hl">Técnica é o que gera resultados.</span>
          </h2>

          <p className="section__lead">
            Muitos aprendem copiando os outros, mas sem a técnica correta, o treino pode gerar resultados abaixo do
            esperado e aumentar o risco de lesões.
          </p>

          {/* Comparativo rápido: o jeito errado x o jeito certo */}
          <ul className="problem__compare">
            <li className="is-bad">
              <Icone name="x" size={14} strokeWidth={3} /> Copiar quem está do lado
            </li>
            <li className="is-good">
              <Icone name="check" size={14} strokeWidth={3} /> Aprender a execução certa
            </li>
          </ul>
        </div>

        {/* a lista entra junta, em cascata: --i é a posição de cada card */}
        <div className="problem__cards reveal reveal--grupo">
          {PAINS.map((p, i) => (
            <article className="pain" key={p.title} style={{ '--i': i }}>
              <span className="pain__icon">
                <Icone name={p.icon} size={20} />
              </span>
              <div>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            </article>
          ))}
          <div className="problem__stat" style={{ '--i': PAINS.length }}>
            <span className="problem__stat-icon">
              <Icone name="alert" size={20} />
            </span>
            <div>
              <p>Sem a técnica correta, você compromete seus resultados e aumenta o risco de lesões.</p>
              <a href="#cursos" className="problem__stat-link">
                Conheça os cursos <Icone name="arrowRight" size={16} className="arrow" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
