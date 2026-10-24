// Ponto de entrada: liga o site na página (index.html) e carrega os estilos gerais.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilos/global.css'
import Site from './Site.jsx'
import { ProvedoresDoSite } from './estado/Provedores.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProvedoresDoSite>
      <Site />
    </ProvedoresDoSite>
  </StrictMode>,
)
