import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

interface Props {
  categories: string[]
  onSave: () => void
}

export default function ManualEntry({ categories, onSave }: Props) {
  const [date, setDate] = useState('')
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(categories[0] ?? '')

  useEffect(() => {
    if (category === '' && categories.length > 0) setCategory(categories[0])
  }, [categories])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify({ date, merchant, amount: parseFloat(amount), category }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setDate('')
      setMerchant('')
      setAmount('')
      setCategory(categories[0] ?? '')
      setMessage({ text: 'Transaction added.', error: false })
      onSave()
    } catch (e: any) {
      setMessage({ text: e.message, error: true })
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors'

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Add a transaction</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1.5fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              type="text"
              required
              placeholder="Merchant name"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={inputClass}
            >
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
        {message && (
          <p className={`text-xs font-medium ${message.error ? 'text-red-600' : 'text-green-600'}`}>
            {message.text}
          </p>
        )}
      </form>
    </section>
  )
}
