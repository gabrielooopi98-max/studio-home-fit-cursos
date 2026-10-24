// Esqueletos de carregamento: blocos cinza com um brilho passando, no formato de cada tela,
// enquanto a página (ou os dados dela) ainda está chegando.
import Logo from './Logo'

// Bloco genérico: largura e altura opcionais (ex.: <Barra w="60%" h={14} />)
function Barra({ w = '100%', h = 14, className = '' }) {
  return <span className={`sk ${className}`} style={{ width: w, height: h }} />
}

// Topo escuro das páginas internas (área do aluno, minha conta, documentos)
function TopoEscuro({ titulo = '45%' }) {
  return (
    <section className="member-top sk-topo">
      <div className="container">
        <div className="member-top__bar">
          <Logo light className="member-top__logo" />
        </div>
        <Barra w={120} h={14} className="sk--escuro" />
        <Barra w={160} h={12} className="sk--escuro sk-topo__olho" />
        <Barra w={titulo} h={44} className="sk--escuro sk-topo__titulo" />
        <Barra w="60%" h={14} className="sk--escuro" />
      </div>
    </section>
  )
}

// Cartões cinza no corpo da página (usado também em Minha conta enquanto o perfil carrega)
export function EsqueletoCartoes({ quantidade = 3 }) {
  return (
    <section className="section sk-corpo" aria-busy="true">
      <div className="container sk-grade">
        {Array.from({ length: quantidade }, (_, i) => (
          <div key={i} className="sk-cartao">
            <Barra w="40%" h={18} />
            <Barra />
            <Barra w="85%" />
            <Barra w="70%" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function EsqueletoPagina() {
  return (
    <main className="member" aria-busy="true" aria-label="Carregando">
      <TopoEscuro />
      <EsqueletoCartoes />
    </main>
  )
}

export function EsqueletoCurso() {
  return (
    <main className="member" aria-busy="true" aria-label="Carregando o curso">
      <TopoEscuro titulo="55%" />
      <section className="section sk-corpo">
        <div className="container sk-curso">
          <div className="sk-curso__main">
            <Barra w="30%" h={22} />
            <Barra />
            <Barra w="92%" />
            <Barra w="75%" />
            <Barra w="35%" h={22} className="sk-curso__subtitulo" />
            {Array.from({ length: 4 }, (_, i) => (
              <Barra key={i} h={58} className="sk-curso__modulo" />
            ))}
          </div>
          <div className="sk-cartao sk-curso__compra">
            <Barra w="45%" h={16} />
            <Barra w="70%" h={46} />
            <Barra w="60%" />
            <Barra h={52} className="sk-curso__botao" />
            <Barra h={46} />
          </div>
        </div>
      </section>
    </main>
  )
}

export function EsqueletoLogin() {
  return (
    <div className="sk-login" aria-busy="true" aria-label="Carregando">
      <div className="sk-login__foto" />
      <div className="sk-login__lado">
        <Logo />
        <div className="sk-cartao sk-login__cartao">
          <Barra h={44} />
          <Barra w="70%" h={28} />
          <Barra w="55%" />
          <Barra h={50} className="sk-login__campo" />
          <Barra h={50} />
          <Barra h={52} className="sk-login__botao" />
        </div>
      </div>
    </div>
  )
}

export function EsqueletoPainel() {
  return (
    <div className="sk-painel" aria-busy="true" aria-label="Carregando o painel">
      <aside className="sk-painel__menu">
        <Logo light />
        {Array.from({ length: 6 }, (_, i) => (
          <Barra key={i} h={36} className="sk--escuro" />
        ))}
      </aside>
      <div className="sk-painel__conteudo">
        <Barra w={260} h={34} />
        <div className="sk-painel__kpis">
          {Array.from({ length: 4 }, (_, i) => (
            <Barra key={i} h={110} />
          ))}
        </div>
        <Barra h={320} />
      </div>
    </div>
  )
}
