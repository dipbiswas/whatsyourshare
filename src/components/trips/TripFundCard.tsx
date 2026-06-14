"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Wallet, Check, Loader2, ExternalLink, Smartphone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InteracFundDialog } from "@/components/trips/InteracFundDialog"
import { formatCurrency } from "@/lib/balance"
import { useConfig } from "@/lib/useConfig"

interface Contribution {
  id: string
  amount: number
  status: "PENDING" | "PAID" | "REFUNDED"
  paidAt: string | null
  user: { id: string; name: string; avatar: string | null }
}

interface Fund {
  id: string
  targetAmount: number
  currency: string
  status: "COLLECTING" | "CLOSED" | "DISBURSED"
  description: string | null
  contributions: Contribution[]
}

interface Props {
  tripId: string
  tripName: string
  eventType?: string
  fund: Fund | null
  currentUserId: string
  isOrganizer: boolean
  memberCount: number
  currency: string
  organizerName: string
  organizerEmail: string
}

const EVENT_LABEL: Record<string, string> = {
  TRIP: "trip", CELEBRATION: "event", DINING: "event",
  EVENT: "event", PROJECT: "project", OTHER: "event",
}

export function TripFundCard({
  tripId,
  tripName,
  eventType = "TRIP",
  fund: initialFund,
  currentUserId,
  isOrganizer,
  memberCount,
  currency,
  organizerName,
  organizerEmail,
}: Props) {
  const label = EVENT_LABEL[eventType] ?? "event"
  const isCAD = currency.toUpperCase() === "CAD"
  const { stripeEnabled } = useConfig()

  const [fund, setFund] = useState<Fund | null>(initialFund)
  const [setupOpen, setSetupOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [interacOpen, setInteracOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [setupForm, setSetupForm] = useState({
    targetAmount: fund ? String(fund.targetAmount) : "",
    description: fund?.description ?? "",
  })
  const [contributeAmount, setContributeAmount] = useState(
    fund ? String(Math.ceil(fund.targetAmount / memberCount)) : ""
  )

  const paidContributions = fund?.contributions.filter((c) => c.status === "PAID") ?? []
  const totalCollected = paidContributions.reduce((s, c) => s + c.amount, 0)
  const myContribution = fund?.contributions.find((c) => c.user.id === currentUserId)
  const iHavePaid = myContribution?.status === "PAID"

  async function refreshFund() {
    const updated = await fetch(`/api/trips/${tripId}/fund`).then((r) => r.json())
    setFund(updated)
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(setupForm.targetAmount)
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/fund`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAmount: amt,
          currency,
          description: setupForm.description || undefined,
        }),
      })
      if (!res.ok) { toast.error("Failed to set up fund"); return }
      await refreshFund()
      setSetupOpen(false)
      toast.success("Fund set up!")
    } finally {
      setLoading(false)
    }
  }

  async function handleStripeContribute(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(contributeAmount)
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, amount: amt }),
      })
      if (!res.ok) {
        const text = await res.text()
        let message = "Payment failed"
        try { message = JSON.parse(text).error ?? message } catch { /* non-JSON */ }
        console.error("[Stripe checkout]", message)
        toast.error(message, { duration: 8000 })
        return
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  if (!fund) {
    if (!isOrganizer) return null
    return (
      <>
        <Card className="border-0 shadow-sm border-dashed border-2 border-gray-200">
          <CardContent className="py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">No {label} fund yet</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Collect contributions from the group before the {label}
              </p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => setSetupOpen(true)}>
              <Wallet className="h-4 w-4" /> Set up fund
            </Button>
          </CardContent>
        </Card>

        <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Set up {label} fund</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSetup} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Target amount ({currency})</Label>
                <Input
                  type="number" min="1" step="0.01" placeholder="2500.00"
                  value={setupForm.targetAmount}
                  onChange={(e) => setSetupForm((f) => ({ ...f, targetAmount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>What&apos;s this for? (optional)</Label>
                <Input
                  placeholder="Airbnb deposit, group transport…"
                  value={setupForm.description}
                  onChange={(e) => setSetupForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              {(stripeEnabled || isCAD) && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-700">
                  <p className="font-medium mb-1">💳 How payments work</p>
                  <p>
                    Members can pay via{stripeEnabled ? " Stripe" : ""}
                    {stripeEnabled && isCAD ? " or" : ""}
                    {isCAD ? " Interac e-Transfer" : ""}.
                    {stripeEnabled && !isCAD && " A 1.5% platform fee applies to Stripe payments."}
                    {stripeEnabled && isCAD && " Stripe charges a 1.5% platform fee; Interac is free."}
                    {!stripeEnabled && isCAD && " Interac is free."}
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setSetupOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                  {loading ? "Saving…" : "Set up fund"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  const pct = Math.min((totalCollected / fund.targetAmount) * 100, 100)

  return (
    <>
      <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Fund
            <Badge
              variant="outline"
              className={`text-xs ml-1 ${
                fund.status === "COLLECTING"
                  ? "border-emerald-300 text-emerald-700"
                  : "border-gray-300 text-gray-500"
              }`}
            >
              {fund.status === "COLLECTING" ? "Collecting" : fund.status === "CLOSED" ? "Closed" : "Disbursed"}
            </Badge>
          </CardTitle>
          {isOrganizer && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => setSetupOpen(true)}>
              Edit
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {fund.description && (
            <p className="text-xs text-emerald-700">{fund.description}</p>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(totalCollected, fund.currency)}
              </span>
              <span className="text-sm text-gray-500">
                of {formatCurrency(fund.targetAmount, fund.currency)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {paidContributions.length} of {memberCount} members contributed
            </p>
          </div>

          {/* Contributors */}
          <div className="flex flex-wrap gap-2">
            {fund.contributions.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  c.status === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[8px]">{c.user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                {c.user.name.split(" ")[0]}
                {c.status === "PAID" && <Check className="h-3 w-3" />}
                {c.status === "PAID" && (
                  <span className="text-emerald-600">{formatCurrency(c.amount, fund.currency)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Contribute CTAs */}
          {fund.status === "COLLECTING" && !iHavePaid && (
            <div className={`grid gap-2 ${stripeEnabled && isCAD ? "grid-cols-2" : stripeEnabled || isCAD ? "grid-cols-1" : "hidden"}`}>
              {stripeEnabled && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                  onClick={() => setContributeOpen(true)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Pay via Stripe
                </Button>
              )}
              {isCAD && (
                <Button
                  variant="outline"
                  className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 gap-2"
                  onClick={() => setInteracOpen(true)}
                >
                  <Smartphone className="h-4 w-4" />
                  Pay via Interac
                </Button>
              )}
            </div>
          )}
          {iHavePaid && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
              <Check className="h-4 w-4" />
              You&apos;ve contributed {formatCurrency(myContribution!.amount, fund.currency)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stripe contribute dialog */}
      {stripeEnabled && <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Contribute to {tripName} fund</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStripeContribute} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Amount ({fund.currency})</Label>
              <Input
                type="number" min="1" step="0.01"
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
                required
              />
              <p className="text-xs text-gray-400">
                Suggested: {formatCurrency(fund.targetAmount / memberCount, fund.currency)} per person
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 text-xs text-gray-500 space-y-1">
              <p>You&apos;ll be redirected to Stripe&apos;s secure checkout. A 1.5% platform fee is included.</p>
              <p className="font-medium text-gray-700">
                Total charged: {formatCurrency(parseFloat(contributeAmount || "0") * 1.015, fund.currency)}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setContributeOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Redirecting…</> : "Pay with Stripe →"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>}

      {/* Interac contribute dialog (CAD only) */}
      {isCAD && (
        <InteracFundDialog
          open={interacOpen}
          onOpenChange={setInteracOpen}
          amount={parseFloat(contributeAmount) || fund.targetAmount / memberCount}
          currency={fund.currency}
          tripId={tripId}
          tripName={tripName}
          organizerName={organizerName}
          organizerEmail={organizerEmail}
          onConfirmed={() => refreshFund()}
        />
      )}

      {/* Edit fund dialog */}
      {isOrganizer && (
        <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit {label} fund</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSetup} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Target amount ({currency})</Label>
                <Input
                  type="number" min="1" step="0.01"
                  value={setupForm.targetAmount}
                  onChange={(e) => setSetupForm((f) => ({ ...f, targetAmount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  placeholder="Airbnb deposit, group transport…"
                  value={setupForm.description}
                  onChange={(e) => setSetupForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setSetupOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                  {loading ? "Saving…" : "Update fund"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
