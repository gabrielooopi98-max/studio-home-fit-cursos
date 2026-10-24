// Envio de vídeo em partes (protocolo TUS do Supabase Storage). Carregado só no painel.
// Se a internet cair, ele tenta de novo sozinho e continua de onde parou; se a página for
// recarregada, enviar o mesmo arquivo na mesma aula retoma o envio anterior.
import { Upload } from 'tus-js-client'
import { SUPABASE_KEY, SUPABASE_URL } from './supabase'
import { VIDEO_BUCKET } from './video'

// O Supabase exige partes de exatamente 6 MB
const CHUNK = 6 * 1024 * 1024

const uploadError = (err) => {
  const status = err?.originalResponse?.getStatus?.() ?? 0
  const body = String(err?.originalResponse?.getBody?.() ?? err?.message ?? '')
  if (status === 413 || /maximum allowed size|too large|payload/i.test(body))
    return 'O vídeo passou do limite de tamanho do Supabase. No plano grátis o limite é 50 MB por arquivo; no plano Pro dá para aumentar em Storage > Settings.'
  if (/bucket not found|NoSuchBucket/i.test(body))
    return 'O local dos vídeos ainda não existe no Supabase. Rode o arquivo supabase/migrations/0003_videos.sql no SQL Editor (veja o SUPABASE.md).'
  if (/mime|content.?type/i.test(body)) return 'Formato não aceito. Envie um vídeo MP4, WebM ou MOV.'
  if (status === 401 || status === 403 || /row-level security|unauthorized|jwt/i.test(body))
    return 'Sem permissão para enviar. Entre de novo como administrador e tente outra vez.'
  if (!status) return 'A conexão caiu durante o envio. Confira a internet e envie o mesmo arquivo de novo: ele continua de onde parou.'
  return `Não foi possível enviar o vídeo (erro ${status}). Tente de novo.`
}

export function uploadResumable({ sb, path, file, contentType, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000, 20000, 30000],
      chunkSize: CHUNK,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: { apikey: SUPABASE_KEY, 'x-upsert': 'true' },
      metadata: { bucketName: VIDEO_BUCKET, objectName: path, contentType, cacheControl: '3600' },
      // envio longo: pega o token de acesso atualizado antes de cada parte
      onBeforeRequest: async (req) => {
        const { data } = await sb.auth.getSession()
        if (data.session) req.setHeader('authorization', `Bearer ${data.session.access_token}`)
      },
      onProgress: (sent, total) => onProgress?.(sent, total),
      onError: (err) => reject(new Error(uploadError(err))),
      onSuccess: () => resolve(path),
    })

    if (signal) {
      if (signal.aborted) return reject(Object.assign(new Error('Envio cancelado.'), { name: 'AbortError' }))
      signal.addEventListener(
        'abort',
        () => {
          upload.abort(true).catch(() => {})
          reject(Object.assign(new Error('Envio cancelado.'), { name: 'AbortError' }))
        },
        { once: true },
      )
    }

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (signal?.aborted) return
        if (previous.length) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })
      .catch(() => upload.start())
  })
}
