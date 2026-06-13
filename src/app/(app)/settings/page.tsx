"use client"

import { useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Camera, Check, CreditCard, Link2, Loader2, Zap, Crown, DollarSign, Shield, User, Lock, KeyRound, Bell, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

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

  // Account management state
  const [profileForm, setProfileForm] = useState({ name: "", email: "", phone: "", defaultCurrency: "USD", timezone: "" })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (session?.user && !profileReady) {
      // Fetch full profile (includes phone, defaultCurrency, timezone, avatar)
      fetch("/api/account")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          setProfileForm({
            name: data?.name ?? session.user?.name ?? "",
            email: data?.email ?? session.user?.email ?? "",
            phone: data?.phone ?? "",
            defaultCurrency: data?.defaultCurrency ?? "USD",
            timezone: data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
          })
          if (data?.avatar) setAvatar(data.avatar)
          setProfileReady(true)
        })
    }
  }, [session, profileReady])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return }

    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = async () => {
      URL.revokeObjectURL(url)
      // Resize to 256×256 on canvas
      const size = 256
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")!
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
      setUploadingAvatar(true)
      try {
        const res = await fetch("/api/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: dataUrl }),
        })
        if (!res.ok) { toast.error("Failed to save avatar"); return }
        setAvatar(dataUrl)
        toast.success("Avatar updated")
      } catch {
        toast.error("Failed to save avatar")
      } finally {
        setUploadingAvatar(false)
      }
    }
    img.src = url
  }

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      toast.error("Name and email are required")
      return
    }
    setSavingProfile(true)
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.name.trim(),
          email: profileForm.email.trim(),
          phone: profileForm.phone.trim() || null,
          defaultCurrency: profileForm.defaultCurrency,
          timezone: profileForm.timezone,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to update profile"); return }
      toast.success("Profile updated")
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error("Please fill in all password fields")
      return
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters")
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords don't match")
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to change password"); return }
      toast.success("Password changed successfully")
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch {
      toast.error("Failed to change password")
    } finally {
      setSavingPassword(false)
    }
  }

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
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative group shrink-0 focus:outline-none"
              title="Change avatar"
            >
              <Avatar className="h-16 w-16 ring-4 ring-white/20 shadow-md">
                {avatar && <AvatarImage src={avatar} alt="Avatar" className="object-cover" />}
                <AvatarFallback className="text-2xl font-bold bg-white text-violet-600">
                  {session?.user.name?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingAvatar
                  ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                  : <Camera className="h-5 w-5 text-white" />
                }
              </div>
            </button>
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

      {/* Notifications */}
      <NotificationsSection />

      {/* Account Management */}
      <div className="glass rounded-2xl overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 p-5 pb-4">
          <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Account</p>
            <p className="text-xs text-muted-foreground">Update your name, email, phone, currency, and timezone</p>
          </div>
        </div>

        {/* Profile fields */}
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="account-name" className="text-sm">Display name</Label>
              <Input
                id="account-name"
                value={profileForm.name}
                onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-email" className="text-sm">Email address</Label>
              <Input
                id="account-email"
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-phone" className="text-sm">Phone number <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="account-phone"
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-currency" className="text-sm">Default currency</Label>
              <select
                id="account-currency"
                value={profileForm.defaultCurrency}
                onChange={(e) => setProfileForm((f) => ({ ...f, defaultCurrency: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {["USD","EUR","GBP","INR","CAD","AUD","JPY","SGD","AED","CHF"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-timezone" className="text-sm">Timezone</Label>
            <select
              id="account-timezone"
              value={profileForm.timezone}
              onChange={(e) => setProfileForm((f) => ({ ...f, timezone: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {Intl.supportedValuesOf("timeZone").map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Used for dashboard greeting and time-based features</p>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save profile
            </Button>
          </div>

          <Separator className="opacity-50" />

          {/* Password change */}
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Change password</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="current-password" className="text-sm">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repeat new password"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                }
                Update password
              </Button>
            </div>
          </div>
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

      {/* Danger Zone */}
      <DangerZone />

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

// ── Danger Zone ───────────────────────────────────────────────────────────────

function DangerZone() {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch("/api/account", { method: "DELETE" })
      if (!res.ok) { toast.error("Failed to delete account"); return }
      // Sign out and redirect to home
      window.location.href = "/api/auth/signout"
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="glass rounded-2xl border border-red-200 dark:border-red-500/25 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-500/15 flex items-center justify-center shrink-0">
          <Trash2 className="h-5 w-5 text-red-500 dark:text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-red-500 dark:text-red-400">Danger Zone</p>
          <p className="text-xs text-muted-foreground">Irreversible actions</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-red-50 dark:bg-red-500/10 rounded-xl p-4">
        <div>
          <p className="text-sm font-medium text-foreground/80">Delete account</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently deletes your account, expenses, and all data. This cannot be undone.
          </p>
        </div>
        {!confirming ? (
          <Button variant="destructive" size="sm" className="shrink-0" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Are you sure?</p>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Yes, delete"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Notification preference types ────────────────────────────────────────────

interface NotifPrefs {
  addedToGroup: boolean
  expenseAdded: boolean
  expenseEdited: boolean
  recurringDue: boolean
  settledWithMe: boolean
  monthlySummary: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  addedToGroup: true,
  expenseAdded: true,
  expenseEdited: false,
  recurringDue: true,
  settledWithMe: true,
  monthlySummary: true,
}


const NOTIF_GROUPS: { label: string; items: { key: keyof NotifPrefs; label: string; desc: string }[] }[] = [
  {
    label: "Groups",
    items: [
      { key: "addedToGroup", label: "Added to a group", desc: "When someone invites you to a new group" },
    ],
  },
  {
    label: "Expenses",
    items: [
      { key: "expenseAdded",  label: "New expense",          desc: "When a member logs an expense in your group" },
      { key: "expenseEdited", label: "Expense edited/deleted", desc: "When an existing expense is changed or removed" },
      { key: "recurringDue",  label: "Recurring expense due", desc: "Reminder when a scheduled expense is about to run" },
    ],
  },
  {
    label: "Settlements",
    items: [
      { key: "settledWithMe", label: "Someone pays you", desc: "When a group member records a payment to you" },
    ],
  },
  {
    label: "Summaries",
    items: [
      { key: "monthlySummary", label: "Monthly spending summary", desc: "A digest of your activity across all groups" },
    ],
  },
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
        on ? "bg-violet-600" : "bg-muted-foreground/25"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
        on ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

function NotificationsSection() {
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown")
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (typeof Notification === "undefined") return
    setPermission(Notification.permission)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => { if (sub) setSubscribed(true) })
        .catch(() => {})
    }
    // Load prefs from server
    fetch("/api/account")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.notificationPrefs) {
          setPrefs({ ...DEFAULT_PREFS, ...data.notificationPrefs })
        }
      })
      .catch(() => {})
  }, [])

  async function enableNotifications() {
    setSubscribing(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") { toast.error("Notification permission denied"); return }

      const reg = await navigator.serviceWorker.register("/sw.js")
      const vapidRes = await fetch("/api/push/vapid-key")
      const { publicKey } = await vapidRes.json()

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      })

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })

      setSubscribed(true)
      toast.success("Push notifications enabled!")
    } catch {
      toast.error("Failed to enable notifications")
    } finally {
      setSubscribing(false)
    }
  }

  function setPref(key: keyof NotifPrefs, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  async function savePrefs() {
    setSaving(true)
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPrefs: prefs }),
      })
      if (!res.ok) { toast.error("Failed to save preferences"); return }
      setSaved(true)
      toast.success("Notification preferences saved")
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  if (permission === "unknown") return null

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 pb-4">
        <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-sm">Notifications</h2>
          <p className="text-xs text-muted-foreground">Choose what you want to be notified about</p>
        </div>
      </div>

      {/* Push enable banner (if not yet subscribed) */}
      {permission !== "denied" && !subscribed && (
        <div className="mx-5 mb-4 flex items-center justify-between gap-3 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 px-4 py-3">
          <p className="text-xs text-violet-700 dark:text-violet-300">
            Enable push notifications to receive alerts in your browser.
          </p>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 shrink-0 gap-1.5" onClick={enableNotifications} disabled={subscribing}>
            {subscribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
            Enable push
          </Button>
        </div>
      )}
      {permission === "denied" && (
        <div className="mx-5 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-4 py-3">
          <p className="text-xs text-rose-600 dark:text-rose-400">Push notifications are blocked in your browser settings. You can still save preferences for when they're enabled.</p>
        </div>
      )}
      {subscribed && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-2.5">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Push notifications are enabled</p>
        </div>
      )}

      {/* Preference groups */}
      <div className="px-5 pb-5 space-y-5">
        {NOTIF_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <Separator className="opacity-40 mb-5" />}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">{group.label}</p>
            <div className="space-y-3">
              {group.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle on={prefs[item.key]} onChange={(v) => setPref(item.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 gap-1.5"
            onClick={savePrefs}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
            {saving ? "Saving…" : saved ? "Saved" : "Save preferences"}
          </Button>
        </div>
      </div>
    </div>
  )
}
