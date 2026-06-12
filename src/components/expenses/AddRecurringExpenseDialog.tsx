"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"
import { format, addDays } from "date-fns"
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

interface Props {
  groupId: string
  currency: string
  onCreated: (recurring: object) => void
}

const CATEGORIES = ["General", "Food", "Transport", "Accommodation", "Entertainment", "Utilities", "Other"]
const FREQUENCIES = [
  { value: "WEEKLY", label: "Every week" },
  { value: "MONTHLY", label: "Every month" },
  { value: "QUARTERLY", label: "Every quarter" },
]

export function AddRecurringExpenseDialog({ groupId, currency, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    description: "",
    lastAmount: "",
    category: "Utilities",
    frequency: "MONTHLY",
    nextDueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.lastAmount)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!form.description.trim()) {
      toast.error("Description is required")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/recurring-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          description: form.description,
          lastAmount: amount,
          currency,
          category: form.category,
          frequency: form.frequency,
          nextDueDate: new Date(form.nextDueDate).toISOString(),
        }),
      })
      if (!res.ok) {
        toast.error("Failed to create recurring expense")
        return
      }
      const recurring = await res.json()
      toast.success("Recurring expense created!")
      onCreated(recurring)
      setOpen(false)
      setForm({
        description: "",
        lastAmount: "",
        category: "Utilities",
        frequency: "MONTHLY",
        nextDueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <RefreshCw className="h-4 w-4" />
        Add Recurring
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New recurring expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 -mt-1">
            Auto-generates an expense for all group members on the schedule you choose.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Rent, Netflix, Electricity…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ({currency})</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.lastAmount}
                  onChange={(e) => setForm((f) => ({ ...f, lastAmount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "Utilities" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm((f) => ({ ...f, frequency: v ?? "MONTHLY" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>First due date</Label>
                <Input
                  type="date"
                  value={form.nextDueDate}
                  onChange={(e) => setForm((f) => ({ ...f, nextDueDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium">How it works</p>
              <p>Each period an expense will be automatically created and split equally among all group members. You can update the amount anytime from the Recurring tab.</p>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={loading}>
                {loading ? "Creating…" : "Create recurring"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
