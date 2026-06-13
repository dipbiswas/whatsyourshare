"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, Eye, EyeOff, Camera, Loader2 } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Member {
  userId: string
  user: { id: string; name: string }
}

interface Props {
  groupId: string
  currency: string
  members: Member[]
  currentUserId: string
  onCreated: () => void
}

const CATEGORIES = ["General", "Food", "Transport", "Accommodation", "Entertainment", "Utilities", "Other"]

export function AddExpenseDialog({ groupId, currency, members, currentUserId, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT">("EQUAL")
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "General",
    paidById: currentUserId,
    visibility: "GROUP" as "GROUP" | "PAYERS_ONLY",
  })
  const [exactSplits, setExactSplits] = useState<Record<string, string>>({})

  async function handleReceiptScan(file: File) {
    setScanning(true)
    try {
      const buffer = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp"

      const res = await fetch("/api/expenses/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error ?? "Could not read receipt — fill in manually")
        return
      }
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

  function getEqualSplitAmount() {
    const amt = parseFloat(form.amount)
    if (!amt || members.length === 0) return 0
    return Math.round((amt / members.length) * 100) / 100
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    let splits: { userId: string; amount: number }[]
    if (splitType === "EQUAL") {
      const each = Math.round((amount / members.length) * 100) / 100
      splits = members.map((m) => ({ userId: m.userId, amount: each }))
    } else {
      splits = members.map((m) => ({
        userId: m.userId,
        amount: parseFloat(exactSplits[m.userId] ?? "0"),
      }))
      const total = splits.reduce((s, x) => s + x.amount, 0)
      if (Math.abs(total - amount) > 0.02) {
        toast.error(`Split amounts must sum to ${amount}. Currently: ${total.toFixed(2)}`)
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount, groupId, splitType, splits }),
      })
      if (!res.ok) {
        toast.error("Failed to add expense")
        return
      }
      toast.success("Expense added!")
      onCreated()
      setOpen(false)
      setForm({ description: "", amount: "", category: "General", paidById: currentUserId, visibility: "GROUP" })
      setExactSplits({})
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Expense
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
          </DialogHeader>

          {/* Receipt scan shortcut */}
          <label className={`flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-3 text-sm cursor-pointer transition-colors ${
            scanning
              ? "border-violet-300 bg-violet-50 text-violet-500"
              : "border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-gray-400 hover:text-violet-600"
          }`}>
            {scanning ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Scanning receipt…</>
            ) : (
              <><Camera className="h-4 w-4" /> Scan a receipt to auto-fill</>
            )}
            {/* capture="environment" opens rear camera directly on mobile */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={scanning}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleReceiptScan(file)
                e.target.value = ""
              }}
            />
          </label>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Dinner, Uber, Hotel…"
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
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "General" }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Paid by</Label>
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
                      {m.user.name} {m.userId === currentUserId ? "(you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Split</Label>
              <Tabs value={splitType} onValueChange={(v) => setSplitType(v as "EQUAL" | "EXACT")}>
                <TabsList className="w-full">
                  <TabsTrigger value="EQUAL" className="flex-1">
                    Equal
                  </TabsTrigger>
                  <TabsTrigger value="EXACT" className="flex-1">
                    Custom amounts
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="EQUAL" className="pt-2">
                  <p className="text-sm text-gray-500">
                    Each person pays{" "}
                    <strong>
                      {currency} {getEqualSplitAmount().toFixed(2)}
                    </strong>
                  </p>
                </TabsContent>
                <TabsContent value="EXACT" className="pt-2 space-y-2">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 w-28 truncate">{m.user.name}</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="h-8"
                        value={exactSplits[m.userId] ?? ""}
                        onChange={(e) => setExactSplits((s) => ({ ...s, [m.userId]: e.target.value }))}
                      />
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>

            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  visibility: f.visibility === "GROUP" ? "PAYERS_ONLY" : "GROUP",
                }))
              }
              className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                form.visibility === "PAYERS_ONLY"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {form.visibility === "PAYERS_ONLY" ? (
                <EyeOff className="h-4 w-4 shrink-0" />
              ) : (
                <Eye className="h-4 w-4 shrink-0" />
              )}
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
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
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
