"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Target, Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

const CATEGORIES = ["General", "Food", "Transport", "Accommodation", "Entertainment", "Utilities", "Other"]

interface CategoryBudgetRow {
  category: string
  amount: string
}

interface Props {
  groupId: string
  currency: string
  existingBudget?: {
    totalAmount: number
    period: string
    startDate: string
    endDate?: string | null
    alertAt: number
    categoryBudgets: { category: string; amount: number }[]
  } | null
  onSaved: () => void
}

export function SetGroupBudgetDialog({ groupId, currency, existingBudget, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    totalAmount: existingBudget ? String(existingBudget.totalAmount) : "",
    period: (existingBudget?.period ?? "MONTHLY") as "TRIP" | "MONTHLY" | "CUSTOM",
    startDate: existingBudget?.startDate
      ? format(new Date(existingBudget.startDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    endDate: existingBudget?.endDate
      ? format(new Date(existingBudget.endDate), "yyyy-MM-dd")
      : "",
    alertAt: existingBudget ? String(Math.round(existingBudget.alertAt * 100)) : "80",
  })
  const [categoryRows, setCategoryRows] = useState<CategoryBudgetRow[]>(
    existingBudget?.categoryBudgets.map((cb) => ({
      category: cb.category,
      amount: String(cb.amount),
    })) ?? []
  )

  function addCategoryRow() {
    const used = new Set(categoryRows.map((r) => r.category))
    const next = CATEGORIES.find((c) => !used.has(c)) ?? "General"
    setCategoryRows((rows) => [...rows, { category: next, amount: "" }])
  }

  function removeCategoryRow(idx: number) {
    setCategoryRows((rows) => rows.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const totalAmount = parseFloat(form.totalAmount)
    if (!totalAmount || totalAmount <= 0) {
      toast.error("Enter a valid budget amount")
      return
    }

    const validCategoryBudgets = categoryRows
      .filter((r) => r.amount && parseFloat(r.amount) > 0)
      .map((r) => ({ category: r.category, amount: parseFloat(r.amount) }))

    setLoading(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount,
          period: form.period,
          startDate: new Date(form.startDate).toISOString(),
          endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
          alertAt: parseFloat(form.alertAt) / 100,
          categoryBudgets: validCategoryBudgets,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error ? String(err.error) : "Failed to save budget")
        return
      }
      toast.success(existingBudget ? "Budget updated!" : "Budget set!")
      onSaved()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Target className="h-4 w-4" />
        {existingBudget ? "Edit Budget" : "Set Budget"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{existingBudget ? "Edit group budget" : "Set group budget"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 -mt-1">
            Get alerts when your group is approaching the limit.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Total + period */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total budget ({currency})</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="2000.00"
                  value={form.totalAmount}
                  onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Period type</Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => setForm((f) => ({ ...f, period: (v ?? "MONTHLY") as typeof form.period }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="TRIP">Trip / one-off</SelectItem>
                    <SelectItem value="CUSTOM">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </div>
              {form.period !== "MONTHLY" && (
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Alert threshold */}
            <div className="space-y-1.5">
              <Label>Alert when {form.alertAt}% spent</Label>
              <Input
                type="range"
                min="50"
                max="95"
                step="5"
                value={form.alertAt}
                onChange={(e) => setForm((f) => ({ ...f, alertAt: e.target.value }))}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>50%</span>
                <span className="text-indigo-600 font-medium">{form.alertAt}%</span>
                <span>95%</span>
              </div>
            </div>

            {/* Category budgets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Category budgets (optional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={addCategoryRow}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              {categoryRows.length > 0 && (
                <div className="space-y-2 rounded-lg border p-3">
                  {categoryRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select
                        value={row.category}
                        onValueChange={(v) =>
                          setCategoryRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, category: v ?? r.category } : r))
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="0.00"
                        className="h-8 flex-1"
                        value={row.amount}
                        onChange={(e) =>
                          setCategoryRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r))
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeCategoryRow(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? "Saving…" : existingBudget ? "Update budget" : "Set budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
