// Estado global do site: catálogo de cursos, login do usuário e cursos que ele tem.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { backend } from '../servicos/banco'
import { AuthContext, LibraryContext, StoreContext } from './contextos'
import { useAuth } from './hooks'

// Todos os contextos do app, na ordem certa (a biblioteca depende do usuário logado)
export function ProvedoresDoSite({ children }) {
  return (
    <StoreProvider>
      <AuthProvider>
        <LibraryBridge>{children}</LibraryBridge>
      </AuthProvider>
    </StoreProvider>
  )
}

function LibraryBridge({ children }) {
  const { user } = useAuth()
  return <LibraryProvider userId={user?.id ?? null}>{children}</LibraryProvider>
}

/* =========================================================
   Catálogo: cursos publicados e configurações da loja
   ========================================================= */
export function StoreProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', courses: [], settings: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    backend
      .getCatalog()
      .then(({ courses, settings }) => alive && setState({ status: 'ready', courses, settings, error: null }))
      .catch((error) => alive && setState((s) => ({ ...s, status: 'error', error: error.message })))
    return () => {
      alive = false
    }
  }, [version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      findCourse: (idOrSlug) => state.courses.find((c) => c.id === idOrSlug || c.slug === idOrSlug),
    }),
    [state, refresh],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/* =========================================================
   Conta: sessão do Supabase + perfil (nome, papel)
   ========================================================= */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!backend.features.auth)
  const [profile, setProfile] = useState(null)
  // perfil que não carregou (sem internet, por exemplo): as telas seguem como conta comum em vez de esperar
  const [profileFailed, setProfileFailed] = useState(null)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!backend.features.auth) return
    let alive = true
    backend.getSession().then((s) => {
      if (!alive) return
      setSession(s)
      setReady(true)
    })
    const off = backend.onAuthChange((event, s) => {
      // o Supabase pede para não chamar o banco dentro deste callback: adia para o próximo ciclo
      setTimeout(() => {
        if (!alive) return
        setSession(s)
        setReady(true)
        if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      }, 0)
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  const userId = session?.user?.id ?? null
  const [profileVersion, setProfileVersion] = useState(0)

  useEffect(() => {
    if (!userId) return
    let alive = true
    backend
      .getProfile(userId)
      .then((p) => {
        if (!alive) return
        setProfile(p)
        setProfileFailed(p?.id === userId ? null : userId)
      })
      .catch(() => alive && setProfileFailed(userId))
    return () => {
      alive = false
    }
  }, [userId, profileVersion])

  // o perfil só vale para o usuário atual (evita mostrar dados da sessão anterior)
  const currentProfile = profile && profile.id === userId ? profile : null

  const value = useMemo(
    () => ({
      enabled: backend.features.auth,
      ready,
      session,
      user: session?.user ?? null,
      profile: currentProfile,
      profileLoading: !!userId && !currentProfile && profileFailed !== userId,
      isAdmin: currentProfile?.role === 'admin',
      recovery,
      clearRecovery: () => setRecovery(false),
      refreshProfile: () => setProfileVersion((v) => v + 1),
      signIn: (data) => backend.signIn(data),
      signUp: (data) => backend.signUp(data),
      signOut: () => backend.signOut(),
      requestPasswordReset: (email) => backend.requestPasswordReset(email),
      updatePassword: (password) => backend.updatePassword(password),
    }),
    [ready, session, currentProfile, userId, recovery, profileFailed],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* =========================================================
   Meus cursos: cursos comprados e aulas concluídas
   ========================================================= */
export function LibraryProvider({ userId, children }) {
  // no modo demonstração não há login: a biblioteca é do navegador
  const owner = backend.features.auth ? userId : 'local'
  const [lib, setLib] = useState({ owner: null, owned: [], done: [] })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!owner) return
    let alive = true
    backend
      .getLibrary(owner)
      .then(({ owned, done }) => alive && setLib({ owner, owned, done }))
      .catch(() => alive && setLib({ owner, owned: [], done: [] }))
    return () => {
      alive = false
    }
  }, [owner, version])

  const current = lib.owner === owner && owner ? lib : { owner, owned: [], done: [] }
  const loaded = !owner || lib.owner === owner

  const setDone = useCallback(
    (lessonId, done) => {
      // atualiza na tela na hora e grava em seguida; se falhar, recarrega do banco
      setLib((l) => ({
        ...l,
        done: done ? [...new Set([...l.done, lessonId])] : l.done.filter((id) => id !== lessonId),
      }))
      backend.setLessonDone(owner, lessonId, done).catch(() => setVersion((v) => v + 1))
    },
    [owner],
  )

  const value = useMemo(
    () => ({
      loaded,
      owned: current.owned,
      done: current.done,
      owns: (courseId) => current.owned.includes(courseId),
      toggleDone: (lessonId) => setDone(lessonId, !current.done.includes(lessonId)),
      markDone: (lessonId) => !current.done.includes(lessonId) && setDone(lessonId, true),
      refresh: () => setVersion((v) => v + 1),
    }),
    [loaded, current.owned, current.done, setDone],
  )
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
