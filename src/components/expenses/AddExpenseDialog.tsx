"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plus, Eye, EyeOff, Camera, Loader2, Check } from "lucide-react"
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
  members: Member[]
  currentUserId: string
  defaultSplitType?: "EQUAL" | "SELECTED" | "SHARES" | "PERCENTAGE" | "EXACT"
  defaultSplitShares?: Record<string, number>
  onCreated: () => void
  trigger?: React.ReactNode
  tripDayId?: string
}

const CATEGORIES = ["General", "Food", "Transport", "Accommodation", "Entertainment", "Utilities", "Other"]
type SplitType = "EQUAL" | "SELECTED" | "SHARES" | "PERCENTAGE" | "EXACT"

const SPLIT_TABS: { value: SplitType; label: string; desc: string }[] = [
  { value: "EQUAL",      label: "Equal",       desc: "Split evenly among everyone" },
  { value: "SELECTED",   label: "By members",  desc: "Equal split among selected people only" },
  { value: "SHARES",     label: "Shares",      desc: "Enter headcount or portions — e.g. family of 4 vs 2" },
  { value: "PERCENTAGE", label: "Percentage",  desc: "Each person pays a % of the total" },
  { value: "EXACT",      label: "Exact",       desc: "Enter each person's exact amount" },
]

