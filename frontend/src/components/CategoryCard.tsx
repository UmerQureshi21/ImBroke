import { useState } from 'react'
import type { CategorySummary } from '../types'
import { apiFetch } from '../api'

interface Props {
  category: string
  summary: CategorySummary
  budget?: number
  spillover?: number
  expanded: boolean
  categories: string[]
  onToggle: () => void
  onUpdate: () => void
}

export default function CategoryCard({ category, summary, budget, spillover = 0, expanded, categories, onToggle, onUpdate }: Props) {
  const effective = summary.total + spillover
  const pct = budget ? effective / budget : 0
  const [editingId, setEditingId] = useState<number | null>(null)

  const handleCategoryChange = async (id: number, newCategory: string) => {
    setEditingId(null)
    if (newCategory === category) return
    await apiFetch(`/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ category: newCategory }),
    })
    onUpdate()
  }

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
            <span>${effective.toFixed(2)} spent</span>
            <span>${budget} budget</span>
          </div>
          {spillover > 0 && (
            <div className="flex justify-between text-xs text-amber-600 mb-1.5">
              <span>↪ Carried from last month</span>
              <span>+${spillover.toFixed(2)}</span>
            </div>
          )}
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
                <li
                  key={t.id}
                  className="grid grid-cols-[80px_1fr_auto_auto] sm:grid-cols-[110px_1fr_auto_auto] gap-2 items-center py-1"
                >
                  <span className="text-gray-400 text-[0.65rem] sm:text-[0.72rem]">{t.date}</span>
                  <span className="text-gray-700 text-sm font-medium truncate">{t.merchant}</span>
                  <span className="text-gray-900 text-sm font-semibold text-right">${t.amount.toFixed(2)}</span>

                  {editingId === t.id ? (
                    <select
                      autoFocus
                      defaultValue={category}
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleCategoryChange(t.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      className="text-xs border border-green-400 rounded-md px-1.5 py-1 focus:outline-none bg-white text-gray-700 cursor-pointer"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setEditingId(t.id) }}
                      title="Change category"
                      className="text-gray-300 hover:text-green-600 transition-colors text-xs px-1.5 py-1 rounded hover:bg-green-50 cursor-pointer whitespace-nowrap"
                    >
                      Move ›
                    </button>
                  )}
                </li>
              ))}
          </div>
        </ul>
      </div>
    </div>
  )
}
