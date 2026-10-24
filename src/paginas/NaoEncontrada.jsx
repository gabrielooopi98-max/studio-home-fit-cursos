// Página 404: endereço que não existe.
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'

// Página 404: endereço ou rota que não existe (reaproveita o visual da área do aluno)
export default function NaoEncontrada() {
  return (
    <main className="member" id="conteudo">
      <section className="member-top">
        <div className="container">
          <div className="member-top__bar">
            <Logo light className="member-top__logo" />
          </div>
          <span className="eyebrow eyebrow--dark notfound__eyebrow">Erro 404</span>
          <h1 className="member-top__title">
            Página não <span className="hl">encontrada</span>
          </h1>
          <p className="member-top__lead">O endereço que você acessou não existe ou mudou de lugar.</p>
        </div>
      </section>

      <section className="section member-body">
        <div className="container">
          <div className="member-empty">
            <span className="member-empty__icon">
              <Icone name="alert" size={28} />
            </span>
            <h2>Bora voltar para o treino</h2>
            <p>Confira os cursos ou volte para a página inicial do Studio HomeFit.</p>
            <div className="notfound__actions">
              <a href="#inicio" className="btn btn--primary btn--lg">
                Ir para o início <Icone name="arrowRight" size={18} className="arrow" />
              </a>
              <a href="#cursos" className="btn btn--outline btn--lg">
                Ver cursos
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
