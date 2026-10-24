// Seção dos professores: foto da dupla e o perfil de cada um.
import Icone from '../componentes/Icone'
import dupla from '../imagens/dupla-homefit.webp'
import fachada from '../imagens/banner-academia.webp'
import logoBranca from '../imagens/logo-homefit-branca.svg'
import { TRAINERS } from '../dados/conteudo'

// Credenciais da equipe, em lista simples abaixo dos perfis
const TRUST = [
  { title: 'Registrados no CREF', text: 'Profissionais de educação física habilitados' },
  { title: 'Aulas gravadas no Studio', text: 'O mesmo método das aulas presenciais' },
  { title: 'Na academia todo dia', text: 'Corrigindo a execução de alunos reais' },
]

// Ficha do professor: texto direto, sem foto de perfil (a foto real da dupla fica ao lado)
function TrainerCard({ trainer, delay }) {
  return (
    <article className="trainer reveal" style={{ '--d': delay }}>
      <h3 className="trainer__name">{trainer.name}</h3>
      <p className="trainer__meta">
        {trainer.role} · <span>{trainer.cref}</span>
      </p>

      <p className="trainer__bio">{trainer.bio}</p>

      <div className="trainer__foot">
        <p className="trainer__spec">
          <strong>Especialidades</strong>
          {trainer.specialties.join(' · ')}
        </p>
        {trainer.instagram && (
          <a className="trainer__social" href={trainer.instagram} target="_blank" rel="noreferrer">
            <Icone name="instagram" size={16} /> Instagram
          </a>
        )}
      </div>
    </article>
  )
}

export default function Professores() {
  return (
    <section className="section method team" id="professores">
      <div className="container">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow eyebrow--dark">Quem vai te ensinar</span>
            <h2 className="section__title">
              Conheça seus <span className="hl">professores</span>
            </h2>
          </div>
          <p className="section__lead">
            Os personal trainers do Studio HomeFit que gravaram cada aula e corrigem execução todos os dias dentro da
            academia.
          </p>
        </div>

        <div className="team__layout">
          {/* Foto da dupla sobre a fachada da academia, com a assinatura do Studio */}
          <figure className="team__visual reveal">
            <img className="team__bg" src={fachada} alt="" loading="lazy" />
            <span className="team__corner" aria-hidden="true" />
            <img
              className="team__duo"
              src={dupla}
              alt="Os dois personal trainers do Studio HomeFit, de braços cruzados"
              width="960"
              height="970"
              loading="lazy"
            />
            <figcaption className="team__caption">
              <img src={logoBranca} alt="Studio HomeFit" width="626" height="178" />
              <span>Equipe de personal trainers</span>
            </figcaption>
          </figure>

          <div className="team__people">
            {TRAINERS.map((t, i) => (
              <TrainerCard key={t.name} trainer={t} delay={`${i * 90}ms`} />
            ))}

            <ul className="team__trust reveal" style={{ '--d': '180ms' }}>
              {TRUST.map((t) => (
                <li key={t.title}>
                  <Icone name="check" size={16} strokeWidth={3} />
                  <div>
                    <strong>{t.title}</strong>
                    <span>{t.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
