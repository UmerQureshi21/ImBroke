import { useState, useEffect } from 'react'
import type { Transaction, CategorySummary } from './types'
import { apiFetch } from './api'
import { useAuth } from './context/AuthContext'
import UploadZone from './components/UploadZone'
import SummaryCards from './components/SummaryCards'
import CategoryCard from './components/CategoryCard'
import CategorySettings from './components/CategorySettings'
import Calendar from './components/Calendar'
import ManualEntry from './components/ManualEntry'
import MonthNav from './components/MonthNav'

export default function App() {
  const { logout } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [categories, setCategories] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState('')

  const fetchTransactions = async () => {
    const res = await apiFetch('/transactions')
    const data = await res.json()
    setTransactions(data)
  }

  const fetchBudgets = async () => {
    const res = await apiFetch('/budgets')
    const data = await res.json()
    setBudgets(data)
  }

  const fetchCategories = async () => {
    const res = await apiFetch('/categories')
    const data = await res.json()
    setCategories(data)
  }

  const refreshSettings = () => { fetchCategories(); fetchBudgets() }

  useEffect(() => {
    fetchTransactions()
    fetchBudgets()
    fetchCategories()
  }, [])

  const availableMonths = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort()

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[availableMonths.length - 1])
    }
  }, [availableMonths.length])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setMessage('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await apiFetch('/upload', { method: 'POST', body: form })
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

  const filtered = selectedMonth
    ? transactions.filter(t => t.date.startsWith(selectedMonth))
    : transactions

  const byDate = filtered.reduce<Record<string, Transaction[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = []
    acc[t.date].push(t)
    return acc
  }, {})

  const byCategory = filtered.reduce<Record<string, CategorySummary>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = { total: 0, count: 0, transactions: [] }
    acc[t.category].total += t.amount
    acc[t.category].count += 1
    acc[t.category].transactions.push(t)
    return acc
  }, {})

  const totalSpend = filtered.reduce((sum, t) => sum + t.amount, 0)

  const spillovers: Record<string, number> = {}
  if (selectedMonth) {
    const priorMonths = availableMonths.filter(m => m < selectedMonth)
    for (const category of Object.keys(budgets)) {
      let carry = 0
      for (const month of priorMonths) {
        const spent = transactions
          .filter(t => t.date.startsWith(month) && t.category === category)
          .reduce((sum, t) => sum + t.amount, 0)
        carry = Math.max(0, spent + carry - budgets[category])
      }
      spillovers[category] = carry
    }
  }

  const [calYear, calMonth] = selectedMonth
    ? selectedMonth.split('-').map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1]

  return (
    <div className="max-w-[860px] mx-auto px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-green-600">Spend Smarter!</h1>
          <p className="mt-1 text-sm text-gray-500"></p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </header>

      <CategorySettings categories={categories} budgets={budgets} onRefresh={refreshSettings} />
      <ManualEntry categories={categories} onSave={fetchTransactions} />
      <UploadZone onUpload={handleUpload} uploading={uploading} message={message} />

      {transactions.length > 0 && (
        <>
          <MonthNav
            availableMonths={availableMonths}
            selectedMonth={selectedMonth}
            onChange={(m) => { setSelectedMonth(m); setExpandedCategory(null) }}
          />

          <SummaryCards totalSpend={totalSpend} transactionCount={filtered.length} />

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
                    spillover={spillovers[category] ?? 0}
                    expanded={expandedCategory === category}
                    onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  />
                ))}
            </div>
          </section>

          <Calendar
            key={selectedMonth}
            byDate={byDate}
            defaultMonth={calMonth - 1}
            defaultYear={calYear}
          />
        </>
      )}
    </div>
  )
}
