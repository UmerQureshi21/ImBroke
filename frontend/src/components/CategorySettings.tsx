import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

interface Props {
  categories: string[]
  budgets: Record<string, number>
  onRefresh: () => void
}

export default function CategorySettings({ categories, budgets, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    const lb: Record<string, string> = {}
    for (const cat of categories) {
      lb[cat] = budgets[cat] !== undefined ? String(budgets[cat]) : ''
    }
    setLocalBudgets(lb)
  }, [categories, budgets])

  const saveBudget = async (category: string) => {
    const raw = localBudgets[category] ?? ''
    if (raw === '') {
      await apiFetch(`/budgets/${encodeURIComponent(category)}`, { method: 'DELETE' })
    } else {
      const amount = parseFloat(raw)
      if (isNaN(amount) || amount <= 0) return
      await apiFetch('/budgets', {
        method: 'POST',
        body: JSON.stringify({ category, monthly_limit: amount }),
      })
    }
    setSaved(category)
    setTimeout(() => setSaved(null), 1500)
    onRefresh()
  }

  const deleteCategory = async (name: string) => {
    await apiFetch(`/categories/${encodeURIComponent(name)}`, { method: 'DELETE' })
    onRefresh()
  }

  const addCategory = async () => {
    if (!newName.trim()) return
    await apiFetch('/categories', {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim() }),
    })
    setNewName('')
    onRefresh()
  }

  const inputClass = 'border border-[var(--brand-300)] rounded-lg px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-400)] transition-colors bg-[var(--page-bg)]'

  return (
    <section className="bg-[var(--page-bg)] border border-[var(--brand-300)] rounded-xl mb-4 shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
      >
        <span className="text-sm font-semibold text-gray-800">Categories &amp; Budgets</span>
        <span className={`text-gray-400 text-lg transition-transform duration-200 ${open ? 'rotate-90 text-[var(--brand-600)]' : ''}`}>›</span>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 border-t border-[var(--brand-50)]">
            <div className="mt-4 space-y-1">
              {categories.map(cat => (
                <div key={cat} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_140px_auto] gap-2 sm:gap-3 items-center py-1">
                  <span className="text-sm text-gray-700 font-medium truncate">{cat}</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="No budget"
                      value={localBudgets[cat] ?? ''}
                      onChange={e => setLocalBudgets(p => ({ ...p, [cat]: e.target.value }))}
                      onBlur={() => saveBudget(cat)}
                      onKeyDown={e => e.key === 'Enter' && saveBudget(cat)}
                      className={`${inputClass} w-full w-20 sm:w-full pl-6 ${saved === cat ? 'border-[var(--brand-400)] bg-[var(--brand-50)]' : ''}`}
                    />
                  </div>
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none cursor-pointer px-1"
                    title="Remove category"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--brand-50)] flex gap-2">
              <input
                type="text"
                placeholder="New category name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={addCategory}
                className="bg-[var(--brand-600)] text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-[var(--brand-700)] transition-colors cursor-pointer whitespace-nowrap"
              >
                Add
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Budget saves on blur or Enter. Clearing a budget removes it. Deleting a category also removes its budget.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
