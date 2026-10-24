// Chaves públicas do projeto (arquivo .env). A service_role NUNCA vai aqui: ela fica só nas Edge Functions.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const isSupabaseConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_KEY.length > 20

// Onde o login guarda a sessão neste navegador
export const AUTH_STORAGE_KEY = 'hf-auth'
