// Números e datas do painel
export const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// valores grandes compactos para eixos e cards: 1.284 / 12,9 mil / 4,2 mi
export const compact = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export const brlCompact = (v) =>
  Math.abs(v) >= 10000 ? `R$ ${compact(v)}` : brl(v).replace(/,00$/, '')

export const int = (v) => Number(v ?? 0).toLocaleString('pt-BR')

export const pct = (v) => `${Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

// variação contra o período anterior (null quando não dá para comparar)
export const delta = (current, previous) => {
  const c = Number(current ?? 0)
  const p = Number(previous ?? 0)
  if (!p) return c ? null : 0
  return ((c - p) / p) * 100
}

// "link" amigável a partir do título: "Terra sem Dor" -> "terra-sem-dor"
export const slugify = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

// início do dia N dias atrás (no fuso do navegador)
export const daysAgo = (n) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n + 1)
  return d
}

export const endOfToday = () => {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d
}

export const PERIODS = [
  { id: '7', label: '7 dias', days: 7 },
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '90 dias', days: 90 },
  { id: '365', label: '12 meses', days: 365 },
]

// planilha CSV (abre no Excel com acentos certos)
export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Enquanto a pessoa digita o link: mesma limpeza, mas deixa o hífen do fim (senão não dá para digitar "a-b")
export const slugTyping = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 80)
