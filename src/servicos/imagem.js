/*
  Capa de curso: reduz e compacta a foto no próprio navegador antes de enviar.
  Uma foto de celular (vários MB) vira um arquivo leve, sem diferença visível no site:
  o lado maior fica com no máximo 1600px (o tamanho da capa no topo da página do curso)
  e o formato é WebP. Navegador que não gera WebP (Safari antigo) recebe JPEG.
  Se não der para ler a imagem, ou se o resultado não ficar menor, envia o arquivo original.
*/
const LADO_MAXIMO = 1600
const QUALIDADE = 0.82

const gerar = (canvas, tipo) => new Promise((resolve) => canvas.toBlob(resolve, tipo, QUALIDADE))

export async function otimizarImagem(file) {
  let bitmap
  try {
    // respeita a rotação da foto (EXIF) como o celular mostra
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  let blob = await gerar(canvas, 'image/webp')
  if (!blob || blob.type !== 'image/webp') {
    // JPEG não tem transparência: fundo branco no lugar
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    blob = await gerar(canvas, 'image/jpeg')
  }
  bitmap.close?.()

  if (!blob || blob.size >= file.size) return file
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'capa'}.${ext}`, { type: blob.type })
}
