"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Check, CreditCard, Link2, Loader2, Zap, Crown } from "lucide-react"

interface BillingStatus {
  plan: "FREE" | "PRO" | "FAMILY"
  isActive: boolean
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
}

interface ConnectStatus {
  connected: boolean
  onboarded: boolean
  accountId?: string
}

const PLANS = [
  {
    key: "FREE",
    label: "Free",
    price: "$0",
    desc: "Personal use, up to 5 groups",
    features: ["Up to 5 groups", "Basic expense splitting", "Manual settlements"],
    cta: null,
  },
  {
    key: "PRO",
    label: "Pro",
    price: "$3.99/mo",
    desc: "For power users — unlimited everything",
    features: [
      "Unlimited groups",
      "AI receipt scanning",
      "AI spending insights",
      "Recurring expenses",
      "Budget tracking",
      "Stripe instant settlements",
    ],
    cta: "Upgrade to Pro",
  },
  {
    key: "FAMILY",
    label: "Family",
    price: "$7.99/mo",
    desc: "For families — up to 6 members",
    features: [
      "Everything in Pro",
      "Up to 6 members on one plan",
      "Family trip funds",
      "Priority support",
    ],
    cta: "Upgrade to Family",
  },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [connect, setConnect] = useState<ConnectStatus | null>(null)
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [loadingConnect, setLoadingConnect] = useState(false)

  useEffect(() => {
    fetch("/api/billing/status").then((r) => r.ok ? r.json() : null).then(setBilling)
    fetch("/api/connect/status").then((r) => r.ok ? r.json() : null).then(setConnect)
  }, [])

  const handleUpgrade = async (plan: string) => {
    setLoadingCheckout(plan)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error ?? "Failed to start checkout")
    } catch {
      toast.error("Failed to start checkout")
    } finally {
      setLoadingCheckout(null)
    }
  }

  const handlePortal = async () => {
    setLoadingPortal(true)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error ?? "Failed to open billing portal")
    } catch {
      toast.error("Failed to open billing portal")
    } finally {
      setLoadingPortal(false)
    }
  }

  const handleConnect = async () => {
    setLoadingConnect(true)
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error ?? "Failed to start onboarding")
    } catch {
      toast.error("Failed to start onboarding")
    } finally {
      setLoadingConnect(false)
    }
  }

  const currentPlan = billing?.plan ?? "FREE"

  const planBadgeColor: Record<string, string> = {
    FREE: "bg-gray-100 text-gray-700",
    PRO: "bg-violet-100 text-violet-700",
    FAMILY: "bg-amber-100 text-amber-700",
  }

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account preferences and billing</p>
      </div>

      {/* Profile */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-violet-100 text-violet-700 text-xl font-bold">
                {session?.user.name?.charAt(0).toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold text-gray-900">{session?.user.name}</p>
              <p className="text-sm text-gray-500">{session?.user.email}</p>
              <Badge className={`mt-1 text-xs border-0 ${planBadgeColor[currentPlan]}`}>
                {currentPlan === "PRO" && <Crown className="h-2.5 w-2.5 mr-1" />}
                {currentPlan} plan
              </Badge>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Account ID</span>
              <span className="font-mono text-xs text-gray-400">{session?.user.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Connect */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-violet-600" />
            <CardTitle className="text-base">Payment Account</CardTitle>
          </div>
          <CardDescription>
            Connect your bank account to send and receive settlements via Stripe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connect === null ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : connect.onboarded ? (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Stripe account connected</p>
                <p className="text-xs text-gray-500">You can send and receive instant settlements</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {connect.connected
                  ? "Your Stripe account is connected but not fully verified. Complete onboarding to enable settlements."
                  : "Connect your bank account to settle debts instantly with other members."}
              </p>
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={loadingConnect}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {loadingConnect ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
                {connect.connected ? "Complete Verification" : "Connect with Stripe"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing / Pricing */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-violet-600" />
              <CardTitle className="text-base">Plan & Billing</CardTitle>
            </div>
            {billing?.subscriptionStatus && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePortal}
                disabled={loadingPortal}
              >
                {loadingPortal ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Manage Billing
              </Button>
            )}
          </div>
          <CardDescription>
            Upgrade to unlock AI features, unlimited groups, and instant settlements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.key
              return (
                <div
                  key={plan.key}
                  className={`relative rounded-xl border-2 p-4 ${
                    isCurrent ? "border-violet-500 bg-violet-50" : "border-gray-200 bg-white"
                  }`}
                >
                  {isCurrent && (
                    <Badge className="absolute -top-2.5 left-3 text-xs bg-violet-600 border-0">
                      Current Plan
                    </Badge>
                  )}
                  <div className="mb-3">
                    <p className="font-semibold text-gray-900">{plan.label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{plan.price}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{plan.desc}</p>
                  </div>
                  <ul className="space-y-1.5 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <Check className="h-3 w-3 text-violet-600 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.cta && !isCurrent && (
                    <Button
                      size="sm"
                      className="w-full bg-violet-600 hover:bg-violet-700 text-xs"
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={loadingCheckout === plan.key}
                    >
                      {loadingCheckout === plan.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 mr-1" />
                      )}
                      {plan.cta}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          {billing?.currentPeriodEnd && (
            <p className="mt-4 text-xs text-gray-400">
              Current period ends {new Date(billing.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-500 space-y-1">
          <p>WhatsYourShare v1.0.0</p>
          <p>Enterprise expense splitting — built with Next.js, Prisma & shadcn/ui</p>
        </CardContent>
      </Card>
    </div>
  )
}
