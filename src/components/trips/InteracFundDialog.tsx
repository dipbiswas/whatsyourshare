"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, Check, Smartphone, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/balance"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  amount: number
  currency: string
  tripId: string
  tripName: string
  organizerName: string
  organizerEmail: string
  onConfirmed: () => void
}

export function InteracFundDialog({
  open,
  onOpenChange,
  amount,
  currency,
  tripId,
  tripName,
  organizerName,
  organizerEmail,
  onConfirmed,
}: Props) {
  const [copiedAmount, setCopiedAmount] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const copy = async (text: string, which: "amount" | "email") => {
    await navigator.clipboard.writeText(text)
    if (which === "amount") { setCopiedAmount(true); setTimeout(() => setCopiedAmount(false), 2000) }
    else { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000) }
  }

  const handleSent = async () => {
    setConfirming(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/fund/interac`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Failed to record payment")
        return
      }
      toast.success("Payment recorded!")
      onConfirmed()
      onOpenChange(false)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-red-600" />
            Pay via Interac e-Transfer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-gray-600">
            Open your banking app and send an Interac e-Transfer with these details:
          </p>

          {/* Amount */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Amount</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(amount, currency)}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => copy(amount.toFixed(2), "amount")}
            >
              {copiedAmount ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              Copy
            </Button>
          </div>

          {/* Recipient */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <div className="min-w-0 mr-3">
              <p className="text-xs text-gray-500 mb-0.5">Send to</p>
              <p className="text-sm font-semibold text-gray-900">{organizerName}</p>
              <p className="text-xs text-gray-500 truncate">{organizerEmail}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 shrink-0"
              onClick={() => copy(organizerEmail, "email")}
            >
              {copiedEmail ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              Copy
            </Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Memo: <span className="font-medium">WhatsYourShare — {tripName} fund</span>
          </p>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSent}
              disabled={confirming}
            >
              {confirming ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Recording…</> : "I've sent it ✓"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
