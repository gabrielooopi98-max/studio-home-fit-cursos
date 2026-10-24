// Logo do Studio HomeFit, na versão clara ou escura, com link para o topo.
import logoBranca from '../imagens/logo-homefit-branca.svg'
import logoEscura from '../imagens/logo-homefit-escura.svg'

export default function Logo({ light = false, className = '' }) {
  return (
    <a href="#inicio" className={`logo ${className}`}>
      <img src={light ? logoBranca : logoEscura} alt="Studio HomeFit, ir para o início" width="626" height="178" />
    </a>
  )
}
