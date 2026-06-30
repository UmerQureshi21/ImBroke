const PALETTE = [
  '#16a34a', // green (brand)
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#ef4444', // red
  '#a855f7', // purple
  '#64748b', // slate
  '#78716c', // stone
]

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function slicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`
  }
  const p1 = polarToCartesian(cx, cy, r, startDeg)
  const p2 = polarToCartesian(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`
}

interface Props {
  byCategory: Record<string, { total: number }>
  totalSpend: number
}

export default function SpendingPieChart({ byCategory, totalSpend }: Props) {
  if (totalSpend === 0) return null

  const SIZE = 220
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R = 90
  const IR = 52

  const sorted = Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, { total }], i) => ({
      cat,
      total,
      color: PALETTE[i % PALETTE.length],
      pct: (total / totalSpend) * 100,
    }))

  let angle = 0
  const slices = sorted.map(s => {
    const sweep = (s.total / totalSpend) * 360
    const path = slicePath(CX, CY, R, angle, angle + sweep)
    angle += sweep
    return { ...s, path }
  })

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`

  return (
    <section className="mt-10">
      <h2 className="text-[1.1rem] font-normal text-gray-700 mb-4">Spending Breakdown</h2>
      <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-6">

        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="flex-shrink-0">
          {slices.map(s => (
            <path
              key={s.cat}
              d={s.path}
              fill={s.color}
              stroke="white"
              strokeWidth={2}
              className="transition-opacity hover:opacity-75 cursor-default"
            />
          ))}
          <circle cx={CX} cy={CY} r={IR} fill="white" />
          <text x={CX} y={CY - 7} textAnchor="middle" fill="#9ca3af" fontSize={10} fontFamily="Poppins, sans-serif">Total</text>
          <text x={CX} y={CY + 11} textAnchor="middle" fill="#111827" fontSize={15} fontFamily="Poppins, sans-serif" fontWeight={500}>{fmt(totalSpend)}</text>
        </svg>

        <div className="flex-1 w-full flex flex-col gap-2.5">
          {slices.map(s => (
            <div key={s.cat} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm text-gray-600 flex-1 truncate capitalize">{s.cat}</span>
              <span className="text-sm text-gray-900">{fmt(s.total)}</span>
              <span className="text-xs text-gray-400 w-9 text-right">{s.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
