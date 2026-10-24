// Cliente completo do Supabase (login, banco, arquivos, funções). Carregado sob demanda pelo banco.js:
// quem só visita o site não baixa esta biblioteca.
import { createClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from './supabase'

export const createSupabase = () =>
  createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      // PKCE: o link do e-mail volta com um código de uso único (não expõe o token na URL)
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  })
