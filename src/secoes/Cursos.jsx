// Seção de cursos: filtro por nível e os cards com preço e botão de compra.
import { useState } from 'react'
import Icone from '../componentes/Icone'
import { LEVELS } from '../dados/conteudo'
import { formatBRL, img, imgSet } from '../dados/site'
import { useLibrary, useStore } from '../estado/hooks'

const levelClass = (level) => (level === 'Iniciante' ? 'a' : level === 'Intermediário' ? 'b' : 'c')

function CourseCard({ course, inCart, owned, onAdd }) {
  const pagina = `#/curso/${course.slug}`
  const discount = course.oldPrice > course.price ? Math.round((1 - course.price / course.oldPrice) * 100) : 0

  return (
    <article className="course">
      {/* foto clicável para o mouse; teclado e leitor de tela usam o link do título (mesmo destino) */}
      <a href={pagina} className="course__media" tabIndex={-1} aria-hidden="true">
        <img
          src={img(course.image, 700)}
          srcSet={imgSet(course.image)}
          sizes="(max-width: 980px) 50vw, 300px"
          alt=""
          width="700"
          height="467"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <span className="course__badges">
          <span className={`level level--${levelClass(course.level)}`}>{course.level}</span>
          {course.bestseller && <span className="badge-best">Mais vendido</span>}
        </span>
        {discount > 0 && (
          <span className="course__off">
            <span>-{discount}%</span>
          </span>
        )}
        <span className="course__peek">
          <span className="course__peek-btn">
            <Icone name="play" size={12} /> Ver Curso
          </span>
        </span>
      </a>

      <div className="course__body">
        <p className="course__tag">{course.tag}</p>
        <h3 className="course__title">
          <a href={pagina}>{course.title}</a>
        </h3>
        <p className="course__desc">{course.description}</p>

        <ul className="course__meta">
          {course.modules?.length > 0 && (
            <li>
              <Icone name="list" size={13} /> {course.modules.length} {course.modules.length === 1 ? 'módulo' : 'módulos'}
            </li>
          )}
          <li>
            <Icone name="video" size={13} /> {course.lessons} {course.lessons === 1 ? 'aula' : 'aulas'}
          </li>
          {course.hours && (
            <li>
              <Icone name="clock" size={13} /> {course.hours}
            </li>
          )}
        </ul>

        <div className="course__foot">
          {/* sempre 3 linhas, com ou sem desconto: os preços ficam alinhados entre os cards */}
          <div className="price">
            <span className="price__de">
              {discount > 0 ? (
                <>
                  de <s>{formatBRL(course.oldPrice)}</s>
                </>
              ) : (
                'Pagamento único'
              )}
            </span>
            <strong>{formatBRL(course.price)}</strong>
            {discount > 0 ? (
              <span className="price__extra price__extra--economia">Economize {formatBRL(course.oldPrice - course.price)}</span>
            ) : (
              <span className="price__extra">Acesso vitalício</span>
            )}
          </div>
          {owned ? (
            <a href={`#/meus-cursos/${course.slug}`} className="btn btn--sm btn--dark course__cta">
              <Icone name="play" size={14} /> Assistir
            </a>
          ) : (
            <button
              type="button"
              className={`btn btn--sm course__cta ${inCart ? 'btn--added' : 'btn--primary'}`}
              onClick={() => onAdd({ ...course, kind: 'course' })}
              disabled={inCart}
            >
              {inCart ? (
                <>
                  <Icone name="check" size={16} strokeWidth={3} /> No carrinho
                </>
              ) : (
                <>
                  <Icone name="cart" size={16} /> Adicionar no carrinho
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function Cursos({ cartIds, onAdd }) {
  const { status, courses, refresh } = useStore()
  const library = useLibrary()
  const [level, setLevel] = useState('Todos')
  const list = level === 'Todos' ? courses : courses.filter((c) => c.level === level)

  return (
    <section className="section courses" id="cursos">
      <div className="container">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow">Nossos cursos</span>
            <h2 className="section__title">
              Domine a execução de <span className="hl">cada movimento</span>
            </h2>
          </div>
          <p className="section__lead">
            Aulas práticas gravadas no Studio HomeFit, 
            com orientações claras para corrigir erros de execução e aprender a realizar cada exercício com a técnica correta.
          </p>
        </div>

        <div className="filters" role="tablist" aria-label="Filtrar por nível">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={level === l}
              className={`filter ${level === l ? 'filter--active' : ''}`}
              onClick={() => setLevel(l)}
            >
              {/* barrinhas de intensidade: 1 (iniciante) a 3 (avançado); "Todos" acende as três */}
              <span className={`filter__bars filter__bars--${l === 'Todos' ? 'all' : levelClass(l)}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {l}
              <span className="filter__count">
                {l === 'Todos' ? courses.length : courses.filter((c) => c.level === l).length}
              </span>
            </button>
          ))}
        </div>

        {status === 'error' ? (
          <div className="courses__state">
            <p>Não foi possível carregar os cursos agora.</p>
            <button type="button" className="btn btn--outline btn--sm" onClick={refresh}>
              <Icone name="refresh" size={16} /> Tentar de novo
            </button>
          </div>
        ) : (
          <div className="courses__grid" aria-busy={status === 'loading'}>
            {status === 'loading'
              ? Array.from({ length: 4 }, (_, i) => <div key={i} className="course course--skeleton" aria-hidden="true" />)
              : list.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    inCart={cartIds.includes(c.id)}
                    owned={library.owns(c.id)}
                    onAdd={onAdd}
                  />
                ))}
            {status === 'ready' && list.length === 0 && (
              <p className="courses__state">Nenhum curso neste nível por enquanto.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
