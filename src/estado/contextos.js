// Contextos do React usados pelos provedores (catálogo, login e biblioteca do aluno).
import { createContext } from 'react'

// Catálogo (cursos publicados + configurações da loja)
export const StoreContext = createContext(null)

// Sessão, perfil e papel (aluno/admin)
export const AuthContext = createContext(null)

// Cursos comprados e aulas concluídas do usuário
export const LibraryContext = createContext(null)
