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
import { useConfig } from "@/lib/useConfig"

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
  defaultPaymentMethod?: "MANUAL" | "STRIPE_ACH" | "STRIPE_INSTANT"
  onCreated: () => void
  compact?: boolean
  trigger?: React.ReactNode
}

export function AddSettlementDialog({
  groupId,
  currency,
  members,
  currentUserId,
  suggestedTo,
  suggestedAmount,
  defaultPaymentMethod = "MANUAL",
  onCreated,
  compact,
  trigger,
}: Props) {
  const { stripeEnabled } = useConfig()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"MANUAL" | "STRIPE_ACH" | "STRIPE_INSTANT">(defaultPaymentMethod)
  const [form, setForm] = useState({
    fromUserId: currentUserId,
    toUserId: suggestedTo ?? "",
    amount: suggestedAmount?.toFixed(2) ?? "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  })

  // When "paying from" changes, reset "paying to" so they can't be the same
  function setFromUser(id: string | null) {
    if (!id) return
    setForm((f) => ({ ...f, fromUserId: id, toUserId: f.toUserId === id ? "" : f.toUserId }))
  }

  const payingToOptions = members.filter((m) => m.userId !== form.fromUserId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!form.toUserId) {
      toast.error("Select who is being paid")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, fromUserId: form.fromUserId, toUserId: form.toUserId, amount, note: form.note, date: form.date, paymentMethod }),
      })
      if (!res.ok) {
        toast.error("Failed to record settlement")
        return
      }
      toast.success("Settlement recorded!")
      onCreated()
      setOpen(false)
      setForm({ fromUserId: currentUserId, toUserId: "", amount: "", note: "", date: new Date().toISOString().split("T")[0] })
      setPaymentMethod(defaultPaymentMethod)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className={compact
            ? "h-7 text-xs px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            : "gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          }
          onClick={() => setOpen(true)}
        >
          {compact ? "Settle Up" : <><CheckCircle className="h-4 w-4" />Settle Up</>}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Up</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Paying from</Label>
              <Select value={form.fromUserId} onValueChange={setFromUser}>
                <SelectTrigger>
                  <SelectValue>
                    {members.find((m) => m.userId === form.fromUserId)?.user.name ?? "Select member…"}
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
            </div>
            <div className="space-y-1.5">
              <Label>Paying to</Label>
              <Select value={form.toUserId} onValueChange={(v) => setForm((f) => ({ ...f, toUserId: v ?? f.toUserId }))}>
                <SelectTrigger>
                  <SelectValue>
                    {payingToOptions.find((m) => m.userId === form.toUserId)?.user.name ?? "Select member…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {payingToOptions.map((m) => (
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
            {stripeEnabled && (
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Cash / Interac / Bank transfer</SelectItem>
                    <SelectItem value="STRIPE_ACH">Stripe — Standard (1–3 business days)</SelectItem>
                    <SelectItem value="STRIPE_INSTANT">Stripe — Instant (arrives in minutes)</SelectItem>
                  </SelectContent>
                </Select>
                {paymentMethod !== "MANUAL" && (
                  <p className="text-xs text-muted-foreground">
                    Both you and the recipient need a connected Stripe account in Settings.
                    {paymentMethod === "STRIPE_INSTANT" && " An additional $0.10 instant transfer fee applies."}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
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
                {loading ? "Saving…" : "Settle Up"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