export function AddExpenseDialog({ groupId, currency, members, currentUserId, defaultSplitType = "EQUAL", defaultSplitShares, onCreated, trigger, tripDayId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [splitType, setSplitType] = useState<SplitType>(defaultSplitType)

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "General",
    paidById: currentUserId,
    visibility: "GROUP" as "GROUP" | "PAYERS_ONLY",
    date: format(new Date(), "yyyy-MM-dd"),
  })
  const [guestPayee, setGuestPayee] = useState("")
  const [isGuestPayee, setIsGuestPayee] = useState(false)

  // SELECTED: track which members are included (default: all)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(members.map((m) => m.userId))
  )

  // PERCENTAGE: pct string per userId
  const [pctSplits, setPctSplits] = useState<Record<string, string>>({})

  // EXACT: amount string per userId
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({})

  // SHARES: share count per userId (e.g. 4 and 2 for families) — pre-fill from group defaults
  const [shares, setShares] = useState<Record<string, string>>(
    defaultSplitShares
      ? Object.fromEntries(members.map((m) => [m.userId, String(defaultSplitShares[m.userId] ?? "")]))
      : {}
  )

  const amount = parseFloat(form.amount) || 0

  // ── Derived values ──────────────────────────────────────────────

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.userId)),
    [members, selectedIds]
  )

  const equalAmount = amount > 0 && members.length > 0
    ? Math.round((amount / members.length) * 100) / 100
    : 0

  const selectedEqualAmount = amount > 0 && selectedMembers.length > 0
    ? Math.round((amount / selectedMembers.length) * 100) / 100
    : 0

  const totalPct = members.reduce((s, m) => s + (parseFloat(pctSplits[m.userId] ?? "0") || 0), 0)
  const remainingPct = Math.round((100 - totalPct) * 100) / 100

  const totalExact = members.reduce((s, m) => s + (parseFloat(exactSplits[m.userId] ?? "0") || 0), 0)
  const remainingExact = Math.round((amount - totalExact) * 100) / 100

  const totalShares = members.reduce((s, m) => s + (parseFloat(shares[m.userId] ?? "0") || 0), 0)

  // ── Helpers ─────────────────────────────────────────────────────

  function toggleMember(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        if (next.size === 1) return prev // must keep at least 1
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  function distributeEquallyPct() {
    const each = Math.round((100 / members.length) * 100) / 100
    const updates: Record<string, string> = {}
    members.forEach((m, i) => {
      // last person gets the remainder to ensure sum = 100
      updates[m.userId] = i === members.length - 1
        ? String(Math.round((100 - each * (members.length - 1)) * 100) / 100)
        : String(each)
    })
    setPctSplits(updates)
  }

  // ── Submit ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }

    let splits: { userId: string; amount: number }[]

    if (splitType === "EQUAL") {
      const each = Math.round((amount / members.length) * 100) / 100
      splits = members.map((m) => ({ userId: m.userId, amount: each }))

    } else if (splitType === "SELECTED") {
      if (selectedMembers.length === 0) { toast.error("Select at least one member"); return }
      const each = Math.round((amount / selectedMembers.length) * 100) / 100
      splits = selectedMembers.map((m) => ({ userId: m.userId, amount: each }))

    } else if (splitType === "SHARES") {
      if (totalShares === 0) { toast.error("Enter at least one share"); return }
      splits = members.map((m) => {
        const s = parseFloat(shares[m.userId] ?? "0") || 0
        return { userId: m.userId, amount: Math.round((amount * s / totalShares) * 100) / 100 }
      }).filter((s) => s.amount > 0)
      if (splits.length === 0) { toast.error("Enter shares for at least one member"); return }

    } else if (splitType === "PERCENTAGE") {
      if (Math.abs(totalPct - 100) > 0.01) {
        toast.error(`Percentages must sum to 100%. Currently: ${totalPct.toFixed(2)}%`)
        return
      }
      splits = members.map((m) => ({
        userId: m.userId,
        amount: Math.round((amount * (parseFloat(pctSplits[m.userId] ?? "0") / 100)) * 100) / 100,
      }))

    } else {
      splits = members.map((m) => ({
        userId: m.userId,
        amount: parseFloat(exactSplits[m.userId] ?? "0"),
      }))
      const total = splits.reduce((s, x) => s + x.amount, 0)
      if (Math.abs(total - amount) > 0.02) {
        toast.error(`Amounts must sum to ${amount.toFixed(2)}. Currently: ${total.toFixed(2)}`)
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // SHARES is sent as PERCENTAGE to the API (already converted to amounts above)
        body: JSON.stringify({ ...form, amount, currency, groupId, splitType: splitType === "SHARES" ? "PERCENTAGE" : splitType, splits, date: form.date, guestPayeeName: isGuestPayee ? guestPayee : undefined, ...(tripDayId ? { tripDayId } : {}) }),
      })
      if (!res.ok) { toast.error("Failed to add expense"); return }
      toast.success("Expense added!")
      onCreated()
      setOpen(false)
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({ description: "", amount: "", category: "General", paidById: currentUserId, visibility: "GROUP", date: format(new Date(), "yyyy-MM-dd") })
    setSplitType(defaultSplitType)
    setSelectedIds(new Set(members.map((m) => m.userId)))
    setPctSplits({})
    setExactSplits({})
    setShares(
      defaultSplitShares
        ? Object.fromEntries(members.map((m) => [m.userId, String(defaultSplitShares[m.userId] ?? "")]))
        : {}
    )
    setGuestPayee("")
    setIsGuestPayee(false)
  }

  // ── Receipt scan ─────────────────────────────────────────────────

  async function handleReceiptScan(file: File) {
    setScanning(true)
    try {
      const resized = await resizeImage(file, 1200)
      const base64 = await fileToBase64(resized)
      const res = await fetch("/api/expenses/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: "image/jpeg" }),
      })
      if (!res.ok) { toast.error("Could not read receipt — fill in manually"); return }
      const data = await res.json()
      setForm((f) => ({
        ...f,
        description: data.description || f.description,
        amount: data.amount ? String(data.amount) : f.amount,
        category: data.category || f.category,
      }))
      toast.success("Receipt scanned! Review the pre-filled values.")
    } catch {
      toast.error("Receipt scan failed — fill in manually")
    } finally {
      setScanning(false)
    }
  }

  function resizeImage(file: File, maxWidth: number): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  function fileToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(",")[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
          </DialogHeader>

          {/* Receipt scan */}
          <label className={cn(
            "flex items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm cursor-pointer transition-colors",
            scanning
              ? "border-violet-300 bg-violet-50 dark:bg-violet-500/10 text-violet-500"
              : "border-border hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-muted-foreground hover:text-violet-600"
          )}>
            {scanning
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning receipt…</>
              : <><Camera className="h-4 w-4" /> Scan a receipt to auto-fill</>
            }
            <input type="file" accept="image/*" capture="environment" className="hidden"
              disabled={scanning}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptScan(f); e.target.value = "" }}
            />
          </label>

          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Dinner, Uber, Hotel…" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required />
            </div>

            {/* Amount + Category + Date */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ({currency})</Label>
                <Input type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "General" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
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
              {isGuestPayee ? (
                <Input placeholder="e.g. Sarah (partner), Hotel concierge…" value={guestPayee} onChange={e => setGuestPayee(e.target.value)} />
              ) : (
                <Select value={form.paidById} onValueChange={(v) => setForm((f) => ({ ...f, paidById: v ?? f.paidById }))}>
                  <SelectTrigger>
                    <SelectValue>
                      {members.find((m) => m.userId === form.paidById)?.user.name ?? "Select member"}
                      {form.paidById === currentUserId ? " (you)" : ""}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.user.name}{m.userId === currentUserId ? " (you)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <button type="button" onClick={() => setIsGuestPayee(v => !v)} className="text-xs text-muted-foreground hover:text-violet-500 transition-colors">
                {isGuestPayee ? "← Paid by a group member" : "Someone outside the group paid →"}
              </button>
            </div>

            {/* ── Split section ── */}
            <div className="space-y-3">
              <Label>Split</Label>

              {/* Tab pills */}
              <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-muted">
                {SPLIT_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setSplitType(tab.value)}
                    className={cn(
                      "rounded-lg py-1.5 text-xs font-medium transition-all",
                      splitType === tab.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Description of selected split type */}
              <p className="text-xs text-muted-foreground">
                {SPLIT_TABS.find((t) => t.value === splitType)?.desc}
              </p>

              {/* ── EQUAL ── */}
              {splitType === "EQUAL" && (
                <div className="glass rounded-xl p-3 space-y-1.5">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between text-sm">
                      <span className="text-foreground/80">{m.user.name}{m.userId === currentUserId ? " (you)" : ""}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {currency} {equalAmount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── SELECTED ── */}
              {splitType === "SELECTED" && (
                <div className="space-y-1.5">
                  <div className="glass rounded-xl overflow-hidden">
                    {members.map((m, idx) => {
                      const checked = selectedIds.has(m.userId)
                      return (
                        <div key={m.userId}>
                          {idx > 0 && <div className="h-px bg-border/60 mx-3" />}
                          <button
                            type="button"
                            onClick={() => toggleMember(m.userId)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
                          >
                            <div className={cn(
                              "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                              checked
                                ? "bg-violet-600 border-violet-600"
                                : "border-border"
                            )}>
                              {checked && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <span className={cn("flex-1 text-sm", checked ? "text-foreground" : "text-muted-foreground")}>
                              {m.user.name}{m.userId === currentUserId ? " (you)" : ""}
                            </span>
                            {checked && amount > 0 && (
                              <span className="text-sm font-semibold tabular-nums text-foreground">
                                {currency} {selectedEqualAmount.toFixed(2)}
                              </span>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {selectedMembers.length > 0 && amount > 0 && (
                    <p className="text-xs text-muted-foreground px-1">
                      {currency} {amount.toFixed(2)} ÷ {selectedMembers.length} {selectedMembers.length === 1 ? "person" : "people"} = {currency} {selectedEqualAmount.toFixed(2)} each
                    </p>
                  )}
                </div>
              )}

              {/* ── SHARES ── */}
              {splitType === "SHARES" && (
                <div className="space-y-2">
                  <div className="glass rounded-xl overflow-hidden">
                    {members.map((m, idx) => {
                      const s = parseFloat(shares[m.userId] ?? "0") || 0
                      const derived = totalShares > 0 && amount > 0
                        ? Math.round((amount * s / totalShares) * 100) / 100
                        : 0
                      return (
                        <div key={m.userId}>
                          {idx > 0 && <div className="h-px bg-border/60 mx-3" />}
                          <div className="flex items-center gap-3 px-3 py-2">
                            <span className="text-sm text-foreground/80 flex-1 truncate">
                              {m.user.name}{m.userId === currentUserId ? " (you)" : ""}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                className="h-8 w-16 text-right tabular-nums"
                                value={shares[m.userId] ?? ""}
                                onChange={(e) => setShares((prev) => ({ ...prev, [m.userId]: e.target.value }))}
                              />
                              <span className="text-xs text-muted-foreground w-10">shares</span>
                            </div>
                            {s > 0 && amount > 0 && totalShares > 0 && (
                              <span className="text-sm font-semibold tabular-nums text-foreground w-20 text-right shrink-0">
                                {currency} {derived.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {totalShares > 0 && amount > 0 && (
                    <p className="text-xs text-muted-foreground px-1">
                      {totalShares} total shares · {currency} {(amount / totalShares).toFixed(2)} per share
                    </p>
                  )}
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 p-2.5 text-xs text-violet-700 dark:text-violet-300">
                    <strong>Example:</strong> Enter 4 for your family and 2 for your friend — the bill splits 4:2 (67% / 33%) automatically.
                  </div>
                </div>
              )}

              {/* ── PERCENTAGE ── */}
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
                            <span className="text-sm text-foreground/80 flex-1 truncate">
                              {m.user.name}{m.userId === currentUserId ? " (you)" : ""}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder="0"
                                className="h-8 w-20 text-right tabular-nums"
                                value={pctSplits[m.userId] ?? ""}
                                onChange={(e) => setPctSplits((s) => ({ ...s, [m.userId]: e.target.value }))}
                              />
                              <span className="text-sm text-muted-foreground w-4">%</span>
                            </div>
                            {amount > 0 && pct > 0 && (
                              <span className="text-sm font-semibold tabular-nums text-foreground w-20 text-right shrink-0">
                                {currency} {derived.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Progress bar + totals */}
                  <div className="space-y-1.5 px-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          totalPct > 100 ? "bg-rose-500" : totalPct === 100 ? "bg-emerald-500" : "bg-violet-500"
                        )}
                        style={{ width: `${Math.min(totalPct, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn(
                        "font-medium",
                        totalPct > 100 ? "text-rose-500" : totalPct === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      )}>
                        {totalPct.toFixed(2)}% assigned
                      </span>
                      {totalPct < 100 && (
                        <span className="text-muted-foreground">{remainingPct.toFixed(2)}% remaining</span>
                      )}
                      {totalPct === 100 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Looks good</span>
                      )}
                      {totalPct > 100 && (
                        <span className="text-rose-500 font-medium">Over by {(totalPct - 100).toFixed(2)}%</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={distributeEquallyPct}
                    className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Distribute equally
                  </button>
                </div>
              )}

              {/* ── EXACT ── */}
              {splitType === "EXACT" && (
                <div className="space-y-2">
                  <div className="glass rounded-xl overflow-hidden">
                    {members.map((m, idx) => {
                      const val = parseFloat(exactSplits[m.userId] ?? "0") || 0
                      return (
                        <div key={m.userId}>
                          {idx > 0 && <div className="h-px bg-border/60 mx-3" />}
                          <div className="flex items-center gap-3 px-3 py-2">
                            <span className="text-sm text-foreground/80 flex-1 truncate">
                              {m.user.name}{m.userId === currentUserId ? " (you)" : ""}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className="h-8 w-28 text-right tabular-nums shrink-0"
                              value={exactSplits[m.userId] ?? ""}
                              onChange={(e) => setExactSplits((s) => ({ ...s, [m.userId]: e.target.value }))}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Running total */}
                  <div className="space-y-1.5 px-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          amount > 0 && totalExact > amount ? "bg-rose-500"
                          : amount > 0 && Math.abs(totalExact - amount) < 0.02 ? "bg-emerald-500"
                          : "bg-violet-500"
                        )}
                        style={{ width: amount > 0 ? `${Math.min((totalExact / amount) * 100, 100)}%` : "0%" }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {currency} {totalExact.toFixed(2)} assigned
                      </span>
                      {amount > 0 && Math.abs(remainingExact) > 0.01 && (
                        <span className={cn(
                          "font-medium",
                          remainingExact < 0 ? "text-rose-500" : "text-muted-foreground"
                        )}>
                          {remainingExact < 0
                            ? `Over by ${currency} ${Math.abs(remainingExact).toFixed(2)}`
                            : `${currency} ${remainingExact.toFixed(2)} remaining`
                          }
                        </span>
                      )}
                      {amount > 0 && Math.abs(remainingExact) <= 0.01 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Looks good</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => setForm((f) => ({
                ...f,
                visibility: f.visibility === "GROUP" ? "PAYERS_ONLY" : "GROUP",
              }))}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                form.visibility === "PAYERS_ONLY"
                  ? "border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/20 text-amber-800 dark:text-amber-300"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              {form.visibility === "PAYERS_ONLY"
                ? <EyeOff className="h-4 w-4 shrink-0" />
                : <Eye className="h-4 w-4 shrink-0" />
              }
              <span className="flex-1 text-left">
                {form.visibility === "PAYERS_ONLY"
                  ? "Private — only visible to payer & split members"
                  : "Visible to everyone in the group"}
              </span>
              <span className="text-xs font-medium uppercase tracking-wide">
                {form.visibility === "PAYERS_ONLY" ? "Private" : "Public"}
              </span>
            </button>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setOpen(false); resetForm() }}>
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={loading}>
                {loading ? "Adding…" : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
