// Área do aluno (#/meus-cursos): cursos comprados, player das aulas e progresso.
import { useEffect, useState } from 'react'
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import { img, imgSet } from '../dados/site'
import { backend } from '../servicos/banco'
import { isFileVideo, isPlayableUrl, toEmbedUrl } from '../servicos/video'
import { useAuth, useLibrary, useStore } from '../estado/hooks'

const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0)
const flatLessons = (curriculum) => curriculum.flatMap((mod) => mod.lessons.map((l) => ({ ...l, module: mod })))

function ProgressBar({ value, label }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  )
}

// Faixa escura do topo, com a logo e o link de volta
function MemberTop({ back, children }) {
  return (
    <section className="member-top">
      <div className="container">
        <div className="member-top__bar">
          <Logo light className="member-top__logo" />
        </div>
        <a href={back.href} className="member-top__back">
          <Icone name="arrowLeft" size={16} /> {back.label}
        </a>
        {children}
      </div>
    </section>
  )
}

// Aviso de página (sem cursos, curso bloqueado, entrar na conta...)
function Notice({ top, icon, title, text, actions }) {
  return (
    <main className="member" id="conteudo">
      <MemberTop back={top.back}>
        <span className="eyebrow eyebrow--dark">Área do aluno</span>
        <h1 className="member-top__title member-top__title--sm">{top.title}</h1>
      </MemberTop>
      <section className="section member-body">
        <div className="container">
          <div className="member-empty">
            <span className="member-empty__icon">
              <Icone name={icon} size={28} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
            <div className="notfound__actions">{actions}</div>
          </div>
        </div>
      </section>
    </main>
  )
}

