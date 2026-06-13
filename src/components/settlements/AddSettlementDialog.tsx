"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CheckCircle } from "lucide-react"
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

interface Member {
  userId: string
  user: { id: string; name: string }
}

interface Props {
  groupId: string
  currency: string
  members: Member[]
  currentUserId: string
  suggestedTo?: string
  suggestedAmount?: number
  onCreated: () => void
  compact?: boolean
}

export function AddSettlementDialog({
  groupId,
  currency,
  members,
  currentUserId,
  suggestedTo,
  suggestedAmount,
  onCreated,
  compact,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    toUserId: suggestedTo ?? "",
    amount: suggestedAmount?.toFixed(2) ?? "",
    note: "",
  })

  const others = members.filter((m) => m.userId !== currentUserId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!form.toUserId) {
      toast.error("Select who you are paying")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, toUserId: form.toUserId, amount, note: form.note }),
      })
      if (!res.ok) {
        toast.error("Failed to record settlement")
        return
      }
      toast.success("Settlement recorded!")
      onCreated()
      setOpen(false)
      setForm({ toUserId: "", amount: "", note: "" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={compact
          ? "h-7 text-xs px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          : "gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        }
        onClick={() => setOpen(true)}
      >
        {compact ? "Settle Up" : <><CheckCircle className="h-4 w-4" />Record Payment</>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Paying to</Label>
              <Select value={form.toUserId} onValueChange={(v) => setForm((f) => ({ ...f, toUserId: v ?? f.toUserId }))}>
                <SelectTrigger>
                  <SelectValue>
                    {others.find((m) => m.userId === form.toUserId)?.user.name ?? "Select member…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {others.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Label>Note (optional)</Label>
              <Input
                placeholder="Bank transfer, cash, etc."
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? "Saving…" : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
