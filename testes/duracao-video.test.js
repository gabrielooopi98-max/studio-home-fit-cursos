// Leitura da duração direto do cabeçalho de arquivos MP4/MOV (src/servicos/video.js). Rodar: npm test
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { durationFromMp4, readVideoDuration } from '../src/servicos/video.js'

// ---------- montagem de arquivos MP4 de mentira (só as caixas que importam) ----------
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const u64 = (n) => [...u32(Math.floor(n / 2 ** 32)), ...u32(n >>> 0)]
const ascii = (s) => [...s].map((c) => c.charCodeAt(0))
const box = (type, body) => [...u32(8 + body.length), ...ascii(type), ...body]

const mvhd = ({ timescale, duration, version = 0 }) =>
  box('mvhd', [
    version, 0, 0, 0,
    ...(version === 1 ? [...u64(0), ...u64(0), ...u32(timescale), ...u64(duration)] : [...u32(0), ...u32(0), ...u32(timescale), ...u32(duration)]),
    ...new Array(80).fill(0),
  ])
const ftyp = box('ftyp', ascii('isom0000isomiso2'))
const moov = (opts) => box('moov', [...box('udta', [1, 2, 3, 4]), ...mvhd(opts)])
const mdat = (bytes) => box('mdat', new Array(bytes).fill(7))
const arquivo = (partes, nome = 'aula.mp4', type = 'video/mp4') => new File([new Uint8Array(partes.flat())], nome, { type })

describe('duração pelo cabeçalho do arquivo', () => {
  test('cabeçalho no começo (MP4 preparado para internet)', async () => {
    const f = arquivo([ftyp, moov({ timescale: 1000, duration: 754_000 }), mdat(5000)])
    assert.equal(await durationFromMp4(f), 754)
  })

  test('cabeçalho no fim, depois do vídeo (como grava câmera e celular)', async () => {
    const f = arquivo([ftyp, mdat(200_000), moov({ timescale: 600, duration: 600 * 95 })], 'IMG_0001.MOV', 'video/quicktime')
    assert.equal(await durationFromMp4(f), 95)
  })

  test('caixa de vídeo com tamanho de 64 bits (arquivos acima de 4 GB)', async () => {
    const corpo = new Array(3000).fill(1)
    const mdatGrande = [...u32(1), ...ascii('mdat'), ...u64(16 + corpo.length), ...corpo]
    const f = arquivo([ftyp, mdatGrande, moov({ timescale: 30000, duration: 30000 * 61 })])
    assert.equal(await durationFromMp4(f), 61)
  })

  test('mvhd versão 1 (64 bits)', async () => {
    const f = arquivo([ftyp, moov({ timescale: 90000, duration: 90000 * 3725, version: 1 })])
    assert.equal(await durationFromMp4(f), 3725)
  })

  test('arredonda para o segundo mais próximo', async () => {
    const f = arquivo([ftyp, moov({ timescale: 1000, duration: 12_600 })])
    assert.equal(await durationFromMp4(f), 13)
  })

  test('arquivo que não é MP4, cortado ou sem duração: null (sem travar)', async () => {
    assert.equal(await durationFromMp4(new File([new Uint8Array(500).fill(9)], 'x.mp4')), null)
    assert.equal(await durationFromMp4(new File([], 'vazio.mp4')), null)
    assert.equal(await durationFromMp4(arquivo([ftyp, mdat(100)])), null)
    assert.equal(await durationFromMp4(arquivo([ftyp, moov({ timescale: 0, duration: 100 })])), null)
    const cortado = arquivo([ftyp, moov({ timescale: 1000, duration: 5000 })]).slice(0, 40)
    assert.equal(await durationFromMp4(new File([cortado], 'cortado.mp4')), null)
  })

  test('readVideoDuration usa o cabeçalho em MP4 e MOV', async () => {
    assert.equal(await readVideoDuration(arquivo([ftyp, moov({ timescale: 1000, duration: 42_000 })])), 42)
    assert.equal(await readVideoDuration(arquivo([ftyp, mdat(10), moov({ timescale: 600, duration: 6000 })], 'aula.MOV', '')), 10)
  })
})
