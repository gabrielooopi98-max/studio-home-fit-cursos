// Gráficos do painel: área (faturamento por dia/mês) e barras (mais vendidos).
import { useEffect, useRef, useState } from 'react'

/*
  Gráficos do painel (SVG, sem biblioteca):
    * uma série só, na cor da marca; texto sempre nas cores de texto (nunca na cor da série)
    * linha de 2px, área a ~10%, grade fina e discreta, um eixo só
    * cursor vertical que acha a data mais próxima + dica com o valor; também pelo teclado (setas)
*/

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// teto "redondo" para o eixo: 1, 2, 2.5, 5 x 10^n
const niceMax = (max) => {
  if (!(max > 0)) return 1
  const exp = 10 ** Math.floor(Math.log10(max))
  const f = max / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp
}

export function GraficoDeArea({ data, height = 260, formatValue, formatTick, formatLabel, label, detail }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const pad = { top: 16, right: 16, bottom: 28, left: 56 }
  const w = Math.max(0, width - pad.left - pad.right)
  const h = height - pad.top - pad.bottom
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const n = data.length
  const x = (i) => (n <= 1 ? w / 2 : (i / (n - 1)) * w)
  const y = (v) => h - (v / max) * h

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('')
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${h}L${x(0).toFixed(1)},${h}Z` : ''

  // poucas datas no eixo X, sem encavalar
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 90))))
  const xLabels = data.map((d, i) => ({ i, text: formatLabel(d) })).filter(({ i }) => i % every === 0 || i === n - 1)

  const pick = (clientX) => {
    const svg = ref.current?.querySelector('svg')
    if (!svg || !n) return
    const rect = svg.getBoundingClientRect()
    const px = clientX - rect.left - pad.left
    const i = Math.round(n <= 1 ? 0 : (px / w) * (n - 1))
    setHover(Math.min(n - 1, Math.max(0, i)))
  }

  const onKey = (e) => {
    if (!n) return
    if (e.key === 'ArrowRight') setHover((i) => Math.min(n - 1, (i ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setHover((i) => Math.max(0, (i ?? n) - 1))
    else if (e.key === 'Escape') setHover(null)
    else return
    e.preventDefault()
  }

  const active = hover != null ? data[hover] : null
  const tipLeft = hover != null ? Math.min(Math.max(pad.left + x(hover), 80), width - 80) : 0

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line className="chart__grid" x1={0} x2={w} />
                <text className="chart__tick" x={-10} dy="0.32em" textAnchor="end">
                  {formatTick(t)}
                </text>
              </g>
            ))}
            {xLabels.map(({ i, text }) => (
              <text key={i} className="chart__tick" x={x(i)} y={h + 20} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                {text}
              </text>
            ))}
            <path className="chart__area" d={area} />
            <path className="chart__line" d={line} />
            {n > 0 && <circle className="chart__dot" cx={x(n - 1)} cy={y(data[n - 1].value)} r={4} />}
            {active && (
              <>
                <line className="chart__cross" x1={x(hover)} x2={x(hover)} y1={0} y2={h} />
                <circle className="chart__dot" cx={x(hover)} cy={y(active.value)} r={5} />
              </>
            )}
          </g>
        </svg>
      )}
      {active && (
        <div className="chart__tip" style={{ left: tipLeft }} role="status">
          <strong>{formatValue(active.value)}</strong>
          <span>{formatLabel(active, true)}</span>
          {detail && <span>{detail(active)}</span>}
        </div>
      )}
    </div>
  )
}

// Barras horizontais com o valor na ponta (ranking)
export function ListaDeBarras({ items, formatValue, sub }) {
  const max = Math.max(0, ...items.map((i) => i.value))
  return (
    <ol className="barlist">
      {items.map((item) => (
        <li key={item.label} title={`${item.label}: ${formatValue(item.value)}`}>
          <div className="barlist__text">
            <span className="barlist__label">{item.label}</span>
            {sub && <span className="barlist__sub">{sub(item)}</span>}
          </div>
          <div className="barlist__row">
            <span className="barlist__track">
              <span className="barlist__bar" style={{ width: `${max ? Math.max(2, (item.value / max) * 100) : 0}%` }} />
            </span>
            <strong className="barlist__value">{formatValue(item.value)}</strong>
          </div>
        </li>
      ))}
    </ol>
  )
}
