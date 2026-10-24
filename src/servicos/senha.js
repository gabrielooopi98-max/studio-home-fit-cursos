// Força da senha: usada no cadastro, na nova senha e na troca de senha da conta.
// Mínimo exigido: 8 caracteres com letras e números (as outras regras só aumentam a nota).
export function passwordScore(pw) {
  const checks = {
    length: pw.length >= 8,
    letter: /[a-zA-Z]/.test(pw),
    number: /\d/.test(pw),
    mixed: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    symbol: /[^a-zA-Z0-9]/.test(pw),
    long: pw.length >= 12,
  }
  const score = [checks.length, checks.number && checks.letter, checks.mixed, checks.symbol || checks.long].filter(Boolean).length
  return { checks, score, valid: checks.length && checks.letter && checks.number }
}

export const STRENGTH = ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte']

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
