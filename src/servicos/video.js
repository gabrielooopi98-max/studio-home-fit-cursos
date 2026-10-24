// Links de vídeo das aulas: aceita o link normal do YouTube/Vimeo (copiado do navegador)
// e converte para o formato de incorporação. Outros (Panda, Bunny, .mp4) ficam como estão.
export function toEmbedUrl(raw) {
  const url = String(raw ?? '').trim()
  if (!url) return ''
  const yt = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1`
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([\da-f]+))?/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}${vimeo[2] ? `?h=${vimeo[2]}` : ''}`
  return url
}

// Arquivo de vídeo direto (toca no <video> do navegador). blob: é o arquivo local, antes de enviar.
export const isFileVideo = (url) => /^blob:/.test(url) || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)

// Só links seguros (https) entram no player
export const isValidVideoUrl = (url) => /^https:\/\/[^\s]+$/i.test(String(url ?? '').trim())

// O que o player aceita: links https ou o arquivo local (blob:, criado pelo próprio site)
export const isPlayableUrl = (url) => isValidVideoUrl(url) || /^blob:/.test(String(url ?? ''))

// ---------------------------------------------------------------------------
// Vídeos enviados como arquivo (Supabase Storage, bucket privado)
// Na aula fica guardado "storage:lesson-videos/courses/<curso>/<aula>/<arquivo>".
// ---------------------------------------------------------------------------
export const VIDEO_BUCKET = 'lesson-videos'
const STORED_RE = /^storage:lesson-videos\/(courses\/[\w-]+\/[\w-]+\/[\w.-]+)$/

export const isStoredVideo = (value) => STORED_RE.test(String(value ?? ''))
export const storedPath = (value) => String(value ?? '').match(STORED_RE)?.[1] ?? null
export const toStoredRef = (path) => `storage:${VIDEO_BUCKET}/${path}`

// Nome do arquivo enviado, sem o código do começo
export const storedName = (value) => (storedPath(value)?.split('/').pop() ?? '').replace(/^[a-z0-9]+-/, '')

// Tipos aceitos: MP4 (o mais compatível), WebM e MOV (iPhone)
const VIDEO_TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }
export const VIDEO_ACCEPT = '.mp4,.m4v,.webm,.mov,video/mp4,video/webm,video/quicktime'

export function videoFileInfo(file) {
  const ext = (String(file?.name ?? '').match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()
  const byType = Object.entries(VIDEO_TYPES).find(([, t]) => t === file?.type)?.[0]
  const kind = VIDEO_TYPES[ext] ? ext : byType
  if (!kind) return { error: 'Formato não aceito. Envie um vídeo MP4, WebM ou MOV.' }
  if (!(file.size > 0)) return { error: 'O arquivo está vazio.' }
  // MOV gravado no celular costuma ser H.264: servido como MP4, toca em todos os navegadores
  return { ext: kind === 'webm' ? 'webm' : kind === 'mov' ? 'mov' : 'mp4', contentType: kind === 'webm' ? 'video/webm' : 'video/mp4' }
}

// Caminho do arquivo: o mesmo arquivo na mesma aula gera sempre o mesmo caminho (permite retomar o envio)
export function videoObjectPath(courseId, lessonId, file, ext) {
  const key = `${file.size.toString(36)}${Math.floor(file.lastModified || 0).toString(36)}`
  const base =
    String(file.name)
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'video'
  return `courses/${courseId}/${lessonId}/${key}-${base}.${ext}`
}

// Duração do arquivo (segundos), lida no próprio navegador antes do envio; null se não der para ler
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    let timer
    const done = (seconds) => {
      clearTimeout(timer)
      v.onloadedmetadata = v.onerror = null
      v.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(seconds)
    }
    timer = setTimeout(() => done(null), 10000)
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration >= 1 ? Math.round(v.duration) : null)
    v.onerror = () => done(null)
    v.src = url
  })
}

export const formatBytes = (n) => {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace('.', ',')} GB`
  const mb = Math.max(0.1, n / 1024 ** 2)
  return `${mb.toFixed(mb >= 100 ? 0 : 1).replace('.', ',')} MB`
}
