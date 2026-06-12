"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { CreditCard, Zap, Lock, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/balance"

interface CardTransaction {
  id: string
  merchantName: string
  merchantCategory: string
  amount: number
  currency: string
  approved: boolean
  createdAt: string
}

interface GroupCardData {
  id: string
  stripeCardId: string
  status: string
  spendLimit: number
  spendLimitInterval: string
  currency: string
  last4: string | null
  expMonth: number | null
  expYear: number | null
  transactions: CardTransaction[]
}

interface Props {
  groupId: string
  isAdmin: boolean
}

export function GroupCardCard({ groupId, isAdmin }: Props) {
  const [cardData, setCardData] = useState<GroupCardData | null | undefined>(undefined)
  const [showIssue, setShowIssue] = useState(false)
  const [spendLimit, setSpendLimit] = useState("500")
  const [interval, setInterval] = useState<"daily" | "weekly" | "monthly">("monthly")
  const [issuing, setIssuing] = useState(false)
  const [showTxns, setShowTxns] = useState(false)

  useEffect(() => {
    fetch(`/api/cards/${groupId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCardData)
  }, [groupId])

  const issueCard = async () => {
    setIssuing(true)
    try {
      const res = await fetch(`/api/cards/${groupId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spendLimit: Number(spendLimit), spendLimitInterval: interval }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      const data: GroupCardData = await res.json()
      setCardData(data)
      setShowIssue(false)
      toast.success("Virtual card issued!")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setIssuing(false)
    }
  }

  if (cardData === undefined) {
    return (
      <Card className="border-0 shadow-sm animate-pulse">
        <CardHeader><div className="h-4 w-32 bg-gray-200 rounded" /></CardHeader>
        <CardContent><div className="h-24 bg-gray-100 rounded" /></CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-violet-600" />
            <CardTitle className="text-base">Group Virtual Card</CardTitle>
          </div>
          {cardData && (
            <Badge variant={cardData.status === "ACTIVE" ? "default" : "secondary"}
              className={cardData.status === "ACTIVE" ? "bg-green-600" : ""}>
              {cardData.status}
            </Badge>
          )}
        </div>
        <CardDescription>
          A shared Stripe Issuing virtual card. Swipes auto-create group expenses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!cardData ? (
          <div className="space-y-4">
            {!showIssue ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-violet-400" />
                </div>
                <p className="text-sm text-gray-500">No virtual card issued yet for this group.</p>
                {isAdmin && (
                  <Button size="sm" onClick={() => setShowIssue(true)} className="bg-violet-600 hover:bg-violet-700">
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    Issue Group Card
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Monthly spend limit ($)</Label>
                    <Input type="number" min={1} value={spendLimit} onChange={(e) => setSpendLimit(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Interval</Label>
                    <select
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                      value={interval}
                      onChange={(e) => setInterval(e.target.value as "daily" | "weekly" | "monthly")}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={issueCard} disabled={issuing} className="bg-violet-600 hover:bg-violet-700">
                    {issuing ? "Issuing…" : "Confirm & Issue"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowIssue(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Virtual card visual */}
            <div className="relative rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 p-5 text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-xs text-violet-200">Group Virtual Card</p>
                  <p className="text-sm font-medium mt-0.5">WhatsYourShare</p>
                </div>
                <CreditCard className="h-6 w-6 text-violet-200" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-3 w-3 text-violet-300" />
                <p className="font-mono text-sm tracking-widest">
                  •••• •••• •••• {cardData.last4 ?? "••••"}
                </p>
              </div>
              <div className="flex justify-between text-xs text-violet-200">
                <span>
                  {cardData.expMonth && cardData.expYear
                    ? `${String(cardData.expMonth).padStart(2, "0")}/${String(cardData.expYear).slice(-2)}`
                    : "MM/YY"}
                </span>
                <span>
                  Limit: {formatCurrency(cardData.spendLimit, cardData.currency)}/{cardData.spendLimitInterval.toLowerCase()}
                </span>
              </div>
            </div>

            {/* Transactions */}
            {cardData.transactions.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-700 w-full text-left py-1"
                  onClick={() => setShowTxns(!showTxns)}
                >
                  {showTxns ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Recent transactions ({cardData.transactions.length})
                </button>
                {showTxns && (
                  <div className="mt-2 space-y-1">
                    <Separator />
                    {cardData.transactions.map((txn) => (
                      <div key={txn.id} className="flex justify-between items-center py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-800">{txn.merchantName}</p>
                          <p className="text-xs text-gray-400">{txn.merchantCategory}</p>
                        </div>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(txn.amount, txn.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
