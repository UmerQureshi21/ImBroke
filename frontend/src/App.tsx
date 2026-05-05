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

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchTransactions = async () => {
    const res = await fetch(`${API}/transactions`)
    const data = await res.json()
    setTransactions(data)
  }

  useEffect(() => { fetchTransactions() }, [])

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
            <p>Categorizing with AI...</p>
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
                      <span className="category-total">${summary.total.toFixed(2)}</span>
                    </div>
                    <div className="category-count">
                      {summary.count} transaction{summary.count !== 1 ? 's' : ''}
                    </div>
                    {expandedCategory === category && (
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
                    )}
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default App
