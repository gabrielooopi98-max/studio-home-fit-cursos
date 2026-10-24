// Página de um curso (#/curso/<link-do-curso>): foto no topo, descrição, módulos e aulas, o que está incluso e a compra.
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import { EsqueletoCurso } from '../componentes/Esqueletos'
import { FormasDePagamento } from '../componentes/Seguranca'
import { COURSE_INCLUDES } from '../dados/conteudo'
import { formatBRL, img } from '../dados/site'
import { useLibrary, useStore } from '../estado/hooks'
import { courseDuration, formatTotal, parseDuration } from '../servicos/duracao'

// Soma a duração das aulas de um módulo ("" se nenhuma tiver duração)
const duracaoDoModulo = (m) => formatTotal(m.lessons.reduce((s, l) => s + (parseDuration(l.duration) ?? 0), 0))

function Modulo({ modulo, numero, aberto }) {
  const total = modulo.lessons.length
  const duracao = duracaoDoModulo(modulo)
  return (
    <li>
      <details className="curso-modulo" open={aberto}>
        <summary>
          <span className="curso-modulo__n">{String(numero).padStart(2, '0')}</span>
          <span className="curso-modulo__nome">
            {modulo.title}
            <small>
              {total} {total === 1 ? 'aula' : 'aulas'}
              {duracao && ` · ${duracao}`}
            </small>
          </span>
          <Icone name="chevronDown" size={18} className="curso-modulo__seta" />
        </summary>
        <ol className="curso-aulas">
          {modulo.lessons.map((l) => (
            <li key={l.id}>
              <Icone name="play" size={11} />
              <span>{l.title}</span>
              {l.duration && <em>{l.duration}</em>}
            </li>
          ))}
        </ol>
      </details>
    </li>
  )
}

