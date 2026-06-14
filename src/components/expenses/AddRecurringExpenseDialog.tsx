"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { RefreshCw, Zap } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface Member {
  userId: string
  user: { id: string; name: string }
}

interface Props {
  groupId: string
  currency: string
  members?: Member[]
  canCreate?: boolean
  onCreated: (recurring: object) => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

const CATEGORIES = ["General", "Food", "Transport", "Accommodation", "Entertainment", "Utilities", "Other"]
const FREQUENCIES = [
  { value: "WEEKLY", label: "Every week" },
  { value: "MONTHLY", label: "Every month" },
  { value: "QUARTERLY", label: "Every quarter" },
]
const SPLIT_TYPES = [
  { value: "EQUAL", label: "Equal" },
  { value: "SELECTED", label: "By members" },
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "EXACT", label: "Exact amounts" },
]

export function AddRecurringExpenseDialog({ groupId, currency, members = [], canCreate = true, onCreated, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => { setInternalOpen(v); onOpenChange?.(v) }
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    description: "",
    lastAmount: "",
    category: "Utilities",
    frequency: "MONTHLY",
    splitType: "EQUAL",
    nextDueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
  })

  const [proPrice, setProPrice] = useState<string | null>(null)
  useEffect(() => {
    if (!open || canCreate) return
    fetch("/api/billing/plan-prices").then((r) => r.ok ? r.json() : null).then((p) => {
      if (p?.pro) setProPrice(`$${(p.pro / 100).toFixed(0)}/month`)
    })
  }, [open, canCreate])

  // SELECTED: which members are included
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set(members.map((m) => m.userId)))

  // PERCENTAGE: per-member percentages
  const [percentages, setPercentages] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((m) => [m.userId, ""]))
  )

  // EXACT: per-member amounts
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((m) => [m.userId, ""]))
  )

  const totalAmount = parseFloat(form.lastAmount) || 0

  const percentTotal = members.reduce((sum, m) => sum + (parseFloat(percentages[m.userId]) || 0), 0)
  const exactTotal = members.reduce((sum, m) => sum + (parseFloat(exactAmounts[m.userId]) || 0), 0)

  function toggleMember(userId: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function buildSplitData(): { userId: string; amount: number }[] | undefined {
    if (form.splitType === "EQUAL") return undefined

    if (form.splitType === "SELECTED") {
      const sel = members.filter((m) => selectedMembers.has(m.userId))
      if (sel.length === 0) return undefined
      const perPerson = Math.round((totalAmount / sel.length) * 100) / 100
      return sel.map((m) => ({ userId: m.userId, amount: perPerson }))
    }

    if (form.splitType === "PERCENTAGE") {
      return members.map((m) => ({
        userId: m.userId,
        amount: Math.round((totalAmount * (parseFloat(percentages[m.userId]) || 0)) / 100 * 100) / 100,
      }))
    }

    if (form.splitType === "EXACT") {
      return members.map((m) => ({
        userId: m.userId,
        amount: parseFloat(exactAmounts[m.userId]) || 0,
      }))
    }

    return undefined
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.lastAmount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!form.description.trim()) { toast.error("Description is required"); return }

    // Validate split
    if (form.splitType === "SELECTED" && selectedMembers.size === 0) {
      toast.error("Select at least one member"); return
    }
    if (form.splitType === "PERCENTAGE") {
      if (Math.abs(percentTotal - 100) > 0.5) { toast.error(`Percentages must total 100% (currently ${percentTotal.toFixed(1)}%)`); return }
    }
    if (form.splitType === "EXACT") {
      if (Math.abs(exactTotal - amount) > 0.02) { toast.error(`Exact amounts must total ${amount.toFixed(2)} (currently ${exactTotal.toFixed(2)})`); return }
    }

    const splitData = buildSplitData()

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
          splitType: form.splitType,
          ...(splitData ? { splitData } : {}),
          nextDueDate: new Date(form.nextDueDate).toISOString(),
        }),
      })
      if (!res.ok) { toast.error("Failed to create recurring expense"); return }
      const recurring = await res.json()
      toast.success("Recurring expense created!")
      onCreated(recurring)
      setOpen(false)
      setForm({
        description: "",
        lastAmount: "",
        category: "Utilities",
        frequency: "MONTHLY",
        splitType: "EQUAL",
        nextDueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {controlledOpen === undefined && (
        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <RefreshCw className="h-4 w-4" />
          Add Recurring
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New recurring expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Auto-generates an expense on the schedule you choose.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {!canCreate && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Pro feature</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Recurring expenses are available on the Pro plan.
                    </p>
                  </div>
                </div>
                <button type="button" className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 transition-colors">
                  <Zap className="h-3.5 w-3.5" />
                  Upgrade to Pro{proPrice ? ` — ${proPrice}` : ""}
                </button>
              </div>
            )}
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

            {/* Split type */}
            {members.length > 0 && (
              <div className="space-y-1.5">
                <Label>Split</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SPLIT_TYPES.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, splitType: st.value }))}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                        form.splitType === st.value
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SELECTED: checkboxes */}
            {form.splitType === "SELECTED" && members.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                {members.map((m, i) => (
                  <label
                    key={m.userId}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors",
                      i > 0 && "border-t border-border/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.has(m.userId)}
                      onChange={() => toggleMember(m.userId)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-foreground flex-1">{m.user.name}</span>
                    {selectedMembers.has(m.userId) && totalAmount > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {currency} {(totalAmount / selectedMembers.size).toFixed(2)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {/* PERCENTAGE */}
            {form.splitType === "PERCENTAGE" && members.length > 0 && (
              <div className="space-y-2">
                <div className="rounded-xl border border-border overflow-hidden">
                  {members.map((m, i) => (
                    <div key={m.userId} className={cn("flex items-center gap-3 px-3 py-2", i > 0 && "border-t border-border/50")}>
                      <span className="text-sm text-foreground flex-1">{m.user.name}</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="0"
                        value={percentages[m.userId]}
                        onChange={(e) => setPercentages((p) => ({ ...p, [m.userId]: e.target.value }))}
                        className="w-20 h-7 text-xs text-right"
                      />
                      <span className="text-xs text-muted-foreground w-4">%</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs px-1">
                  <span className="text-muted-foreground">Total</span>
                  <span className={cn("font-semibold tabular-nums", Math.abs(percentTotal - 100) > 0.5 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                    {percentTotal.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* EXACT */}
            {form.splitType === "EXACT" && members.length > 0 && (
              <div className="space-y-2">
                <div className="rounded-xl border border-border overflow-hidden">
                  {members.map((m, i) => (
                    <div key={m.userId} className={cn("flex items-center gap-3 px-3 py-2", i > 0 && "border-t border-border/50")}>
                      <span className="text-sm text-foreground flex-1">{m.user.name}</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={exactAmounts[m.userId]}
                        onChange={(e) => setExactAmounts((p) => ({ ...p, [m.userId]: e.target.value }))}
                        className="w-24 h-7 text-xs text-right"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs px-1">
                  <span className="text-muted-foreground">Total / Expense</span>
                  <span className={cn("font-semibold tabular-nums", totalAmount > 0 && Math.abs(exactTotal - totalAmount) > 0.02 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                    {currency} {exactTotal.toFixed(2)} / {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">How it works</p>
              <p>An expense is automatically created each period using the split you configure here.</p>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || !canCreate}>
                {loading ? "Creating…" : "Create recurring"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