function Loading() {
  return (
    <main className="member" id="conteudo" aria-busy="true">
      <MemberTop back={{ href: '#inicio', label: 'Voltar ao site' }}>
        <span className="eyebrow eyebrow--dark">Área do aluno</span>
        <h1 className="member-top__title">
          Meus <span className="hl">cursos</span>
        </h1>
      </MemberTop>
      <section className="section member-body">
        <div className="container">
          <div className="mcourses">
            {[0, 1, 2].map((i) => (
              <div key={i} className="mcourse mcourse--skeleton" />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

/* =========================================================
   Biblioteca: cursos comprados com o progresso de cada um
   ========================================================= */
function Library({ courses: allCourses, owned, done }) {
  const courses = allCourses
    .filter((c) => owned.includes(c.id))
    .map((course) => {
      const lessons = flatLessons(course.curriculum)
      const finished = lessons.filter((l) => done.includes(l.id)).length
      return { course, total: lessons.length, finished }
    })
  const totalLessons = courses.reduce((s, c) => s + c.total, 0)
  const totalDone = courses.reduce((s, c) => s + c.finished, 0)

  return (
    <main className="member" id="conteudo">
      <MemberTop back={{ href: '#inicio', label: 'Voltar ao site' }}>
        <span className="eyebrow eyebrow--dark">Área do aluno</span>
        <h1 className="member-top__title">
          Meus <span className="hl">cursos</span>
        </h1>
        <p className="member-top__lead">Assista às aulas no seu ritmo. Seu progresso fica salvo a cada aula concluída.</p>

        {courses.length > 0 && (
          <ul className="member-stats">
            <li>
              <strong>{courses.length}</strong> {courses.length === 1 ? 'curso' : 'cursos'}
            </li>
            <li>
              <strong>{totalDone}</strong> de {totalLessons} aulas concluídas
            </li>
            <li>
              <strong>{percent(totalDone, totalLessons)}%</strong> do total
            </li>
          </ul>
        )}
      </MemberTop>

      <section className="section member-body">
        <div className="container">
          {courses.length === 0 ? (
            <div className="member-empty">
              <span className="member-empty__icon">
                <Icone name="book" size={30} />
              </span>
              <h2>Você ainda não tem cursos</h2>
              <p>Depois da compra, seus cursos aparecem aqui e você já pode começar a assistir às aulas.</p>
              <a href="#cursos" className="btn btn--primary btn--lg">
                Ver cursos <Icone name="arrowRight" size={18} />
              </a>
            </div>
          ) : (
            <div className="mcourses">
              {courses.map(({ course, total, finished }) => {
                const value = percent(finished, total)
                const cta = finished === 0 ? 'Começar' : finished === total ? 'Rever aulas' : 'Continuar'
                const href = `#/meus-cursos/${course.slug}`
                return (
                  <article className="mcourse" key={course.id}>
                    <a href={href} className="mcourse__media" tabIndex={-1} aria-hidden="true">
                      <img
                        src={img(course.image, 700)}
                        srcSet={imgSet(course.image)}
                        sizes="(max-width: 640px) 100vw, 320px"
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="mcourse__play">
                        <Icone name="play" size={18} />
                      </span>
                    </a>
                    <div className="mcourse__body">
                      <p className="mcourse__tag">{course.tag}</p>
                      <h3>
                        <a href={href}>{course.title}</a>
                      </h3>
                      <div className="mcourse__progress">
                        <ProgressBar value={value} label={`Progresso em ${course.title}`} />
                        <span>
                          {finished} de {total} aulas · <strong>{value}%</strong>
                        </span>
                      </div>
                      <a href={href} className="btn btn--sm btn--primary btn--block">
                        {cta} <Icone name="arrowRight" size={16} />
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

/* =========================================================
   Player: vídeo da aula + lista de módulos e aulas
   ========================================================= */
function Video({ lesson, course, loading, onEnded }) {
  if (loading) {
    return (
      <div className="video video--soon">
        <div className="video__soon">
          <span className="spinner spinner--light" aria-hidden="true" />
          <span>Carregando a aula…</span>
        </div>
      </div>
    )
  }

  const src = toEmbedUrl(lesson.video)
  if (!src || !isPlayableUrl(src)) {
    return (
      <div className="video video--soon">
        <img src={img(course.image, 1200)} alt="" />
        <div className="video__soon">
          <span className="video__soon-icon">
            <Icone name="video" size={26} />
          </span>
          <strong>Vídeo em breve</strong>
          <span>Esta aula está sendo preparada pela equipe do Studio HomeFit.</span>
        </div>
      </div>
    )
  }

  if (isFileVideo(src)) {
    return (
      <div className="video">
        <video key={lesson.id} src={src} controls playsInline controlsList="nodownload" onEnded={onEnded} />
      </div>
    )
  }

  return (
    <div className="video">
      <iframe
        key={lesson.id}
        src={src}
        title={lesson.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

function Player({ course, done, onToggleDone, onMarkDone }) {
  const curriculum = course.curriculum.filter((m) => m.lessons.length)
  const all = flatLessons(curriculum)

  // links dos vídeos: o banco só entrega para quem comprou (ou é admin)
  const [videos, setVideos] = useState({ courseId: null, map: {} })
  useEffect(() => {
    let alive = true
    backend
      .getLessonVideos(course.id)
      .then((map) => alive && setVideos({ courseId: course.id, map }))
      .catch(() => alive && setVideos({ courseId: course.id, map: {} }))
    return () => {
      alive = false
    }
  }, [course.id])
  const videosReady = videos.courseId === course.id
  const lessons = all.map((l) => ({ ...l, video: videos.map[l.id] || l.videoUrl || '' }))

  // abre na primeira aula ainda não concluída
  const [currentId, setCurrentId] = useState(() => (lessons.find((l) => !done.includes(l.id)) ?? lessons[0])?.id)

  if (!lessons.length) {
    return (
      <Notice
        top={{ back: { href: '#/meus-cursos', label: 'Meus cursos' }, title: course.title }}
        icon="video"
        title="Aulas em breve"
        text="As aulas deste curso estão sendo preparadas. Assim que forem publicadas, aparecem aqui."
        actions={
          <a href="#/meus-cursos" className="btn btn--primary btn--lg">
            Meus cursos <Icone name="arrowRight" size={18} />
          </a>
        }
      />
    )
  }

  const index = Math.max(0, lessons.findIndex((l) => l.id === currentId))
  const lesson = lessons[index]
  const prev = lessons[index - 1]
  const next = lessons[index + 1]
  const isDone = done.includes(lesson.id)
  const finished = lessons.filter((l) => done.includes(l.id)).length
  const value = percent(finished, lessons.length)

  const go = (id) => {
    setCurrentId(id)
    document.querySelector('.player__main')?.scrollIntoView({ block: 'start' })
  }

  return (
    <main className="member member--player" id="conteudo">
      <MemberTop back={{ href: '#/meus-cursos', label: 'Meus cursos' }}>
        <p className="member-top__tag">{course.tag}</p>
        <h1 className="member-top__title member-top__title--sm">{course.title}</h1>
      </MemberTop>

      <section className="player">
        <div className="container player__grid">
          <div className="player__main">
            <Video lesson={lesson} course={course} loading={!videosReady} onEnded={() => onMarkDone(lesson.id)} />

            <div className="player__info">
              <div>
                <p className="player__module">
                  Módulo {curriculum.indexOf(lesson.module) + 1} · {lesson.module.title}
                </p>
                <h2 className="player__title">{lesson.title}</h2>
              </div>

              <div className="player__actions">
                <button
                  type="button"
                  className={`btn btn--sm ${isDone ? 'btn--done' : 'btn--outline'}`}
                  onClick={() => onToggleDone(lesson.id)}
                  aria-pressed={isDone}
                >
                  <Icone name="check" size={16} strokeWidth={3} /> {isDone ? 'Aula concluída' : 'Marcar como concluída'}
                </button>
                <div className="player__nav">
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => prev && go(prev?.id)}
                    disabled={!prev}
                    aria-label="Aula anterior"
                  >
                    <Icone name="arrowLeft" size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--primary"
                    onClick={() => {
                      onMarkDone(lesson.id)
                      // `?.`: o React Compiler usa o id como dependência do handler (lido no render)
                      if (next) go(next?.id)
                    }}
                  >
                    {next ? (
                      <>
                        Próxima aula <Icone name="arrowRight" size={16} />
                      </>
                    ) : (
                      <>
                        Concluir curso <Icone name="award" size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="player__side" aria-label="Aulas do curso">
            <div className="player__progress">
              <div>
                <strong>{value}% concluído</strong>
                <span>
                  {finished} de {lessons.length} aulas
                </span>
              </div>
              <ProgressBar value={value} label={`Progresso em ${course.title}`} />
            </div>

            <div className="player__modules">
              {curriculum.map((mod, m) => {
                const modDone = mod.lessons.filter((l) => done.includes(l.id)).length
                return (
                  <section className="pmod" key={mod.id}>
                    <h3 className="pmod__title">
                      <span>Módulo {m + 1}</span>
                      {mod.title}
                      <small>
                        {modDone}/{mod.lessons.length} aulas
                      </small>
                    </h3>
                    <ol className="pmod__lessons">
                      {mod.lessons.map((l) => {
                        const current = l.id === lesson.id
                        const lDone = done.includes(l.id)
                        return (
                          <li key={l.id}>
                            <button
                              type="button"
                              className={`plesson ${current ? 'is-current' : ''} ${lDone ? 'is-done' : ''}`}
                              onClick={() => go(l.id)}
                              aria-current={current ? 'true' : undefined}
                            >
                              <span className="plesson__status" aria-hidden="true">
                                <Icone name={lDone ? 'check' : 'play'} size={12} strokeWidth={lDone ? 3.2 : 2} />
                              </span>
                              <span className="plesson__title">{l.title}</span>
                              {l.duration && <span className="plesson__time">{l.duration}</span>}
                              {lDone && <span className="sr-only">(concluída)</span>}
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                )
              })}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default function AreaDoAluno({ courseId }) {
  const store = useStore()
  const auth = useAuth()
  const library = useLibrary()

  if (store.status === 'loading' || (auth.enabled && !auth.ready) || (auth.user && !library.loaded)) return <Loading />

  // Com o banco ligado, a área do aluno exige login
  if (auth.enabled && !auth.user) {
    const next = encodeURIComponent(courseId ? `/meus-cursos/${courseId}` : '/meus-cursos')
    return (
      <Notice
        top={{ back: { href: '#inicio', label: 'Voltar ao site' }, title: 'Entre para ver seus cursos' }}
        icon="lock"
        title="Acesse sua conta"
        text="Entre com o e-mail usado na compra para assistir às aulas. Ainda não tem conta? Crie em menos de um minuto."
        actions={
          <>
            <a href={`#/entrar?next=${next}`} className="btn btn--primary btn--lg">
              Entrar <Icone name="arrowRight" size={18} />
            </a>
            <a href={`#/cadastro?next=${next}`} className="btn btn--outline btn--lg">
              Criar conta
            </a>
          </>
        }
      />
    )
  }

  if (!courseId) return <Library courses={store.courses} owned={library.owned} done={library.done} />

  const course = store.findCourse(courseId)
  // o admin pode assistir a qualquer curso para conferir o conteúdo
  if (!course || !(library.owns(course.id) || auth.isAdmin)) {
    return (
      <Notice
        top={{ back: { href: '#/meus-cursos', label: 'Meus cursos' }, title: course ? course.title : 'Curso não encontrado' }}
        icon="lock"
        title={course ? 'Este curso ainda não foi liberado' : 'Não encontramos este curso'}
        text={
          course
            ? 'Compre o curso ou o Combo Completo para assistir a todas as aulas.'
            : 'Volte para os seus cursos e escolha um da lista.'
        }
        actions={
          <a href={course ? '#cursos' : '#/meus-cursos'} className="btn btn--primary btn--lg">
            {course ? 'Ver cursos' : 'Meus cursos'} <Icone name="arrowRight" size={18} />
          </a>
        }
      />
    )
  }

  return (
    <Player
      key={course.id}
      course={course}
      done={library.done}
      onToggleDone={library.toggleDone}
      onMarkDone={library.markDone}
    />
  )
}
