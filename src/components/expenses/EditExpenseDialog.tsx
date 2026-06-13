"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import { Pencil, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const CATEGORIES = ["General", "Food", "Transport", "Accommodation", "Entertainment", "Utilities", "Other"]
type SplitType = "EQUAL" | "SELECTED" | "SHARES" | "PERCENTAGE" | "EXACT"

const SPLIT_TABS: { value: SplitType; label: string }[] = [
  { value: "EQUAL",      label: "Equal" },
  { value: "SELECTED",   label: "By members" },
  { value: "SHARES",     label: "Shares" },
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "EXACT",      label: "Exact" },
]

interface Member {
  userId: string
  user: { id: string; name: string }
}

interface Split {
  userId: string
  amount: number
}

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  category: string
  splitType: string
  date: string
  paidById: string
  paidBy: { id: string; name: string }
  splits: Split[]
}

interface Props {
  expense: Expense
  members: Member[]
  /** Pass the group currency so the label is always correct regardless of stored value */
  currency?: string
  onUpdated: (expense: object) => void
}

export function EditExpenseDialog({ expense, members, currency: groupCurrency, onUpdated }: Props) {
  // Prefer the group's currency (always correct) over what's stored on the expense (may be wrong legacy USD)
  const currency = groupCurrency ?? expense.currency
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const initialSplitType = (expense.splitType as SplitType) ?? "EQUAL"

  const [form, setForm] = useState({
    description: expense.description,
    amount: String(expense.amount),
    category: expense.category,
    paidById: expense.paidById,
    date: expense.date.slice(0, 10),
  })
  const [splitType, setSplitType] = useState<SplitType>(initialSplitType)

  // SELECTED: which members are included
  const splitMemberIds = new Set(expense.splits.map((s) => s.userId))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    splitMemberIds.size > 0 ? splitMemberIds : new Set(members.map((m) => m.userId))
  )

  // PERCENTAGE: pre-fill from existing splits
  const [pctSplits, setPctSplits] = useState<Record<string, string>>(() => {
    if (initialSplitType === "PERCENTAGE") {
      return Object.fromEntries(
        expense.splits.map((s) => [s.userId, String(Math.round((s.amount / expense.amount) * 10000) / 100)])
      )
    }
    return {}
  })

  // EXACT: pre-fill from existing splits
  const [exactSplits, setExactSplits] = useState<Record<string, string>>(() => {
    if (initialSplitType === "EXACT") {
      return Object.fromEntries(expense.splits.map((s) => [s.userId, String(s.amount)]))
    }
    return {}
  })

  // SHARES: start empty (shares aren't stored, only amounts are)
  const [shares, setShares] = useState<Record<string, string>>({})

  const amount = parseFloat(form.amount) || 0

  const selectedMembers = useMemo(() => members.filter((m) => selectedIds.has(m.userId)), [members, selectedIds])
  const equalAmount = amount > 0 && members.length > 0 ? Math.round((amount / members.length) * 100) / 100 : 0
  const selectedEqualAmount = amount > 0 && selectedMembers.length > 0 ? Math.round((amount / selectedMembers.length) * 100) / 100 : 0
  const totalPct = members.reduce((s, m) => s + (parseFloat(pctSplits[m.userId] ?? "0") || 0), 0)
  const totalExact = members.reduce((s, m) => s + (parseFloat(exactSplits[m.userId] ?? "0") || 0), 0)
  const remainingExact = Math.round((amount - totalExact) * 100) / 100
  const totalShares = members.reduce((s, m) => s + (parseFloat(shares[m.userId] ?? "0") || 0), 0)

  function toggleMember(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) { if (next.size === 1) return prev; next.delete(userId) }
      else next.add(userId)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }

    let splits: { userId: string; amount: number }[]
    let apiSplitType: string = splitType

    if (splitType === "EQUAL") {
      const each = Math.round((amount / members.length) * 100) / 100
      splits = members.map((m) => ({ userId: m.userId, amount: each }))

    } else if (splitType === "SELECTED") {
      if (selectedMembers.length === 0) { toast.error("Select at least one member"); return }
      const each = Math.round((amount / selectedMembers.length) * 100) / 100
      splits = selectedMembers.map((m) => ({ userId: m.userId, amount: each }))

    } else if (splitType === "SHARES") {
      if (totalShares === 0) { toast.error("Enter at least one share"); return }
      splits = members
        .map((m) => ({ userId: m.userId, amount: Math.round((amount * (parseFloat(shares[m.userId] ?? "0") || 0) / totalShares) * 100) / 100 }))
        .filter((s) => s.amount > 0)
      apiSplitType = "PERCENTAGE"

    } else if (splitType === "PERCENTAGE") {
      if (Math.abs(totalPct - 100) > 0.01) { toast.error(`Percentages must sum to 100%. Currently: ${totalPct.toFixed(2)}%`); return }
      splits = members.map((m) => ({
        userId: m.userId,
        amount: Math.round((amount * (parseFloat(pctSplits[m.userId] ?? "0") / 100)) * 100) / 100,
      }))

    } else {
      splits = members.map((m) => ({ userId: m.userId, amount: parseFloat(exactSplits[m.userId] ?? "0") }))
      if (Math.abs(totalExact - amount) > 0.02) { toast.error(`Amounts must sum to ${amount.toFixed(2)}. Currently: ${totalExact.toFixed(2)}`); return }
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount, currency, splitType: apiSplitType, splits }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error ? String(err.error) : "Failed to update expense")
        return
      }
      const updated = await res.json()
      toast.success("Expense updated")
      onUpdated(updated)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        onClick={() => setOpen(true)}
        title="Edit expense"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required />
            </div>

            {/* Amount + Category + Date */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ({currency})</Label>
                <Input type="number" step="0.01" min="0.01" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? f.category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>

            {/* Paid by */}
            <div className="space-y-1.5">
              <Label>Paid by</Label>
              <Select value={form.paidById} onValueChange={(v) => setForm((f) => ({ ...f, paidById: v ?? f.paidById }))}>
                <SelectTrigger>
                  <SelectValue>{members.find((m) => m.userId === form.paidById)?.user.name ?? "Select member"}</SelectValue>
                </SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.user.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Split */}
            <div className="space-y-3">
              <Label>Split</Label>
              <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-muted">
                {SPLIT_TABS.map((tab) => (
                  <button key={tab.value} type="button" onClick={() => setSplitType(tab.value)}
                    className={cn("rounded-lg py-1.5 text-xs font-medium transition-all",
                      splitType === tab.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* EQUAL */}
              {splitType === "EQUAL" && (
                <div className="glass rounded-xl p-3 space-y-1.5">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between text-sm">
                      <span className="text-foreground/80">{m.user.name}</span>
                      <span className="font-semibold tabular-nums">{currency} {equalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* SELECTED */}
              {splitType === "SELECTED" && (
                <div className="space-y-1.5">
                  <div className="glass rounded-xl overflow-hidden">
                    {members.map((m, idx) => {
                      const checked = selectedIds.has(m.userId)
                      return (
                        <div key={m.userId}>
                          {idx > 0 && <div className="h-px bg-border/60 mx-3" />}
                          <button type="button" onClick={() => toggleMember(m.userId)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left">
                            <div className={cn("h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                              checked ? "bg-violet-600 border-violet-600" : "border-border")}>
                              {checked && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className={cn("flex-1 text-sm", checked ? "text-foreground" : "text-muted-foreground")}>{m.user.name}</span>
                            {checked && amount > 0 && (
                              <span className="text-sm font-semibold tabular-nums">{currency} {selectedEqualAmount.toFixed(2)}</span>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* SHARES */}
              {splitType === "SHARES" && (
                <div className="space-y-2">
                  <div className="glass rounded-xl overflow-hidden">
                    {members.map((m, idx) => {
                      const s = parseFloat(shares[m.userId] ?? "0") || 0
                      const derived = totalShares > 0 && amount > 0 ? Math.round((amount * s / totalShares) * 100) / 100 : 0
                      return (
                        <div key={m.userId}>
                          {idx > 0 && <div className="h-px bg-border/60 mx-3" />}
                          <div className="flex items-center gap-3 px-3 py-2">
                            <span className="text-sm text-foreground/80 flex-1">{m.user.name}</span>
                            <Input type="number" min="0" step="1" placeholder="0"
                              className="h-8 w-16 text-right tabular-nums"
                              value={shares[m.userId] ?? ""}
                              onChange={(e) => setShares((p) => ({ ...p, [m.userId]: e.target.value }))} />
                            <span className="text-xs text-muted-foreground w-10">shares</span>
                            {s > 0 && amount > 0 && totalShares > 0 && (
                              <span className="text-sm font-semibold tabular-nums w-20 text-right shrink-0">{currency} {derived.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {totalShares > 0 && amount > 0 && (
                    <p className="text-xs text-muted-foreground px-1">{totalShares} total shares · {currency} {(amount / totalShares).toFixed(2)} per share</p>
                  )}
                </div>
              )}

              {/* PERCENTAGE */}
              {splitType === "PERCENTAGE" && (
                <div className="space-y-2">
                  <div className="glass rounded-xl overflow-hidden">
                    {members.map((m, idx) => {
                      const pct = parseFloat(pctSplits[m.userId] ?? "0") || 0
                      const derived = amount > 0 ? Math.round(amount * pct / 100 * 100) / 100 : 0
                      return (
                        <div key={m.userId}>
                          {idx > 0 && <div className="h-px bg-border/60 mx-3" />}
                          <div className="flex items-center gap-3 px-3 py-2">
                            <span className="text-sm text-foreground/80 flex-1">{m.user.name}</span>
                            <Input type="number" min="0" max="100" step="0.01" placeholder="0"
                              className="h-8 w-20 text-right tabular-nums"
                              value={pctSplits[m.userId] ?? ""}
                              onChange={(e) => setPctSplits((s) => ({ ...s, [m.userId]: e.target.value }))} />
                            <span className="text-sm text-muted-foreground w-4">%</span>
                            {amount > 0 && pct > 0 && (
                              <span className="text-sm font-semibold tabular-nums w-20 text-right shrink-0">{currency} {derived.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="space-y-1 px-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", totalPct > 100 ? "bg-rose-500" : totalPct === 100 ? "bg-emerald-500" : "bg-violet-500")}
                        style={{ width: `${Math.min(totalPct, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={cn("font-medium", totalPct > 100 ? "text-rose-500" : totalPct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                        {totalPct.toFixed(2)}% assigned
                      </span>
                      {totalPct === 100 && <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Looks good</span>}
                      {totalPct > 100 && <span className="text-rose-500 font-medium">Over by {(totalPct - 100).toFixed(2)}%</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* EXACT */}
              {splitType === "EXACT" && (
                <div className="space-y-2">
                  <div className="glass rounded-xl overflow-hidden">
                    {members.map((m, idx) => (
                      <div key={m.userId}>
                        {idx > 0 && <div className="h-px bg-border/60 mx-3" />}
                        <div className="flex items-center gap-3 px-3 py-2">
                          <span className="text-sm text-foreground/80 flex-1">{m.user.name}</span>
                          <Input type="number" min="0" step="0.01" placeholder="0.00"
                            className="h-8 w-28 text-right tabular-nums shrink-0"
                            value={exactSplits[m.userId] ?? ""}
                            onChange={(e) => setExactSplits((s) => ({ ...s, [m.userId]: e.target.value }))} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 px-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all",
                        amount > 0 && totalExact > amount ? "bg-rose-500" : amount > 0 && Math.abs(totalExact - amount) < 0.02 ? "bg-emerald-500" : "bg-violet-500")}
                        style={{ width: amount > 0 ? `${Math.min((totalExact / amount) * 100, 100)}%` : "0%" }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{currency} {totalExact.toFixed(2)} assigned</span>
                      {amount > 0 && Math.abs(remainingExact) <= 0.01
                        ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Looks good</span>
                        : <span className={cn("font-medium", remainingExact < 0 ? "text-rose-500" : "text-muted-foreground")}>
                            {remainingExact < 0 ? `Over by ${currency} ${Math.abs(remainingExact).toFixed(2)}` : `${currency} ${remainingExact.toFixed(2)} remaining`}
                          </span>
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={loading}>
                {loading ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
