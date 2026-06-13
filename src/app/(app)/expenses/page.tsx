"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { Receipt } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/balance"

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  category: string
  date: string
  createdAt: string
  group: { id: string; name: string }
  paidBy: { id: string; name: string }
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-orange-400",
  Transport: "bg-blue-400",
  Accommodation: "bg-purple-400",
  Entertainment: "bg-pink-400",
  Utilities: "bg-yellow-400",
  General: "bg-gray-300",
  Other: "bg-teal-400",
}

// Group expenses by date
function groupByDate(expenses: Expense[]) {
  const groups: Record<string, Expense[]> = {}
  for (const e of expenses) {
    const key = format(new Date(e.date), "yyyy-MM-dd")
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/expenses")
      .then((r) => r.json())
      .then((d) => setExpenses(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const grouped = groupByDate(expenses)

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All expenses across your groups</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}

      {!loading && expenses.length === 0 && (
        <div className="text-center py-24">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Receipt className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground/70">No expenses yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add expenses inside a group to see them here.</p>
        </div>
      )}

      {!loading && grouped.map(([dateKey, items]) => (
        <div key={dateKey}>
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
            {format(new Date(dateKey), "EEEE, MMMM d")}
          </p>
          <div className="glass rounded-2xl overflow-hidden">
            {items.map((e, idx) => (
              <div key={e.id}>
                {idx > 0 && <div className="h-px bg-border mx-4" />}
                <Link href={`/groups/${e.group.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${CATEGORY_COLORS[e.category] ?? "bg-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{e.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {e.group.name} · paid by {e.paidBy.name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(e.amount, e.currency)}</p>
                    <p className="text-xs text-muted-foreground">{e.category}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
