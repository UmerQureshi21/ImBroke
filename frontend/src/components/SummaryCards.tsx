interface Props {
  totalSpend: number
  transactionCount: number
}

export default function SummaryCards({ totalSpend, transactionCount }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 mt-8 sm:mt-10">
      <div className="bg-green-600 text-white rounded-xl px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-1">
        <span className="text-[0.65rem] sm:text-xs font-light uppercase tracking-widest opacity-80">Total Spend</span>
        <strong className="text-2xl sm:text-3xl font-light">${totalSpend.toFixed(2)}</strong>
      </div>
      <div className="bg-green-600 text-white rounded-xl px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-1">
        <span className="text-[0.65rem] sm:text-xs font-light uppercase tracking-widest opacity-80">Transactions</span>
        <strong className="text-2xl sm:text-3xl font-light">{transactionCount}</strong>
      </div>
    </section>
  )
}
