const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface Props {
  availableMonths: string[]   // ['2026-03', '2026-04', ...]
  selectedMonth: string
  onChange: (month: string) => void
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTHS[parseInt(m) - 1]} ${y}`
}

export default function MonthNav({ availableMonths, selectedMonth, onChange }: Props) {
  const idx = availableMonths.indexOf(selectedMonth)
  const hasPrev = idx > 0
  const hasNext = idx < availableMonths.length - 1

  const btnClass = (enabled: boolean) =>
    `w-8 h-8 flex items-center justify-center rounded-full border text-lg font-light transition-colors
    ${enabled
      ? 'border-gray-200 text-gray-700 hover:bg-green-50 hover:border-green-300 cursor-pointer'
      : 'border-gray-100 text-gray-300 cursor-default'}`

  return (
    <div className="flex items-center gap-4 mt-8 mb-1">
      <button
        className={btnClass(hasPrev)}
        onClick={() => hasPrev && onChange(availableMonths[idx - 1])}
      >
        ‹
      </button>
      <div>
        <span className="font-light text-gray-900">{selectedMonth ? formatMonth(selectedMonth) : '—'}</span>
        <span className="text-xs text-gray-400 ml-2">
          {idx + 1} of {availableMonths.length} month{availableMonths.length !== 1 ? 's' : ''}
        </span>
      </div>
      <button
        className={btnClass(hasNext)}
        onClick={() => hasNext && onChange(availableMonths[idx + 1])}
      >
        ›
      </button>
    </div>
  )
}
