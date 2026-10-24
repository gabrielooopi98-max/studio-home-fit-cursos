// Painel > Cursos > editar: informações, preço e desconto, módulos, aulas e vídeos.
import { useEffect, useRef, useState } from 'react'
import Icone from '../componentes/Icone'
import { img } from '../dados/site'
import { backend } from '../servicos/banco'
import {
  VIDEO_ACCEPT,
  formatBytes,
  isFileVideo,
  isStoredVideo,
  isValidVideoUrl,
  readVideoDuration,
  storedName,
  toEmbedUrl,
  videoFileInfo,
} from '../servicos/video'
import { courseDuration, formatClock, parseDuration } from '../servicos/duracao'
import { brl, slugify, slugTyping } from './formatos'
import PrecoEDesconto from './PrecoEDesconto'
import { fromPricing, pricingErrors, toPricing } from './precos'
import { useAdmin, useAsync } from './hooks'
import { Card, Confirm, Empty, ErrorBox, Field, PageHead, Toggle } from './interface'

const LEVELS = ['Iniciante', 'Intermediário', 'Avançado']
const LEVEL_HELP = {
  Iniciante: 'Para quem está começando ou voltando a treinar.',
  Intermediário: 'Para quem já treina e conhece o básico.',
  Avançado: 'Para quem já treina há bastante tempo.',
}

// endereço completo que o aluno abre para ver as aulas
const courseLink = (slug) => `${window.location.origin}${window.location.pathname}#/meus-cursos/${slug}`
const NEW_COURSE = {
  id: null,
  title: '',
  slug: '',
  tag: '',
  level: 'Iniciante',
  description: '',
  image: '',
  hours: '',
  price: 0,
  oldPrice: null,
  bestseller: false,
  published: false,
  position: 999,
  curriculum: [],
}

const TABS = [
  { id: 'info', label: 'Informações', icon: 'edit' },
  { id: 'preco', label: 'Preço e desconto', icon: 'tag' },
  { id: 'aulas', label: 'Aulas', icon: 'video' },
]

const pickInfo = (c) => ({
  id: c.id,
  title: c.title,
  slug: c.slug,
  tag: c.tag,
  level: c.level,
  description: c.description,
  image: c.image,
  hours: c.manualHours ?? c.hours ?? '',
  // preço original + % de desconto (o preço final é calculado)
  pricing: c.id ? toPricing(c.price, c.oldPrice) : { base: '', discount: null, final: 0 },
  bestseller: c.bestseller,
  published: c.published,
  position: c.position,
})

function validateCourse(c) {
  const e = {}
  if (c.title.trim().length < 2) e.title = 'Dê um nome ao curso (mínimo 2 letras).'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slugify(c.slug))) e.slug = c.slug ? 'Use só letras minúsculas, números e hífens (ex.: agachamento-perfeito).' : 'Preencha o link do curso (ou escreva o nome, que ele é criado sozinho).'
  const p = pricingErrors(c.pricing)
  if (p.base) e.price = p.base
  if (p.discount) e.discount = p.discount
  if (c.description.length > 2000) e.description = 'Máximo de 2.000 caracteres.'
  if (c.image && !/^https:\/\//.test(c.image)) e.image = 'Use um link que comece com https://'
  return e
}

/* =========================================================
   Aba Informações
   ========================================================= */
