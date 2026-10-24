// Respostas JSON e CORS das Edge Functions

// Só o próprio site (SITE_URL) e o ambiente local podem chamar as funções pelo navegador
export function corsHeaders(req: Request, siteUrl: string) {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = [siteUrl.replace(/\/+$/, ''), 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:4174']
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export const json = (data: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } })
