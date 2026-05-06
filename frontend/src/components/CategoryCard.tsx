import type { CategorySummary } from '../types'

interface Props {
  category: string
  summary: CategorySummary
  budget?: number
  expanded: boolean
  onToggle: () => void
}

export default function CategoryCard({ category, summary, budget, expanded, onToggle }: Props) {
  const pct = budget ? summary.total / budget : 0

  return (
    <div
      className={`bg-white border rounded-xl p-5 cursor-pointer transition-all ${
        expanded
          ? 'border-green-400 col-span-full'
          : 'border-gray-200 hover:border-green-300 hover:shadow-sm'
      }`}
      onClick={onToggle}
    >
      <div className="flex justify-between items-center">
        <span className="font-semibold text-[0.95rem] text-gray-900">{category}</span>
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-[1.1rem] text-green-600">${summary.total.toFixed(2)}</span>
          <span
            className={`text-gray-400 text-lg leading-none inline-block transition-transform duration-300 ${
              expanded ? 'rotate-90 text-green-600' : ''
            }`}
          >
            ›
          </span>
        </div>
      </div>

      <div className="mt-1 text-xs text-gray-400">
        {summary.count} transaction{summary.count !== 1 ? 's' : ''}
      </div>

      {budget !== undefined && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>${summary.total.toFixed(2)} spent</span>
            <span>${budget} budget</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                pct >= 1 ? 'bg-red-500' : pct >= 0.8 ? 'bg-amber-400' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(pct * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <ul className="overflow-hidden">
          <div className="mt-4 pt-3 border-t border-gray-100">
            {summary.transactions
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((t) => (
                <li key={t.id} className="grid grid-cols-[110px_1fr_auto] gap-3 items-center py-1">
                  <span className="text-gray-400 text-[0.72rem]">{t.date}</span>
                  <span className="text-gray-700 text-sm font-medium truncate">{t.merchant}</span>
                  <span className="text-gray-900 text-sm font-semibold text-right">${t.amount.toFixed(2)}</span>
                </li>
              ))}
          </div>
        </ul>
      </div>
    </div>
  )
}
