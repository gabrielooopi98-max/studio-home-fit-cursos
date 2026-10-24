// Dados compartilhados entre as telas do painel (avisos, configurações).
import { createContext } from 'react'

// notify(mensagem, 'ok' | 'error'), refreshSite() e as configurações atuais da loja
export const AdminContext = createContext(null)