function InfoTab({ draft, setDraft, errors, isNew, duration, savedSlug }) {
  const { notify } = useAdmin()
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  const upload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await backend.admin.uploadImage(file)
      setDraft((d) => ({ ...d, image: url }))
      notify('Imagem enviada.')
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="editor-grid">
      <Card title="Dados do curso" subtitle="O que você preencher aqui aparece no site.">
        <div className="xform">
          <Field
            label="Nome do curso"
            about="Aparece no card, na página do curso e na área do aluno."
            aside={`${draft.title.length}/120`}
            error={errors.title}
          >
            {(p) => (
              <input
                {...p}
                value={draft.title}
                maxLength={120}
                placeholder="Ex.: Agachamento Perfeito"
                onChange={(e) => {
                  const title = e.target.value
                  setDraft((d) => ({ ...d, title, slug: slugTouched ? d.slug : slugify(title) }))
                }}
              />
            )}
          </Field>

          <Field
            label="Link do curso"
            about="Endereço da página de aulas. É criado a partir do nome, então não precisa mexer."
            error={errors.slug}
          >
            {(p) => (
              <>
                <div className="xprefix">
                  <span>/meus-cursos/</span>
                  <input
                    {...p}
                    value={draft.slug}
                    maxLength={80}
                    placeholder="agachamento-perfeito"
                    onChange={(e) => {
                      setSlugTouched(true)
                      setDraft((d) => ({ ...d, slug: slugTyping(e.target.value) }))
                    }}
                    onBlur={() => {
                      setDraft((d) => ({ ...d, slug: slugify(d.slug) }))
                    }}
                  />
                </div>
                {draft.slug && (
                  <p className="xfield__preview">
                    Link: <code>{courseLink(draft.slug)}</code>
                    {slugify(draft.title) && slugify(draft.title) !== draft.slug && (
                      <button
                        type="button"
                        className="xfield__link"
                        onClick={() => {
                          setSlugTouched(false)
                          setDraft((d) => ({ ...d, slug: slugify(d.title) }))
                        }}
                      >
                        Voltar ao automático
                      </button>
                    )}
                  </p>
                )}
                {!isNew && draft.slug !== savedSlug && (
                  <p className="xfield__warn">
                    <Icone name="alert" size={14} /> Quem tiver o link antigo (por WhatsApp, Instagram...) não vai conseguir abrir o curso.
                  </p>
                )}
              </>
            )}
          </Field>

          <Field
            label="Tema do curso"
            optional
            about="Frase curta que fica em azul, em cima do nome."
            aside={`${draft.tag.length}/80`}
          >
            {(p) => <input {...p} value={draft.tag} maxLength={80} placeholder="Ex.: Membros inferiores" onChange={set('tag')} />}
          </Field>

          <Field
            label="Nível do curso"
            about="Aparece na foto do curso e serve de filtro no site."
            hint={LEVEL_HELP[draft.level]}
          >
            {(p) => (
              <select {...p} value={draft.level} onChange={set('level')} className="xinput--mid">
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label="Descrição do curso"
            optional
            about='O card mostra só o começo. O texto inteiro aparece em "Ver curso".'
            hint="Conte o que o aluno vai aprender e para quem é o curso."
            aside={`${draft.description.length}/2000`}
            error={errors.description}
          >
            {(p) => (
              <textarea
                {...p}
                rows={5}
                value={draft.description}
                maxLength={2000}
                placeholder="Ex.: Aprenda a agachar com técnica e sem dor no joelho..."
                onChange={set('description')}
              />
            )}
          </Field>

          {duration.seconds > 0 ? (
            <div className="auto-hours">
              <span className="auto-hours__label">Carga horária</span>
              <strong>{duration.label}</strong>
              <span className="auto-hours__hint">
                <Icone name="checkCircle" size={14} /> Soma da duração das aulas.
                {duration.timed < duration.total &&
                  ` ${duration.total - duration.timed === 1 ? 'Falta 1 aula' : `Faltam ${duration.total - duration.timed} aulas`} sem duração.`}
              </span>
            </div>
          ) : (
            <Field
              label="Carga horária"
              optional
              about="Tempo total de vídeo. Se deixar vazio, não aparece no site."
              hint={
                isNew
                  ? 'Pode deixar vazio. Depois que você montar as aulas, ela é calculada sozinha.'
                  : 'Preencha a duração das aulas e ela passa a ser calculada sozinha.'
              }
            >
              {(p) => <input {...p} value={draft.hours} maxLength={20} placeholder="Ex.: 3h20" onChange={set('hours')} className="xinput--short" />}
            </Field>
          )}
        </div>
      </Card>

      <div className="editor-side">
        <Card
          title="Imagem de capa"
          subtitle="Aparece no card, na página do curso e no carrinho."
        >
          <ul className="cover__tips">
            <li>Foto deitada, de preferência 1200 × 800.</li>
            <li>JPG, PNG ou WebP, até 5 MB.</li>
            <li>Deixe o exercício no meio da foto.</li>
          </ul>
          <div className="cover">
            {draft.image ? (
              <img className="cover__img" src={img(draft.image, 600)} alt="Capa do curso" />
            ) : (
              <div className="cover__empty">
                <Icone name="image" size={28} />
                <span>Sem imagem</span>
              </div>
            )}
            <div className="cover__actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                id="cover-file"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <label htmlFor="cover-file" className={`btn btn--outline btn--sm ${uploading ? 'is-disabled' : ''}`}>
                {uploading ? <span className="spinner" aria-hidden="true" /> : <Icone name="upload" size={16} />} Enviar imagem
              </label>
              {draft.image && (
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setDraft((d) => ({ ...d, image: '' }))}>
                  <Icone name="trash" size={16} /> Remover
                </button>
              )}
            </div>
            <Field
              label="Ou cole o link da imagem"
              optional
              hint="Precisa começar com https://"
              error={errors.image}
            >
              {(p) => <input {...p} value={draft.image} placeholder="https://..." onChange={set('image')} maxLength={1000} />}
            </Field>
          </div>
        </Card>

        <Card title="No site">
          <div className="xstack">
            <div className="xtoggle-help">
              <Toggle
                checked={draft.published}
                onChange={(v) => setDraft((d) => ({ ...d, published: v }))}
                label={draft.published ? 'Publicado' : 'Rascunho'}
              />
              <p>
                {draft.published
                  ? 'Aparece no site e pode ser comprado.'
                  : 'Escondido do site, até para quem já comprou.'}
              </p>
            </div>
            <div className="xtoggle-help">
              <Toggle
                checked={draft.bestseller}
                onChange={(v) => setDraft((d) => ({ ...d, bestseller: v }))}
                label='Selo "Mais vendido"'
              />
              <p>Mostra a etiqueta "Mais vendido" na foto. Melhor usar em poucos cursos.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* =========================================================
   Aba Preço e desconto
   ========================================================= */
function PriceTab({ draft, setDraft, errors }) {
  const { base, discount, final } = draft.pricing
  const old = discount != null && Number(base) > Number(final) ? Number(base) : null
  const off = old ? Math.round((1 - final / old) * 100) : 0

  return (
    <div className="editor-grid">
      <Card title="Preço" subtitle="Coloque o valor do curso. Se quiser dar desconto, é só escolher a %.">
        <PrecoEDesconto
          value={draft.pricing}
          onChange={(pricing) => setDraft((d) => ({ ...d, pricing }))}
          errors={{ base: errors.price, discount: errors.discount }}
        />
      </Card>

      <Card title="Como aparece no site">
        <div className="price-preview">
          {off > 0 && <span className="price-preview__off">-{off}%</span>}
          {off > 0 && <s>{brl(old)}</s>}
          <strong>{brl(final)}</strong>
          <span>{off > 0 ? `Economia de ${brl(old - final)}` : 'Sem desconto'}</span>
        </div>
      </Card>
    </div>
  )
}

/* =========================================================
   Aba Aulas: módulos e aulas, salvando cada alteração
   ========================================================= */
function VideoPreview({ url, onClose }) {
  const src = toEmbedUrl(url)
  return (
    <div className="xmodal" role="presentation">
      <div className="xmodal__overlay" onClick={onClose} />
      <div className="xmodal__panel xmodal__panel--video" role="dialog" aria-modal="true" aria-label="Prévia do vídeo">
        <div className="video">
          {isFileVideo(src) ? (
            <video src={src} controls playsInline />
          ) : (
            <iframe src={src} title="Prévia do vídeo" allow="encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
          )}
        </div>
        <div className="xmodal__actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Fechar prévia
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadProgress({ upload, onCancel }) {
  const pct = upload.total ? Math.min(100, Math.round((upload.sent / upload.total) * 100)) : 0
  return (
    <div className="lrow__upload" role="status" aria-live="polite">
      <div className="lrow__upload-top">
        <span className="lrow__upload-name">
          <Icone name="upload" size={15} /> {upload.name}
        </span>
        <span className="lrow__upload-pct">{pct}%</span>
      </div>
      <div
        className="lrow__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Enviando ${upload.name}`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="lrow__upload-foot">
        <span>
          {formatBytes(upload.sent)} de {formatBytes(upload.total)}
          {upload.eta != null && pct < 100 && ` · faltam ${upload.eta < 60 ? `${Math.max(1, upload.eta)}s` : `${Math.ceil(upload.eta / 60)} min`}`}
          {pct >= 100 && ' · finalizando…'}
        </span>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function LessonRow({ lesson, courseId, index, total, onSave, onMove, onDelete, onPreview }) {
  const { notify } = useAdmin()
  const [title, setTitle] = useState(lesson.title)
  const [duration, setDuration] = useState(lesson.duration)
  const [video, setVideo] = useState(lesson.videoUrl)
  const [state, setState] = useState('idle')
  const [upload, setUpload] = useState(null)
  const [askRemove, setAskRemove] = useState(false)
  const fileRef = useRef(null)
  const abortRef = useRef(null)

  // aula excluída (ou tela fechada) no meio do envio: cancela
  useEffect(() => () => abortRef.current?.abort(), [])

  // aviso ao fechar a aba no meio do envio
  useEffect(() => {
    if (!upload) return
    const onUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [upload])

  // duração padronizada: "12" ou "12min" vira "12:00"; "1h5" vira "1:05:00"
  const seconds = parseDuration(duration)
  const durationBad = !!duration.trim() && seconds == null

  // salva a aula; devolve true quando ficou salva
  const commit = async (patch = {}) => {
    if (durationBad && patch.duration == null) {
      setState('error')
      return false
    }
    const next = {
      ...lesson,
      title: title.trim() || lesson.title,
      duration: seconds ? formatClock(seconds) : '',
      videoUrl: video.trim(),
      ...patch,
    }
    if (next.videoUrl) next.videoUrl = toEmbedUrl(next.videoUrl)
    if (next.title === lesson.title && next.duration === lesson.duration && next.videoUrl === lesson.videoUrl && next.isPreview === lesson.isPreview)
      return true
    if (next.videoUrl && !isStoredVideo(next.videoUrl) && !isValidVideoUrl(next.videoUrl)) {
      setState('error')
      return false
    }
    setState('saving')
    try {
      await onSave(next)
      setVideo(next.videoUrl)
      setTitle(next.title)
      setDuration(next.duration)
      setState('saved')
      return true
    } catch {
      setState('error')
      return false
    }
  }

  const sendFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const info = videoFileInfo(file)
    if (info.error) {
      notify(info.error, 'error')
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const startedAt = Date.now()
    setUpload({ name: file.name, sent: 0, total: file.size, eta: null })
    const fileSeconds = readVideoDuration(file)
    try {
      const ref = await backend.admin.uploadVideo({
        courseId,
        lessonId: lesson.id,
        file,
        signal: ctrl.signal,
        onProgress: (sent, size) => {
          const elapsed = (Date.now() - startedAt) / 1000
          const eta = sent > 0 && elapsed > 2 ? Math.round(((size - sent) * elapsed) / sent) : null
          setUpload((u) => u && { ...u, sent, total: size, eta })
        },
      })
      // a duração do próprio arquivo entra na aula (e na carga horária do curso)
      const secs = await fileSeconds
      const patch = { videoUrl: ref }
      if (secs) patch.duration = formatClock(secs)
      else if (durationBad) patch.duration = lesson.duration
      if (await commit(patch)) notify(secs ? `Vídeo enviado. Duração ${formatClock(secs)} preenchida sozinha.` : 'Vídeo enviado e salvo na aula.')
      else notify('O vídeo foi enviado, mas a aula não foi salva. Tente enviar de novo.', 'error')
    } catch (err) {
      if (err.name !== 'AbortError') notify(err.message, 'error')
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
      setUpload(null)
    }
  }

  const removeFile = async () => {
    setAskRemove(false)
    if (await commit({ videoUrl: '' })) notify('Vídeo removido da aula.')
  }

  const stored = isStoredVideo(video)
  const videoOk = !!video.trim() && (stored || isValidVideoUrl(toEmbedUrl(video)))
  const videoBad = !!video.trim() && !videoOk

  return (
    <li className="lrow">
      <span className="lrow__num">{index + 1}</span>
      <div className="lrow__fields">
        <input
          className="lrow__title"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => commit()}
          aria-label={`Título da aula ${index + 1}`}
        />
        <input
          className={`lrow__duration ${durationBad ? 'is-bad' : ''}`}
          value={duration}
          maxLength={12}
          placeholder="Duração"
          title="Ex.: 12:30, 1:05:00, 45min ou 1h20"
          onChange={(e) => setDuration(e.target.value)}
          onBlur={() => commit()}
          aria-label="Duração"
        />
        <input type="file" ref={fileRef} accept={VIDEO_ACCEPT} onChange={sendFile} hidden />
        {upload ? (
          <UploadProgress upload={upload} onCancel={() => abortRef.current?.abort()} />
        ) : stored ? (
          <div className="lrow__video lrow__video--file is-ok">
            <Icone name="checkCircle" size={16} />
            <span className="lrow__file" title={storedName(video)}>
              <strong>{storedName(video)}</strong>
              <small>Arquivo enviado</small>
            </span>
            <button type="button" onClick={() => onPreview(video)} title="Assistir o vídeo">
              <Icone name="play" size={12} /> Assistir
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} title="Enviar outro arquivo no lugar">
              <Icone name="refresh" size={12} /> Trocar
            </button>
            <button type="button" className="is-danger" onClick={() => setAskRemove(true)} aria-label="Remover o vídeo da aula">
              <Icone name="trash" size={13} />
            </button>
          </div>
        ) : (
          <div className={`lrow__video ${videoOk ? 'is-ok' : videoBad ? 'is-bad' : ''}`}>
            <Icone name={videoOk ? 'checkCircle' : 'video'} size={16} />
            <input
              value={video}
              maxLength={1000}
              placeholder="Cole o link do vídeo"
              title="YouTube, Vimeo, Panda ou outro link https"
              onChange={(e) => setVideo(e.target.value)}
              onBlur={() => commit()}
              aria-label="Link do vídeo"
            />
            {videoOk && (
              <button type="button" onClick={() => onPreview(video)} title="Testar vídeo">
                <Icone name="play" size={12} /> Testar
              </button>
            )}
            <button type="button" className="is-primary" onClick={() => fileRef.current?.click()} title="Enviar o arquivo do vídeo (MP4, WebM ou MOV)">
              <Icone name="upload" size={13} /> Enviar vídeo
            </button>
          </div>
        )}
      </div>
      <div className="lrow__side">
        <Toggle checked={lesson.isPreview} onChange={(v) => commit({ isPreview: v })} label="Prévia grátis" />
        <span className={`lrow__state lrow__state--${state}`} aria-live="polite">
          {state === 'saving' ? 'Salvando…' : state === 'saved' ? 'Salvo' : state === 'error' ? (durationBad ? 'Duração inválida' : videoBad ? 'Link inválido' : 'Erro ao salvar') : ''}
        </span>
        <div className="order-btns order-btns--row">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Subir aula">
            <Icone name="chevronUp" size={15} />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Descer aula">
            <Icone name="chevronDown" size={15} />
          </button>
        </div>
        <button type="button" className="xicon-btn xicon-btn--danger" onClick={onDelete} aria-label={`Excluir aula ${title}`}>
          <Icone name="trash" size={16} />
        </button>
      </div>
      <Confirm
        open={askRemove}
        title="Remover o vídeo desta aula?"
        text={`O arquivo "${storedName(video)}" é apagado do servidor. A aula continua no curso e aparece como "vídeo em breve" até você enviar outro.`}
        confirmLabel="Remover vídeo"
        busy={state === 'saving'}
        onConfirm={removeFile}
        onCancel={() => setAskRemove(false)}
      />
    </li>
  )
}

function BulkAdd({ onAdd, onClose }) {
  const [text, setText] = useState('')
  const titles = text
    .split('\n')
    .map((t) => t.trim().slice(0, 160))
    .filter(Boolean)
  return (
    <div className="xmodal" role="presentation">
      <div className="xmodal__overlay" onClick={onClose} />
      <div className="xmodal__panel" role="dialog" aria-modal="true" aria-labelledby="bulk-title">
        <h2 id="bulk-title">Adicionar várias aulas</h2>
        <p className="xmodal__text">Um título por linha. Os vídeos você coloca depois, em cada aula.</p>
        <textarea
          className="bulk-text"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Boas-vindas\nAquecimento\nExecução passo a passo'}
          autoFocus
        />
        <div className="xmodal__actions">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" disabled={!titles.length || titles.length > 100} onClick={() => onAdd(titles)}>
            Adicionar {titles.length || ''} {titles.length === 1 ? 'aula' : 'aulas'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ContentTab({ course, setCourse }) {
  const { notify, refreshSite } = useAdmin()
  const modules = course.curriculum
  const [preview, setPreview] = useState(null)
  const [bulkFor, setBulkFor] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const setModules = (fn) => setCourse((c) => ({ ...c, curriculum: fn(c.curriculum) }))
  const fail = (e) => notify(e.message, 'error')

  // vídeo enviado como arquivo: pede um link temporário para assistir
  const openPreview = async (url) => {
    if (!isStoredVideo(url)) return setPreview(url)
    try {
      setPreview(await backend.admin.videoLink(url))
    } catch (e) {
      fail(e)
    }
  }

  const addModule = async () => {
    try {
      const m = await backend.admin.saveModule({ courseId: course.id, title: `Módulo ${modules.length + 1}`, position: modules.length + 1 })
      setModules((ms) => [...ms, { id: m.id, title: m.title, position: m.position, lessons: [] }])
      refreshSite()
    } catch (e) {
      fail(e)
    }
  }

  const renameModule = async (mod, title) => {
    const t = title.trim()
    if (!t || t === mod.title) return
    try {
      await backend.admin.saveModule({ id: mod.id, title: t, position: mod.position })
      setModules((ms) => ms.map((m) => (m.id === mod.id ? { ...m, title: t } : m)))
      refreshSite()
    } catch (e) {
      fail(e)
    }
  }

  const moveModule = async (i, dir) => {
    const ordered = modules.slice()
    ;[ordered[i], ordered[i + dir]] = [ordered[i + dir], ordered[i]]
    const renumbered = ordered.map((m, k) => ({ ...m, position: k + 1 }))
    setModules(() => renumbered)
    try {
      await backend.admin.setModulePositions(renumbered.map((m) => ({ id: m.id, position: m.position })))
      refreshSite()
    } catch (e) {
      fail(e)
    }
  }

  const addLesson = async (mod) => {
    try {
      const l = await backend.admin.saveLesson({
        moduleId: mod.id,
        title: `Aula ${mod.lessons.length + 1}`,
        duration: '',
        position: mod.lessons.length + 1,
        isPreview: false,
        videoUrl: '',
      })
      setModules((ms) => ms.map((m) => (m.id === mod.id ? { ...m, lessons: [...m.lessons, l] } : m)))
      refreshSite()
    } catch (e) {
      fail(e)
    }
  }

  const bulkAdd = async (mod, titles) => {
    try {
      const added = await backend.admin.addLessons(mod.id, titles, mod.lessons.length + 1)
      setModules((ms) => ms.map((m) => (m.id === mod.id ? { ...m, lessons: [...m.lessons, ...added] } : m)))
      setBulkFor(null)
      notify(`${added.length} aulas adicionadas em "${mod.title}".`)
      refreshSite()
    } catch (e) {
      fail(e)
    }
  }

  const saveLesson = async (mod, lesson) => {
    const saved = await backend.admin.saveLesson({ ...lesson, moduleId: mod.id })
    setModules((ms) => ms.map((m) => (m.id === mod.id ? { ...m, lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, ...saved } : l)) } : m)))
    refreshSite()
  }

  const moveLesson = async (mod, i, dir) => {
    const ordered = mod.lessons.slice()
    ;[ordered[i], ordered[i + dir]] = [ordered[i + dir], ordered[i]]
    const renumbered = ordered.map((l, k) => ({ ...l, position: k + 1 }))
    setModules((ms) => ms.map((m) => (m.id === mod.id ? { ...m, lessons: renumbered } : m)))
    try {
      await backend.admin.setLessonPositions(renumbered.map((l) => ({ id: l.id, position: l.position })))
      refreshSite()
    } catch (e) {
      fail(e)
    }
  }

  const runConfirm = async () => {
    setBusy(true)
    try {
      if (confirm.kind === 'module') {
        await backend.admin.deleteModule(confirm.mod.id)
        setModules((ms) => ms.filter((m) => m.id !== confirm.mod.id))
      } else {
        await backend.admin.deleteLesson(confirm.lesson.id)
        setModules((ms) => ms.map((m) => (m.id === confirm.mod.id ? { ...m, lessons: m.lessons.filter((l) => l.id !== confirm.lesson.id) } : m)))
      }
      refreshSite()
      setConfirm(null)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0)
  const withVideo = modules.reduce((n, m) => n + m.lessons.filter((l) => l.videoUrl).length, 0)

  return (
    <>
      <div className="content-head">
        <p>
          <strong>{modules.length}</strong> módulos · <strong>{totalLessons}</strong> aulas ·{' '}
          <strong>{withVideo}</strong> com vídeo · carga horária <strong>{courseDuration(modules).label || 'sem durações'}</strong>
          {totalLessons > withVideo && <span className="content-head__warn"> ({totalLessons - withVideo} sem vídeo aparecem como "em breve")</span>}
        </p>
        <p className="content-head__tip">
          <Icone name="checkCircle" size={15} /> Tudo é salvo sozinho. Use <strong>Enviar vídeo</strong> para subir o arquivo ou cole um
          link do YouTube, Vimeo ou Panda.
        </p>
      </div>

      {modules.length === 0 && (
        <Card>
          <Empty
            icon="video"
            title="Nenhum módulo ainda"
            text="Organize o curso em módulos (ex.: Fundamentos, Execução, Erros comuns) e adicione as aulas em cada um."
            action={
              <button type="button" className="btn btn--primary" onClick={addModule}>
                <Icone name="plus" size={18} /> Criar primeiro módulo
              </button>
            }
          />
        </Card>
      )}

      <ol className="modules">
        {modules.map((mod, i) => (
          <li key={mod.id} className="module">
            <header className="module__head">
              <span className="module__num">Módulo {i + 1}</span>
              <input
                className="module__title"
                defaultValue={mod.title}
                maxLength={160}
                onBlur={(e) => renameModule(mod, e.target.value)}
                aria-label={`Nome do módulo ${i + 1}`}
              />
              <span className="module__count">{mod.lessons.length} aulas</span>
              <div className="order-btns order-btns--row">
                <button type="button" onClick={() => moveModule(i, -1)} disabled={i === 0} aria-label="Subir módulo">
                  <Icone name="chevronUp" size={15} />
                </button>
                <button type="button" onClick={() => moveModule(i, 1)} disabled={i === modules.length - 1} aria-label="Descer módulo">
                  <Icone name="chevronDown" size={15} />
                </button>
              </div>
              <button
                type="button"
                className="xicon-btn xicon-btn--danger"
                onClick={() => setConfirm({ kind: 'module', mod })}
                aria-label={`Excluir módulo ${mod.title}`}
              >
                <Icone name="trash" size={16} />
              </button>
            </header>

            {mod.lessons.length > 0 && (
              <ol className="lessons">
                {mod.lessons.map((l, li) => (
                  <LessonRow
                    key={l.id}
                    lesson={l}
                    courseId={course.id}
                    index={li}
                    total={mod.lessons.length}
                    onSave={(next) => saveLesson(mod, next)}
                    onMove={(dir) => moveLesson(mod, li, dir)}
                    onDelete={() => setConfirm({ kind: 'lesson', mod, lesson: l })}
                    onPreview={openPreview}
                  />
                ))}
              </ol>
            )}

            <div className="module__foot">
              <button type="button" className="btn btn--outline btn--sm" onClick={() => addLesson(mod)}>
                <Icone name="plus" size={16} /> Adicionar aula
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setBulkFor(mod)}>
                <Icone name="list" size={16} /> Adicionar várias
              </button>
            </div>
          </li>
        ))}
      </ol>

      {modules.length > 0 && (
        <button type="button" className="btn btn--dark add-module" onClick={addModule}>
          <Icone name="plus" size={18} /> Adicionar módulo
        </button>
      )}

      {preview && <VideoPreview url={preview} onClose={() => setPreview(null)} />}
      {bulkFor && <BulkAdd onAdd={(titles) => bulkAdd(bulkFor, titles)} onClose={() => setBulkFor(null)} />}
      <Confirm
        open={!!confirm}
        title={confirm?.kind === 'module' ? `Excluir o módulo "${confirm?.mod.title}"?` : `Excluir a aula "${confirm?.lesson?.title}"?`}
        text={
          confirm?.kind === 'module'
            ? `As ${confirm.mod.lessons.length} aulas deste módulo também serão apagadas, junto com o progresso dos alunos nelas.`
            : 'O progresso dos alunos nesta aula também é apagado.'
        }
        confirmLabel="Excluir"
        busy={busy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}

/* =========================================================
   Tela do editor
   ========================================================= */
function Editor({ initial, isNew }) {
  const { notify, refreshSite } = useAdmin()
  const [tab, setTab] = useState(() => (/[?&]aba=aulas/.test(window.location.hash) && !isNew ? 'aulas' : 'info'))
  const [saved, setSaved] = useState(pickInfo(initial))
  const [draft, setDraft] = useState(pickInfo(initial))
  const [course, setCourse] = useState(initial)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const errors = validateCourse(draft)
  const shown = touched ? errors : {}

  // aviso ao fechar a aba com alterações não salvas
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const save = async () => {
    setTouched(true)
    if (Object.keys(errors).length) {
      notify('Confira os campos destacados.', 'error')
      if (errors.price || errors.discount) setTab('preco')
      else setTab('info')
      return
    }
    setSaving(true)
    try {
      const result = await backend.admin.saveCourse({
        ...draft,
        title: draft.title.trim(),
        slug: slugify(draft.slug),
        tag: draft.tag.trim(),
        description: draft.description.trim(),
        hours: draft.hours.trim(),
        image: draft.image.trim(),
        ...fromPricing(draft.pricing),
      })
      refreshSite()
      if (isNew) {
        notify('Curso criado! Agora adicione os módulos e as aulas.')
        window.location.hash = `#/admin/cursos/${result.id}?aba=aulas`
        return
      }
      const info = pickInfo(result)
      setSaved(info)
      setDraft(info)
      setTouched(false)
      notify('Alterações salvas.')
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHead
        title={isNew ? 'Novo curso' : saved.title || 'Curso sem nome'}
        subtitle={
          <a href="#/admin/cursos" className="ahead__back">
            <Icone name="arrowLeft" size={14} /> Todos os cursos
          </a>
        }
        actions={
          !isNew && (
            <a href={`#/meus-cursos/${saved.slug}`} className="btn btn--outline btn--sm" target="_blank" rel="noreferrer">
              <Icone name="external" size={15} /> Ver como aluno
            </a>
          )
        }
      />

      {isNew && (
        <ol className="newsteps" aria-label="Como criar um curso">
          <li className={tab === 'info' ? 'is-now' : ''}>
            <strong>Informações</strong>
            <span>Nome, descrição e foto.</span>
          </li>
          <li className={tab === 'preco' ? 'is-now' : ''}>
            <strong>Preço</strong>
            <span>Valor e desconto.</span>
          </li>
          <li>
            <strong>Aulas</strong>
            <span>Liberadas depois de criar o curso.</span>
          </li>
          <li>
            <strong>Publicar</strong>
            <span>Ligue "Publicado" quando estiver tudo pronto.</span>
          </li>
        </ol>
      )}

      <div className="tabs" role="tablist" aria-label="Partes do curso">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
            disabled={t.id === 'aulas' && isNew}
            title={t.id === 'aulas' && isNew ? 'Salve o curso para adicionar aulas' : undefined}
          >
            <Icone name={t.icon} size={16} /> {t.label}
            {(t.id === 'info' && (shown.title || shown.slug || shown.description || shown.image)) ||
            (t.id === 'preco' && (shown.price || shown.discount)) ? (
              <span className="tabs__dot" aria-label="tem erro" />
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <InfoTab
          draft={draft}
          setDraft={setDraft}
          errors={shown}
          isNew={isNew}
          duration={courseDuration(course.curriculum)}
          savedSlug={saved.slug}
        />
      )}
      {tab === 'preco' && <PriceTab draft={draft} setDraft={setDraft} errors={shown} />}
      {tab === 'aulas' && !isNew && <ContentTab course={course} setCourse={setCourse} />}

      {tab !== 'aulas' && (
        <div className={`savebar ${dirty || isNew ? 'is-visible' : ''}`}>
          <span>
            <Icone name={dirty ? 'alert' : 'checkCircle'} size={17} /> {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
          </span>
          {dirty && !isNew && (
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setDraft(saved)} disabled={saving}>
              Descartar
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={save} disabled={saving || (!dirty && !isNew)}>
            {saving && <span className="spinner" aria-hidden="true" />} {isNew ? 'Criar curso' : 'Salvar alterações'}
          </button>
        </div>
      )}
    </>
  )
}

export default function EditorDeCurso({ id }) {
  const isNew = id === 'novo'
  const res = useAsync(() => (isNew ? Promise.resolve(NEW_COURSE) : backend.admin.getCourse(id)), [id])

  if (res.error) return <ErrorBox error={res.error} onRetry={res.reload} />
  if (res.loading || !res.data) return <div className="xtable-skeleton xtable-skeleton--tall" aria-busy="true" />
  return <Editor key={id} initial={res.data} isNew={isNew} />
}
