import { useState, useEffect } from 'react'
import type { Transaction, CategorySummary } from './types'
import UploadZone from './components/UploadZone'
import SummaryCards from './components/SummaryCards'
import CategoryCard from './components/CategoryCard'
import Calendar from './components/Calendar'
import ManualEntry from './components/ManualEntry'

const API = 'http://localhost:8000'

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const fetchTransactions = async () => {
    const res = await fetch(`${API}/transactions`)
    const data = await res.json()
    setTransactions(data)
  }

  const fetchBudgets = async () => {
    const res = await fetch(`${API}/budgets`)
    const data = await res.json()
    setBudgets(data)
  }

  useEffect(() => {
    fetchTransactions()
    fetchBudgets()
  }, [])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setMessage('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setMessage(data.message)
      fetchTransactions()
    } catch (e: any) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  const byDate = transactions.reduce<Record<string, Transaction[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = []
    acc[t.date].push(t)
    return acc
  }, {})

  const byCategory = transactions.reduce<Record<string, CategorySummary>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = { total: 0, count: 0, transactions: [] }
    acc[t.category].total += t.amount
    acc[t.category].count += 1
    acc[t.category].transactions.push(t)
    return acc
  }, {})

  const totalSpend = transactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="max-w-[860px] mx-auto px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-green-600">Budgeter</h1>
        <p className="mt-1 text-sm text-gray-500">Upload your TD bank statement to track spending</p>
      </header>

      <ManualEntry onSave={fetchTransactions} />
      <UploadZone onUpload={handleUpload} uploading={uploading} message={message} />

      {transactions.length > 0 && (
        <>
          <SummaryCards totalSpend={totalSpend} transactionCount={transactions.length} />

          <section className="mt-10">
            <h2 className="text-[1.1rem] font-semibold text-gray-700 mb-4">By Category</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {Object.entries(byCategory)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([category, summary]) => (
                  <CategoryCard
                    key={category}
                    category={category}
                    summary={summary}
                    budget={budgets[category]}
                    expanded={expandedCategory === category}
                    onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  />
                ))}
            </div>
          </section>

          <Calendar byDate={byDate} />
        </>
      )}
    </div>
  )
}
