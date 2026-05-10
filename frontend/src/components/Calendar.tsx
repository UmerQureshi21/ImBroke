import { useState, useRef, useEffect } from 'react'
import type { Transaction } from '../types'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

interface Props {
  byDate: Record<string, Transaction[]>
  defaultMonth?: number
  defaultYear?: number
}

export default function Calendar({ byDate, defaultMonth, defaultYear }: Props) {
  const calMonth = defaultMonth ?? new Date().getMonth()
  const calYear = defaultYear ?? new Date().getFullYear()
  const [threshold, setThreshold] = useState(100)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
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

  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  const handleDayClick = (dateStr: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null)
      setPopoverPos(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setPopoverPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 })
    setSelectedDate(dateStr)
  }

  return (
    <section className="mt-10">
      <h2 className="text-[1.1rem] font-semibold text-gray-700 mb-3">Daily View</h2>

      <div className="flex items-center gap-3.5 mb-3.5 text-sm text-gray-500">
        <span>Highlight days over <strong className="text-gray-900">${threshold}</strong></span>
        <input
          type="range"
          min={0}
          max={500}
          step={5}
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value))}
          className="flex-1 max-w-[260px] accent-green-600 cursor-pointer"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3.5">

        <div className="grid grid-cols-7 gap-[2px] sm:gap-[3px]">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[0.5rem] sm:text-[0.62rem] font-semibold text-gray-400 uppercase pb-1">{d}</div>
          ))}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const txns = byDate[dateStr]
            const hasTxns = !!txns
            const dayTotal = txns?.reduce((s, t) => s + t.amount, 0) ?? 0
            const isOver = hasTxns && dayTotal >= threshold
            const isSelected = selectedDate === dateStr

            return (
              <div
                key={day}
                onClick={(e) => hasTxns && handleDayClick(dateStr, e)}
                className={[
                  'aspect-square flex flex-col items-center justify-center rounded-md text-sm sm:text-xl md:text-2xl gap-0.5 transition-colors',
                  !hasTxns ? 'text-gray-400 cursor-default' : 'font-semibold cursor-pointer',
                  isSelected ? 'bg-green-600 text-white'
                    : isOver ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : hasTxns ? 'text-gray-900 hover:bg-green-50' : '',
                ].join(' ')}
              >
                {day}
                {hasTxns && (
                  <span className={`w-1.5 h-1.5 sm:w-[10px] sm:h-[10px] rounded-full ${isSelected ? 'bg-white' : isOver ? 'bg-red-400' : 'bg-green-500'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {selectedDate && popoverPos && byDate[selectedDate] && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-[280px] -translate-x-1/2"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 rotate-45 w-[10px] h-[10px] bg-white border-l border-t border-gray-200" />
          <h3 className="text-sm font-semibold text-gray-900 mb-2.5">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <ul className="space-y-1.5">
            {byDate[selectedDate].map(t => (
              <li key={t.id} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                <span className="text-gray-400 text-[0.7rem] whitespace-nowrap">{t.category}</span>
                <span className="text-gray-700 text-[0.8rem] font-medium truncate">{t.merchant}</span>
                <span className="text-gray-900 text-[0.8rem] font-semibold">${t.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 pt-2 border-t border-gray-100 text-[0.82rem] font-bold text-green-600 text-right">
            Total: ${byDate[selectedDate].reduce((s, t) => s + t.amount, 0).toFixed(2)}
          </div>
        </div>
      )}
    </section>
  )
}
