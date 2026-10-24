// Formatos e mensagens compartilhados entre o banco real e o banco simulado dos testes
import { courseDuration } from './duracao'

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0)

// ---------------------------------------------------------------------------
// Erros em português (sem revelar se um e-mail existe ou não)
// ---------------------------------------------------------------------------
export function friendlyError(error) {
  if (!error) return 'Algo deu errado. Tente de novo.'
  const msg = String(error.message ?? error)
  const code = error.code ?? ''
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar. Procure a mensagem na caixa de entrada (e no spam).'
  if (error.status === 429 || /rate limit|too many/i.test(msg)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  if (code === 'weak_password' || /Password should|weak password/i.test(msg)) return 'Essa senha é fraca. Use pelo menos 8 caracteres, com letras e números.'
  if (/should be different/i.test(msg)) return 'A nova senha precisa ser diferente da atual.'
  if (/session.*(missing|expired)|JWT expired|invalid.*(token|code)|code verifier/i.test(msg))
    return 'Seu link expirou ou foi aberto em outro navegador. Peça um novo e abra no mesmo navegador.'
  if (code === '23505') return 'Já existe um registro com esse valor (ex.: link do curso ou código do cupom).'
  if (code === '23503') return 'Esse item está ligado a outros dados e não pode ser removido.'
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para fazer isso.'
  if (code === '23514') return 'Algum valor está fora do permitido. Confira os campos.'
  return msg
}

// ---------------------------------------------------------------------------
// Formatos usados pelas telas
// ---------------------------------------------------------------------------
export const toLesson = (l) => ({
  id: l.id,
  title: l.title,
  duration: l.duration ?? '',
  position: l.position ?? 0,
  isPreview: !!l.is_preview,
  videoUrl: (Array.isArray(l.lesson_media) ? l.lesson_media[0] : l.lesson_media)?.video_url ?? '',
})

export const toCourse = (row) => {
  const curriculum = (row.modules ?? [])
    .slice()
    .sort(byPos)
    .map((m) => ({ id: m.id, title: m.title, position: m.position, lessons: (m.lessons ?? []).slice().sort(byPos).map(toLesson) }))
  // carga horária = soma das durações das aulas; sem nenhuma duração ainda, vale a informada à mão
  const duration = courseDuration(curriculum)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tag: row.tag ?? '',
    level: row.level,
    description: row.description ?? '',
    image: row.image_url ?? '',
    hours: duration.label || (row.hours ?? ''),
    manualHours: row.hours ?? '',
    duration,
    price: Number(row.price ?? 0),
    oldPrice: row.old_price == null ? null : Number(row.old_price),
    bestseller: !!row.bestseller,
    published: !!row.published,
    position: row.position ?? 0,
    curriculum,
    modules: curriculum.map((m) => m.title),
    lessons: curriculum.reduce((n, m) => n + m.lessons.length, 0),
  }
}

export const toSettings = (row) => ({
  comboTitle: row.combo_title,
  comboDescription: row.combo_description ?? '',
  comboPrice: Number(row.combo_price ?? 0),
  comboOldPrice: row.combo_old_price == null ? null : Number(row.combo_old_price),
  comboInstallments: row.combo_installments ?? 12,
  comboActive: row.combo_active !== false,
  comboFeatures: row.combo_features ?? [],
  testMode: !!row.test_mode,
  whatsapp: row.whatsapp ?? '',
  instagram: row.instagram ?? '',
  youtube: row.youtube ?? '',
  contactEmail: row.contact_email ?? '',
})
