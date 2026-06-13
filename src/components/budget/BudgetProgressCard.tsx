"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/balance"
import { SetGroupBudgetDialog } from "./SetGroupBudgetDialog"

interface CategoryBudget {
  category: string
  amount: number
}

interface BudgetData {
  id: string
  totalAmount: number
  currency: string
  period: string
  startDate: string
  endDate?: string | null
  alertAt: number
  totalSpent: number
  percentUsed: number
  isOverAlert: boolean
  isOverBudget: boolean
  categorySpending: Record<string, number>
  categoryBudgets: CategoryBudget[]
}

interface Props {
  groupId: string
  currency: string
}

export function BudgetProgressCard({ groupId, currency }: Props) {
  const [budget, setBudget] = useState<BudgetData | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/groups/${groupId}/budget`)
      .then((r) => r.json())
      .then(setBudget)
      .catch(() => setBudget(null))
  }, [groupId])

  if (budget === undefined) return null // still loading, render nothing

  const handleSaved = () => {
    // Re-fetch the full budget (with computed fields) after saving
    fetch(`/api/groups/${groupId}/budget`)
      .then((r) => r.json())
      .then(setBudget)
      .catch(() => setBudget(null))
  }

  if (!budget) {
    return (
      <Card className="border-0 shadow-sm border border-dashed border-gray-200">
        <CardContent className="py-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">No budget set</p>
            <p className="text-xs text-gray-400 mt-0.5">Set a budget to track spending and get alerts</p>
          </div>
          <SetGroupBudgetDialog
            groupId={groupId}
            currency={currency}
            existingBudget={null}
            onSaved={handleSaved}
          />
        </CardContent>
      </Card>
    )
  }

  const pct = Math.min(budget.percentUsed, 100)
  const barColor = budget.isOverBudget
    ? "bg-red-500"
    : budget.isOverAlert
    ? "bg-amber-400"
    : "bg-violet-500"

  return (
    <Card
      className={`border-0 shadow-sm ${
        budget.isOverBudget
          ? "border border-red-200 bg-red-50"
          : budget.isOverAlert
          ? "border border-amber-200 bg-amber-50"
          : "border border-emerald-100 bg-emerald-50"
      }`}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {budget.isOverBudget ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : budget.isOverAlert ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
          <span
            className={
              budget.isOverBudget
                ? "text-red-700"
                : budget.isOverAlert
                ? "text-amber-800"
                : "text-emerald-800"
            }
          >
            Group Budget
          </span>
        </CardTitle>
        <SetGroupBudgetDialog
          groupId={groupId}
          currency={currency}
          existingBudget={budget}
          onSaved={handleSaved}
        />
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Main progress bar */}
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <div>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(budget.totalSpent, budget.currency)}
              </span>
              <span className="text-sm text-gray-500 ml-1">
                of {formatCurrency(budget.totalAmount, budget.currency)}
              </span>
            </div>
            <span
              className={`text-sm font-semibold ${
                budget.isOverBudget ? "text-red-600" : budget.isOverAlert ? "text-amber-700" : "text-gray-600"
              }`}
            >
              {budget.percentUsed.toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {budget.isOverBudget && (
            <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Over budget by {formatCurrency(budget.totalSpent - budget.totalAmount, budget.currency)}
            </p>
          )}
          {!budget.isOverBudget && budget.isOverAlert && (
            <p className="text-xs text-amber-700 mt-1 font-medium">
              ⚠ Alert: {budget.percentUsed.toFixed(0)}% of budget used
            </p>
          )}
        </div>

        {/* Category breakdown */}
        {budget.categoryBudgets.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {budget.categoryBudgets.map((cb) => {
              const spent = budget.categorySpending[cb.category] ?? 0
              const catPct = Math.min((spent / cb.amount) * 100, 100)
              const over = spent > cb.amount
              return (
                <div key={cb.category}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={over ? "text-red-600 font-medium" : "text-gray-600"}>{cb.category}</span>
                    <span className={over ? "text-red-600 font-medium" : "text-gray-500"}>
                      {formatCurrency(spent, budget.currency)} / {formatCurrency(cb.amount, budget.currency)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${over ? "bg-red-400" : "bg-violet-400"}`}
                      style={{ width: `${catPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400">
          {budget.period === "MONTHLY"
            ? "Resets monthly"
            : budget.endDate
            ? `Ends ${new Date(budget.endDate).toLocaleDateString()}`
            : "No end date set"}
        </p>
      </CardContent>
    </Card>
  )
}
