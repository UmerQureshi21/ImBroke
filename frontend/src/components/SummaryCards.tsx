interface Props {
  totalSpend: number
  transactionCount: number
}

export default function SummaryCards({ totalSpend, transactionCount }: Props) {
  return (
    <section className="flex gap-4 mt-10">
      <div className="flex-1 bg-green-600 text-white rounded-xl px-6 py-5 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-widest opacity-80">Total Spend</span>
        <strong className="text-3xl font-bold">${totalSpend.toFixed(2)}</strong>
      </div>
      <div className="flex-1 bg-green-600 text-white rounded-xl px-6 py-5 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-widest opacity-80">Transactions</span>
        <strong className="text-3xl font-bold">{transactionCount}</strong>
      </div>
    </section>
  )
}