export default function PaginaDoCurso({ slug, cartIds, onAdd, onBuyNow }) {
  const store = useStore()
  const library = useLibrary()

  if (store.status !== 'ready') return <EsqueletoCurso />

  const course = store.findCourse(slug)
  if (!course) {
    return (
      <main className="member" id="conteudo">
        <section className="member-top">
          <div className="container">
            <div className="member-top__bar">
              <Logo light className="member-top__logo" />
            </div>
            <a href="#cursos" className="member-top__back">
              <Icone name="arrowLeft" size={16} /> Todos os cursos
            </a>
            <h1 className="member-top__title member-top__title--sm">Curso não encontrado</h1>
            <p className="curso-topo__texto">Esse curso não existe ou não está mais disponível.</p>
          </div>
        </section>
        <section className="section curso-vazio">
          <div className="container">
            <a href="#cursos" className="btn btn--primary btn--lg">
              Ver todos os cursos <Icone name="arrowRight" size={18} />
            </a>
          </div>
        </section>
      </main>
    )
  }

  const discount = course.oldPrice > course.price ? Math.round((1 - course.price / course.oldPrice) * 100) : 0
  const saving = discount > 0 ? course.oldPrice - course.price : 0
  const item = { ...course, kind: 'course' }
  const owned = library.owns(course.id)
  const inCart = cartIds.includes(course.id)
  const modulos = course.curriculum.filter((m) => m.lessons.length)
  const horas = courseDuration(course.curriculum).label || course.hours

  const comprar = owned ? (
    <a href={`#/meus-cursos/${course.slug}`} className="btn btn--primary btn--block btn--lg">
      <Icone name="play" size={18} /> Assistir curso
    </a>
  ) : (
    <button type="button" className="btn btn--primary btn--block btn--lg" onClick={() => onBuyNow(item)}>
      <Icone name="lock" size={18} /> Comprar agora
    </button>
  )

  return (
    <main className="member curso" id="conteudo">
      {/* Topo: foto do curso ao fundo, escurecida, com nome, nível e números */}
      <section className="member-top curso-topo">
        <img
          className="curso-topo__foto"
          src={img(course.image, 1600)}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <div className="container">
          <div className="member-top__bar">
            <Logo light className="member-top__logo" />
          </div>
          <a href="#cursos" className="member-top__back">
            <Icone name="arrowLeft" size={16} /> Todos os cursos
          </a>
          <div className="curso-topo__chips">
            <span className="chip chip--light">{course.level}</span>
            {course.bestseller && <span className="chip chip--blue">Mais vendido</span>}
            {discount > 0 && <span className="curso-topo__off">-{discount}%</span>}
          </div>
          {course.tag && <p className="curso-topo__tag">{course.tag}</p>}
          <h1 className="member-top__title curso-topo__titulo">{course.title}</h1>
          <ul className="curso-topo__meta">
            <li>
              <Icone name="list" size={16} /> {modulos.length} {modulos.length === 1 ? 'módulo' : 'módulos'}
            </li>
            <li>
              <Icone name="video" size={16} /> {course.lessons} {course.lessons === 1 ? 'aula' : 'aulas'}
            </li>
            {horas && (
              <li>
                <Icone name="clock" size={16} /> {horas} de conteúdo
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className="section curso-corpo">
        <div className="container curso-grade">
          <div className="curso-main">
            {course.description && (
              <>
                <h2 className="curso-titulo">
                  <Icone name="book" size={20} /> Sobre o curso
                </h2>
                <p className="curso-desc">{course.description}</p>
              </>
            )}

            <h2 className="curso-titulo">
              <Icone name="list" size={20} /> Conteúdo do curso
            </h2>
            <ol className="curso-modulos">
              {modulos.map((m, i) => (
                <Modulo key={m.id} modulo={m} numero={i + 1} aberto={i === 0} />
              ))}
            </ol>

            <h2 className="curso-titulo">
              <Icone name="checkCircle" size={20} /> O que está incluso
            </h2>
            <ul className="curso-inclui">
              {COURSE_INCLUDES.map((it) => (
                <li key={it.text}>
                  <Icone name={it.icon} size={18} /> {it.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Caixa de compra: acompanha a rolagem no computador */}
          <aside className="buybox curso-compra">
            {discount > 0 && (
              <>
                <span className="buybox__off">
                  <Icone name="tag" size={14} /> {discount}% OFF por tempo limitado
                </span>
                <s>{formatBRL(course.oldPrice)}</s>
              </>
            )}
            <strong className="buybox__price">{formatBRL(course.price)}</strong>
            <p className="buybox__save">
              {saving > 0 ? `Você economiza ${formatBRL(saving)} • pagamento único` : 'Pagamento único • acesso vitalício'}
            </p>

            {comprar}
            {!owned && (
              <button
                type="button"
                className={`btn btn--block ${inCart ? 'btn--added' : 'btn--outline'}`}
                onClick={() => onAdd(item)}
                disabled={inCart}
              >
                {inCart ? (
                  <>
                    <Icone name="check" size={16} strokeWidth={3} /> No carrinho
                  </>
                ) : (
                  <>
                    <Icone name="cart" size={16} /> Adicionar ao carrinho
                  </>
                )}
              </button>
            )}

            <ul className="buybox__trust">
              <li>
                <Icone name="shield" size={16} /> Garantia incondicional de 7 dias
              </li>
              <li>
                <Icone name="zap" size={16} /> Acesso imediato após o pagamento
              </li>
              <li>
                <Icone name="lock" size={16} /> Pagamento criptografado
              </li>
            </ul>
            <FormasDePagamento compact />
          </aside>
        </div>
      </section>

      {/* Celular: barra de compra fixa embaixo */}
      <div className="curso-barra">
        <div>
          {discount > 0 && <s>{formatBRL(course.oldPrice)}</s>}
          <strong>{formatBRL(course.price)}</strong>
        </div>
        {owned ? (
          <a href={`#/meus-cursos/${course.slug}`} className="btn btn--primary">
            <Icone name="play" size={16} /> Assistir
          </a>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => onBuyNow(item)}>
            <Icone name="lock" size={16} /> Comprar agora
          </button>
        )}
      </div>
    </main>
  )
}
