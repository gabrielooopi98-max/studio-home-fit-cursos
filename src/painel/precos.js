// Preço e desconto no painel: o admin informa o preço original e, se quiser, a % de desconto.
// O banco continua guardando "price" (o que o aluno paga) e "old_price" (o original, riscado no site).

export const DISCOUNT_CHIPS = [10, 15, 20, 25, 30, 40, 50]

const isSet = (v) => v !== '' && v != null && Number.isFinite(Number(v))

// % de desconto entre o original e o final, com até 2 casas (null = sem desconto)
export const discountOf = (price, oldPrice) =>
  Number(oldPrice) > Number(price) && Number(oldPrice) > 0 ? Math.round((1 - price / oldPrice) * 10000) / 100 : null

// Preço final arredondado nos centavos
export const applyDiscount = (base, pct) => Math.round(Number(base) * (100 - Number(pct))) / 100

export const validDiscount = (pct) => isSet(pct) && Number(pct) > 0 && Number(pct) < 100

// Do banco para o formulário: { base, discount, final }
export const toPricing = (price, oldPrice) => {
  const discount = discountOf(price, oldPrice)
  return { base: discount != null ? Number(oldPrice) : Number(price ?? 0), discount, final: Number(price ?? 0) }
}

// Do formulário para o banco
export const fromPricing = ({ base, discount, final }) =>
  discount != null ? { price: Number(final), oldPrice: Number(base) } : { price: Number(base) || 0, oldPrice: null }

// Recalcula o preço final quando muda o original ou a %
export const repriced = (base, discount) => ({
  base,
  discount,
  final: discount != null && validDiscount(discount) && isSet(base) ? applyDiscount(base, discount) : isSet(base) ? Number(base) : 0,
})

export function pricingErrors({ base, discount, final }) {
  const e = {}
  if (!isSet(base) || Number(base) < 0) e.base = 'Informe o preço original (use 0 para um curso grátis).'
  else if (Number(base) > 100000) e.base = 'O preço máximo é R$ 100.000,00.'
  if (discount != null) {
    if (!validDiscount(discount)) e.discount = 'Escolha a % de desconto (entre 1% e 99%) ou desligue o desconto.'
    else if (!e.base && !(Number(base) > 0)) e.base = 'Informe o preço original antes de dar desconto.'
    else if (!e.base && !(Number(final) < Number(base))) e.discount = 'Desconto pequeno demais para esse preço.'
  }
  return e
}
