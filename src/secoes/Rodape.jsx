// Rodapé: contatos, redes sociais e links.
import Icone from '../componentes/Icone'
import Logo from '../componentes/Logo'
import { SITE } from '../dados/site'
import { useStore } from '../estado/hooks'

// Contatos e redes vêm das configurações da loja (painel de ADM); vazio = não aparece
export default function Rodape() {
  const year = new Date().getFullYear()
  const { settings, courses } = useStore()
  const instagram = settings?.instagram
  const youtube = settings?.youtube
  const whatsapp = settings?.whatsapp
  const email = settings?.contactEmail

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo light />
          <p>
            Academia e escola de técnica de treino. Ensinamos você a executar cada exercício com segurança, eficiência e
            confiança.
          </p>
          <div className="socials">
            {instagram && (
              <a href={instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Icone name="instagram" size={18} />
              </a>
            )}
            {youtube && (
              <a href={youtube} target="_blank" rel="noreferrer" aria-label="YouTube">
                <Icone name="youtube" size={18} />
              </a>
            )}
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <Icone name="message" size={18} />
              </a>
            )}
          </div>
        </div>

        <div>
          <h4>Cursos</h4>
          <ul>
            {courses.slice(0, 3).map((c) => (
              <li key={c.id}>
                <a href="#cursos">{c.title}</a>
              </li>
            ))}
            <li>
              <a href="#cursos">Todos os cursos</a>
            </li>
          </ul>
        </div>

        <div>
          <h4>Studio</h4>
          <ul>
            <li>
              <a href="#professores">Professores</a>
            </li>
            {settings?.comboActive !== false && (
              <li>
                <a href="#planos">Planos</a>
              </li>
            )}
            <li>
              <a href="#faq">Dúvidas</a>
            </li>
            <li>
              <a href="#/meus-cursos">Área do aluno</a>
            </li>
          </ul>
        </div>

        <div>
          <h4>Contato</h4>
          <ul>
            {email && (
              <li>
                <a href={`mailto:${email}`}>{email}</a>
              </li>
            )}
            {whatsapp && (
              <li>
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </li>
            )}
          </ul>
          <div className="footer__secure">
            <Icone name="lock" size={16} /> Compra 100% segura
          </div>
        </div>
      </div>

      <div className="container footer__bottom">
        <p>
          © {year} {SITE.name}. Todos os direitos reservados.
        </p>
        <nav className="footer__legal" aria-label="Documentos">
          <a href="#/termos">Termos de Uso</a>
          <a href="#/privacidade">Política de Privacidade</a>
        </nav>
        <p>Os cursos não substituem acompanhamento profissional individual.</p>
      </div>
    </footer>
  )
}
