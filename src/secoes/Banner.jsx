// Seção 1 da página inicial: banner com a foto da academia, título e botões.
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import dupla from '../imagens/dupla-homefit.webp'
import dupla480 from '../imagens/dupla-homefit-480.webp'
import dupla720 from '../imagens/dupla-homefit-720.webp'
import fachada from '../imagens/banner-academia.webp'
import fachada960 from '../imagens/banner-academia-960.webp'

// Atraso de entrada de cada bloco (em segundos)
const delay = (d) => ({ '--d': `${d}s` })

// Formas geométricas discretas no painel claro (mesmo estilo da seção Professores)
const SHAPES = ['xo', 'squares', 'x']

// Detalhes brancos/azuis sobre a foto escura: X em contorno, quadradinhos e pontos
const DECOR = ['x', 'squares', 'x-left', 'dots-left']

export default function Banner() {
  return (
    <section className="hero" id="inicio">
      {/*
        Fundo: a fachada do Studio em preto e branco, no banner inteiro. No celular e no tablet ela
        fica escurecida e quase toda atrás da dupla, então a versão de 960px basta.
      */}
      <img
        className="hero__bg"
        src={fachada}
        srcSet={`${fachada960} 960w, ${fachada} 1448w`}
        sizes="(max-width: 980px) 540px, 100vw"
        alt=""
        aria-hidden="true"
        width="1448"
        height="1086"
      />

      {/* Painel branco na diagonal (pincel seco) onde fica o texto */}
      <span className="hero__panel" aria-hidden="true" />
      <span className="hero__edge" aria-hidden="true" />
      <span className="hero__edge-esq" aria-hidden="true" />
      {SHAPES.map((s) => (
        <span key={s} className={`hero__shape hero__shape--${s}`} aria-hidden="true" />
      ))}

      {/* Faixa azul de pincel no canto inferior direito */}
      <span className="hero__band" aria-hidden="true" />
      <span className="hero__band-esq" aria-hidden="true" />

      {/* Detalhes discretos nas áreas escuras, sobre a fachada (ficam atrás do painel e da dupla) */}
      {DECOR.map((d) => (
        <span key={d} className={`hero__deco hero__deco--${d}`} aria-hidden="true" />
      ))}

      {/* Dupla de professores cruzando a borda do painel */}
      <div className="hero__visual">
        {/* o navegador baixa só o tamanho de que precisa: celular ~360px, tablet 560px, computador ~800px */}
        <img
          className="hero__duo"
          src={dupla}
          srcSet={`${dupla480} 480w, ${dupla720} 720w, ${dupla} 960w`}
          sizes="(max-width: 640px) 92vw, (max-width: 980px) 560px, 802px"
          alt="Professores do Studio HomeFit de braços cruzados, com a camiseta da marca"
          width="960"
          height="970"
          fetchPriority="high"
        />
      </div>

      {/* Logo da academia centralizada no topo do banner */}
      <div className="container hero__brand">
        <Logo className="hero__logo" />
      </div>

      <div className="container hero__inner">
        <div className="hero__content">
          <p className="hero__kicker hero__in" style={delay(0.25)}>
            <span className="hero__xxx" aria-hidden="true">
              <Icone name="x" size={26} strokeWidth={3.5} />
              <Icone name="x" size={26} strokeWidth={3.5} />
              <Icone name="x" size={26} strokeWidth={3.5} />
            </span>
            Cursos online
          </p>

          <h1 className="hero__title hero__in" style={delay(0.3)}>
            Treine <span>certo</span>
          </h1>

          <p className="hero__subtitle hero__in" style={delay(0.42)}>
            Evolua com técnica. Treine com confiança.
          </p>

          <p className="hero__lead hero__in" style={delay(0.52)}>
            Aprenda a executar cada exercício da maneira correta com aulas práticas e orientações dos professores do Studio HomeFit.
            Mais consciência em cada movimento, mais qualidade no treino e uma evolução consistente.
          </p>

          <div className="hero__ctas hero__in" style={delay(0.62)}>
            <a href="#cursos" className="hero__btn hero__btn--azul">
              Ver os cursos
              <span className="hero__btn-seta" aria-hidden="true">
                <Icone name="arrowRight" size={18} strokeWidth={2.5} />
              </span>
            </a>
            <a href="#planos" className="hero__btn hero__btn--preto">
              Ver planos
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
