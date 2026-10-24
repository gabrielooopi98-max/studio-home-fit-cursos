// Atalhos para usar o estado global: useStore (catálogo), useAuth (login), useLibrary (cursos do aluno).
import { useContext } from 'react'
import { AuthContext, LibraryContext, StoreContext } from './contextos'

export const useStore = () => useContext(StoreContext)
export const useAuth = () => useContext(AuthContext)
export const useLibrary = () => useContext(LibraryContext)
