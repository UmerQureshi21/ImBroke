import { useState, useEffect, useRef } from 'react'
import './App.css'

const API = 'http://localhost:8000'

interface Transaction {
  id: number
  date: string
  merchant: string
  amount: number
  category: string
}

interface CategorySummary {
  total: number
  count: number
  transactions: Transaction[]
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedDate(null)
        setPopoverPos(null)
      }
    }
    if (selectedDate) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedDate])

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
      setMessage(`Uploaded and categorized ${data.transactions.length} transactions`)
      fetchTransactions()
    } catch (e: any) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const byDate = transactions.reduce<Record<string, Transaction[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = []
    acc[t.date].push(t)
    return acc
  }, {})

  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const handleDayClick = (dateStr: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null)
      setPopoverPos(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setPopoverPos({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    })
    setSelectedDate(dateStr)
  }

  const byCategory = transactions.reduce<Record<string, CategorySummary>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = { total: 0, count: 0, transactions: [] }
    acc[t.category].total += t.amount
    acc[t.category].count += 1
    acc[t.category].transactions.push(t)
    return acc
  }, {})

  const totalSpend = transactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="app">
      <header>
        <h1>Budgeter</h1>
        <p>Upload your TD bank statement to track spending</p>
      </header>

      <section>
        <div
          className="upload-zone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handleUpload(file)
          }}
        >
          {uploading ? (
            <div className="upload-loading">
              <div className="spinner" />
              <p>Categorizing with AI...</p>
            </div>
          ) : (
            <>
              <p>Drop your CSV here or <span className="link">click to upload</span></p>
              <p className="hint">TD bank statement CSV</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
          }}
        />
        {message && (
          <p className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>
            {message}
          </p>
        )}
      </section>

      {transactions.length > 0 && (
        <>
          <section className="summary">
            <div className="total-card">
              <span>Total Spend</span>
              <strong>${totalSpend.toFixed(2)}</strong>
            </div>
            <div className="total-card">
              <span>Transactions</span>
              <strong>{transactions.length}</strong>
            </div>
          </section>

          <section className="categories">
            <h2>By Category</h2>
            <div className="category-grid">
              {Object.entries(byCategory)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([category, summary]) => (
                  <div
                    key={category}
                    className={`category-card ${expandedCategory === category ? 'expanded' : ''}`}
                    onClick={() =>
                      setExpandedCategory(expandedCategory === category ? null : category)
                    }
                  >
                    <div className="category-header">
                      <span className="category-name">{category}</span>
                      <div className="category-header-right">
                        <span className="category-total">${summary.total.toFixed(2)}</span>
                        <span className={`chevron ${expandedCategory === category ? 'open' : ''}`}>›</span>
                      </div>
                    </div>
                    <div className="category-count">
                      {summary.count} transaction{summary.count !== 1 ? 's' : ''}
                    </div>
                    {budgets[category] !== undefined && (
                      <div className="budget-bar-wrap">
                        <div className="budget-bar-labels">
                          <span>${summary.total.toFixed(2)} spent</span>
                          <span>${budgets[category]} budget</span>
                        </div>
                        <div className="budget-bar-track">
                          <div
                            className={`budget-bar-fill ${
                              summary.total / budgets[category] >= 1 ? 'over' :
                              summary.total / budgets[category] >= 0.8 ? 'warn' : ''
                            }`}
                            style={{ width: `${Math.min((summary.total / budgets[category]) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className={`transaction-wrapper ${expandedCategory === category ? 'open' : ''}`}>
                      <ul className="transaction-list">
                        {summary.transactions
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((t) => (
                            <li key={t.id}>
                              <span className="t-date">{t.date}</span>
                              <span className="t-merchant">{t.merchant}</span>
                              <span className="t-amount">${t.amount.toFixed(2)}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                ))}
            </div>
          </section>


          <section className="calendar-section">
            <h2>Daily View</h2>
            <div className="calendar">
              <div className="cal-nav">
                <button onClick={prevMonth}>‹</button>
                <span>{MONTHS[calMonth]} {calYear}</span>
                <button onClick={nextMonth}>›</button>
              </div>
              <div className="cal-grid">
                {DAYS.map(d => <div key={d} className="cal-day-label">{d}</div>)}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const hasTxns = !!byDate[dateStr]
                  const isSelected = selectedDate === dateStr
                  return (
                    <div
                      key={day}
                      className={`cal-day ${hasTxns ? 'has-txns' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={(e) => hasTxns && handleDayClick(dateStr, e)}
                    >
                      {day}
                      {hasTxns && <span className="cal-dot" />}
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedDate && popoverPos && byDate[selectedDate] && (
              <div
                ref={popoverRef}
                className="day-popover"
                style={{ top: popoverPos.top, left: popoverPos.left }}
              >
                <div className="day-popover-arrow" />
                <h3>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                <ul className="transaction-list">
                  {byDate[selectedDate].map(t => (
                    <li key={t.id}>
                      <span className="t-date">{t.category}</span>
                      <span className="t-merchant">{t.merchant}</span>
                      <span className="t-amount">${t.amount.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="day-total">
                  Total: ${byDate[selectedDate].reduce((s, t) => s + t.amount, 0).toFixed(2)}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default App
