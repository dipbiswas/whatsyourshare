"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, CreditCard, Link2, Loader2, Zap, Crown, DollarSign, Shield } from "lucide-react"

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
    period: "forever",
    desc: "For personal use",
    features: ["Up to 5 groups", "Basic expense splitting", "Manual settlements"],
    cta: null,
    accent: "border-gray-200",
    highlight: false,
  },
  {
    key: "PRO",
    label: "Pro",
    price: "$3.99",
    period: "/mo",
    desc: "For power users",
    features: [
      "Unlimited groups",
      "AI receipt scanning",
      "AI spending insights",
      "Recurring expenses",
      "Budget tracking",
      "Stripe settlements",
    ],
    cta: "Upgrade to Pro",
    accent: "border-violet-500",
    highlight: true,
  },
  {
    key: "FAMILY",
    label: "Family",
    price: "$7.99",
    period: "/mo",
    desc: "For families",
    features: [
      "Everything in Pro",
      "Up to 6 members",
      "Family trip funds",
      "Priority support",
    ],
    cta: "Upgrade to Family",
    accent: "border-amber-400",
    highlight: false,
  },
]

const PLAN_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  FREE: { bg: "bg-gray-100 dark:bg-white/10", text: "text-foreground", badge: "bg-gray-100 dark:bg-white/15 text-foreground" },
  PRO: { bg: "bg-violet-600/80 dark:bg-violet-600/60", text: "text-white", badge: "bg-violet-100 dark:bg-violet-500/30 text-violet-700 dark:text-violet-300" },
  FAMILY: { bg: "bg-amber-500/80 dark:bg-amber-500/60", text: "text-white", badge: "bg-amber-100 dark:bg-amber-500/30 text-amber-700 dark:text-amber-300" },
}

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
  const planColor = PLAN_COLORS[currentPlan]

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and subscription</p>
      </div>

      {/* Profile card */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Gradient header */}
        <div className={`h-16 ${planColor.bg}`} />
        <div className="px-5 pb-5">
          {/* Avatar overlapping the gradient */}
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <Avatar className="h-16 w-16 ring-4 ring-white/20 shadow-md shrink-0">
              <AvatarFallback className="text-2xl font-bold bg-white text-violet-600">
                {session?.user.name?.charAt(0).toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="pb-1">
              <Badge className={`text-xs border-0 ${planColor.badge}`}>
                {currentPlan === "PRO" && <Crown className="h-2.5 w-2.5 mr-1" />}
                {currentPlan} plan
              </Badge>
            </div>
          </div>
          <p className="text-lg font-bold text-foreground">{session?.user.name}</p>
          <p className="text-sm text-muted-foreground">{session?.user.email}</p>
          <p className="text-xs text-muted-foreground/50 font-mono mt-1">{session?.user.id}</p>
        </div>
      </div>

      {/* Payment Account (Stripe Connect) */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
            <Link2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Payment Account</p>
            <p className="text-xs text-muted-foreground">Send & receive settlements via Stripe</p>
          </div>
        </div>

        {connect === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : connect.onboarded ? (
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/15 rounded-xl px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Stripe account connected</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">You can send and receive instant settlements</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-muted rounded-xl px-4 py-3">
              <p className="text-sm text-foreground/70">
                {connect.connected
                  ? "Your account is connected but not fully verified. Complete onboarding to enable settlements."
                  : "Connect your bank account to settle debts instantly."}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={loadingConnect}
              className="bg-violet-600 hover:bg-violet-700 gap-1.5"
            >
              {loadingConnect ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {connect.connected ? "Complete Verification" : "Connect with Stripe"}
            </Button>
          </div>
        )}
      </div>

      {/* Plan & Billing */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Plan & Billing</p>
              <p className="text-xs text-muted-foreground">Unlock AI features and unlimited groups</p>
            </div>
          </div>
          {billing?.subscriptionStatus && (
            <Button size="sm" variant="outline" onClick={handlePortal} disabled={loadingPortal} className="shrink-0">
              {loadingPortal && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Manage
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.key
            return (
              <div
                key={plan.key}
                className={`relative rounded-xl border-2 p-4 transition-all ${
                  isCurrent
                    ? plan.key === "PRO"
                      ? "border-violet-500 bg-gradient-to-b from-violet-500/20 to-transparent"
                      : plan.key === "FAMILY"
                      ? "border-amber-400 bg-gradient-to-b from-amber-500/20 to-transparent"
                      : "border-border bg-muted"
                    : plan.highlight
                    ? "border-violet-500/30 hover:border-violet-400"
                    : "border-border hover:border-foreground/20"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      plan.key === "PRO" ? "bg-violet-600 text-white" :
                      plan.key === "FAMILY" ? "bg-amber-500 text-white" :
                      "bg-gray-500 text-white"
                    }`}>Current</span>
                  </div>
                )}
                {plan.highlight && !isCurrent && (
                  <div className="absolute -top-3 left-3">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">Popular</span>
                  </div>
                )}

                <div className="mb-3">
                  <p className="font-bold text-foreground">{plan.label}</p>
                  <div className="flex items-baseline gap-0.5 mt-0.5">
                    <p className="text-2xl font-extrabold text-foreground">{plan.price}</p>
                    <p className="text-xs text-muted-foreground">{plan.period}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
                </div>

                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-foreground/70">
                      <Check className={`h-3 w-3 mt-0.5 shrink-0 ${
                        plan.key === "PRO" ? "text-violet-500" :
                        plan.key === "FAMILY" ? "text-amber-500" :
                        "text-gray-400"
                      }`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.cta && !isCurrent && (
                  <Button
                    size="sm"
                    className={`w-full text-xs font-semibold ${
                      plan.key === "PRO"
                        ? "bg-violet-600 hover:bg-violet-700 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-white"
                    }`}
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
                {isCurrent && (
                  <div className={`w-full text-center text-xs font-medium py-1.5 rounded-lg ${
                    plan.key === "PRO" ? "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300" :
                    plan.key === "FAMILY" ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    Active plan
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {billing?.currentPeriodEnd && (
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Current period ends {new Date(billing.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Security / app info footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground/40 px-1">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          WhatsYourShare v1.0.0
        </div>
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5" />
          Built with Next.js · Prisma · Stripe
        </div>
      </div>
    </div>
  )
}
