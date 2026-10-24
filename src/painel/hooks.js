// Funções de apoio do painel: carregar dados com estado de "carregando/erro" e acessar o contexto.
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AdminContext } from './contexto'

/*
  Carrega dados do painel. Enquanto recarrega (troca de filtro), mantém os dados
  anteriores na tela (sem piscar) e marca "loading" para a tela ficar meio apagada.
*/
export function useAsync(fn, deps) {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })
  const [version, setVersion] = useState(0)
  const key = JSON.stringify([...deps, version])
  const [state, setState] = useState({ key: null, data: undefined, error: null })

  useEffect(() => {
    let alive = true
    Promise.resolve()
      .then(() => fnRef.current())
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((error) => alive && setState((s) => ({ key, data: s.data, error })))
    return () => {
      alive = false
    }
  }, [key])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const mutate = useCallback((update) => setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update })), [])

  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: state.key !== key,
    firstLoad: state.data === undefined && state.key !== key,
    reload,
    mutate,
  }
}

export const useAdmin = () => useContext(AdminContext)
