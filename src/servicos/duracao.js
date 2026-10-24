// Duração das aulas e carga horária dos cursos (calculada pela soma das aulas)

// Aceita "12:30", "1:02:30", "45" (minutos), "45min", "1h20", "1h", "90s". Retorna segundos ou null.
export function parseDuration(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  let m
  if ((m = s.match(/^(\d{1,3}):([0-5]\d):([0-5]\d)$/))) return +m[1] * 3600 + +m[2] * 60 + +m[3]
  if ((m = s.match(/^(\d{1,3}):([0-5]\d)$/))) return +m[1] * 60 + +m[2]
  if ((m = s.match(/^(\d{1,2})h(\d{1,2})?(?:min|m)?$/))) return +m[1] * 3600 + (m[2] ? +m[2] * 60 : 0)
  if ((m = s.match(/^(\d{1,3})(?:min|m)?$/))) return +m[1] * 60
  if ((m = s.match(/^(\d{1,4})s$/))) return +m[1]
  return null
}

// Formato padrão de uma aula: "12:30" ou "1:02:30"
export function formatClock(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// Carga horária do curso: "3h20", "2h", "45min"
export function formatTotal(seconds) {
  if (!(seconds > 0)) return ''
  const minutes = Math.max(1, Math.round(seconds / 60))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}min`
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

// Soma as durações das aulas do curso; conta também quantas aulas têm duração
export function courseDuration(curriculum) {
  let seconds = 0
  let timed = 0
  let total = 0
  for (const mod of curriculum ?? []) {
    for (const lesson of mod.lessons ?? []) {
      total += 1
      const d = parseDuration(lesson.duration)
      if (d) {
        seconds += d
        timed += 1
      }
    }
  }
  return { seconds, timed, total, label: formatTotal(seconds) }
}
