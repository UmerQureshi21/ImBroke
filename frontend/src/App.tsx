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
  const { logout, userName } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [categories, setCategories] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadsRemaining, setUploadsRemaining] = useState<number | null>(null)
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
      if (data.uploads_remaining != null) setUploadsRemaining(data.uploads_remaining)
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
    <div className="relative overflow-hidden">
      {/* Decorative green gradient orb — top right */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(34,197,94,0.18) 0%, rgba(22,163,74,0.08) 50%, transparent 70%)',
        }}
      />
    <div className="relative max-w-[1024px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <div className="flex items-center gap-3">
          <img src="/money-max.png" alt="Money Max" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Money Max</h1>
            <p className="text-xs text-gray-400">Spend smarter. Save more.</p>
          </div>
        </div>
        {userName && (
          <p className="mt-3 text-sm text-gray-500">Welcome back, <span className="font-semibold text-gray-700">{userName}</span></p>
        )}
      </header>

      <CategorySettings categories={categories} budgets={budgets} onRefresh={refreshSettings} />
      <ManualEntry categories={categories} onSave={fetchTransactions} />
      {/* <UploadZone onUpload={handleUpload} uploading={uploading} message={message} uploadsRemaining={uploadsRemaining} /> */}

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
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 sm:gap-4">
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
                    categories={categories}
                    onToggle={() => setExpandedCategory(expandedCategory === category ? null : category)}
                    onUpdate={fetchTransactions}
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

      <footer className="mt-12 pt-6 border-t border-gray-200 flex justify-center">
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </footer>
    </div>
    </div>
  )
}
