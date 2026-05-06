export interface Transaction {
  id: number
  date: string
  merchant: string
  amount: number
  category: string
}

export interface CategorySummary {
  total: number
  count: number
  transactions: Transaction[]
}
