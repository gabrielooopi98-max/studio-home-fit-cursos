// Respostas JSON, CORS e registro (log) das Edge Functions

// Só o próprio site (SITE_URL) e o ambiente local podem chamar as funções pelo navegador.
// CORS não é segurança de acesso: quem decide é o login conferido dentro de cada função.
export function corsHeaders(req, siteUrl) {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = [siteUrl.replace(/\/+$/, ''), 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:4174']
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export const json = (data, status, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

export const text = (body, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

// Lê o corpo JSON com limite de tamanho (corpo grande demais ou inválido vira null)
export async function readJson(req, maxBytes = 20000) {
  const declared = Number(req.headers.get('Content-Length') ?? 0)
  if (declared > maxBytes) return null
  const raw = await req.text()
  if (raw.length > maxBytes) return null
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

// Log em uma linha JSON. Só ids e códigos: nunca token, senha, e-mail ou dados de cartão.
export function log(level, event, fields = {}) {
  const line = JSON.stringify({ level, event, ...fields })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

// Comparação em tempo constante (não revela onde dois textos diferem)
export function safeEqual(a, b) {
  a = String(a ?? '')
  b = String(b ?? '')
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
