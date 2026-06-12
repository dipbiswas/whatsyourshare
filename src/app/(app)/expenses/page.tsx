"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { Receipt } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setExpenses(d.recentExpenses ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <p className="text-gray-500 mt-1">All recent expenses across your groups</p>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}

      {!loading && expenses.length === 0 && (
        <div className="text-center py-24">
          <Receipt className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No expenses yet</h3>
          <p className="text-gray-400 mt-1">Add expenses inside a group to see them here.</p>
        </div>
      )}

      {!loading && expenses.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {expenses.map((e, idx) => (
              <div key={e.id}>
                {idx > 0 && <Separator />}
                <div className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{e.description}</p>
                      <Badge variant="secondary" className="text-xs shrink-0">{e.category}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      <Link href={`/groups/${e.group.id}`} className="text-violet-600 hover:underline">
                        {e.group.name}
                      </Link>
                      {" · "}Paid by <strong>{e.paidBy.name}</strong>
                      {" · "}{format(new Date(e.date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900 shrink-0">
                    {formatCurrency(e.amount, e.currency)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
