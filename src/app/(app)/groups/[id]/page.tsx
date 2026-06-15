"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  ArrowLeft,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Plus,
  Users,
  Receipt,
  Printer,
  Pencil,
  X,
  MoreHorizontal,
  Repeat2,
  ArrowLeftRight,
  Sparkles,
  Settings,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog"
import { EditExpenseDialog } from "@/components/expenses/EditExpenseDialog"
import { AddSettlementDialog } from "@/components/settlements/AddSettlementDialog"
import { AddMemberDialog } from "@/components/groups/AddMemberDialog"
import { AddRecurringExpenseDialog } from "@/components/expenses/AddRecurringExpenseDialog"
import { BudgetProgressCard } from "@/components/budget/BudgetProgressCard"
import { CreateTripDialog } from "@/components/trips/CreateTripDialog"
import { Plane } from "lucide-react"
import { ExpensePolicyCard } from "@/components/groups/ExpensePolicyCard"
import { GroupCardCard } from "@/components/cards/GroupCardCard"
import { InsightsTab } from "@/components/groups/InsightsTab"
import { InteracHelperDialog } from "@/components/settlements/InteracHelperDialog"
import { formatCurrency } from "@/lib/balance"
import { cn } from "@/lib/utils"
import type { AnnotatedTransfer } from "@/lib/balance"
import { useConfig } from "@/lib/useConfig"

interface Member {
  userId: string
  role: string
  user: { id: string; name: string; email: string; avatar: string | null }
}

interface GuestMember {
  id: string
  name: string
  email: string | null
  linkedUserId: string | null
}

interface Split {
  userId: string | null
  guestMemberId: string | null
  amount: number
  user: { id: string; name: string } | null
  guest: { id: string; name: string } | null
}

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  category: string
  splitType: string
  date: string
  visibility: "GROUP" | "PAYERS_ONLY"
  approvalStatus: "NA" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  paidById: string
  paidBy: { id: string; name: string; avatar: string | null }
  createdBy?: { id: string; name: string } | null
  guestPayeeName?: string | null
  splits: Split[]
  trip?: { id: string; name: string } | null
}

interface RecurringExpense {
  id: string
  description: string
  lastAmount: number
  currency: string
  category: string
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY"
  nextDueDate: string
  createdBy: { id: string; name: string }
}

interface Settlement {
  id: string
  amount: number
  currency: string
  note: string | null
  createdAt: string
  fromUser: { id: string; name: string; avatar: string | null }
  toUser: { id: string; name: string; avatar: string | null }
  createdBy?: { id: string; name: string } | null
}

interface GroupDetail {
  id: string
  name: string
  description: string | null
  currency: string
  workspaceType: "PERSONAL" | "TEAM"
  defaultSplitType: string
  defaultSplitShares: Record<string, number> | null
  members: Member[]
  guests: GuestMember[]
  expenses: Expense[]
  settlements: Settlement[]
  recurringExpenses: RecurringExpense[]
  balanceMap: Record<string, number>
  suggestedSettlements: AnnotatedTransfer[]
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-orange-400",
  Transport: "bg-blue-400",
  Accommodation: "bg-purple-400",
  Entertainment: "bg-pink-400",
  Utilities: "bg-yellow-400",
  General: "bg-gray-400",
  Other: "bg-teal-400",
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDebts, setExpandedDebts] = useState<Set<number>>(new Set())
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set())
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [openDialog, setOpenDialog] = useState<"addMember" | "addRecurring" | "createTrip" | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [trips, setTrips] = useState<{ id: string; name: string; destination: string | null; coverEmoji: string | null; eventType: string; startDate: string; endDate: string; _count: { days: number } }[]>([])
  const [planStatus, setPlanStatus] = useState<{ plan: string; aiScansUsed: number; aiScansLimit: number } | null>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [activeGroupTab, setActiveGroupTab] = useState("expenses")

  const userId = session?.user.id ?? ""
  const { stripeEnabled } = useConfig()

  const refreshGroup = () =>
    fetch(`/api/groups/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text()
          throw new Error(`${r.status}: ${text}`)
        }
        return r.json()
      })
      .then(setGroup)
      .catch((err) => {
        console.error("Group fetch error:", err)
        toast.error("Error: " + (err?.message ?? "unknown"))
      })

  useEffect(() => {
    refreshGroup().finally(() => setLoading(false))
    fetch(`/api/trips?groupId=${id}`).then((r) => r.ok ? r.json() : []).then(setTrips)
    fetch("/api/plan-status").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setPlanStatus(d) })
  }, [id, router])

  async function approveExpense(expenseId: string, action: "APPROVE" | "REJECT") {
    setApprovingId(expenseId)
    try {
      const res = await fetch(`/api/expenses/${expenseId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setGroup((g) =>
        g ? { ...g, expenses: g.expenses.map((e) => e.id === expenseId ? { ...e, approvalStatus: updated.approvalStatus } : e) } : g
      )
      toast.success(action === "APPROVE" ? "Expense approved" : "Expense rejected")
    } catch {
      toast.error("Failed to update approval")
    } finally {
      setApprovingId(null)
    }
  }

  async function deleteExpense(expenseId: string) {
    const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" })
    if (res.ok) {
      setGroup((g) => g ? { ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) } : g)
      toast.success("Expense deleted")
    } else {
      toast.error("Failed to delete expense")
    }
  }

  async function deleteRecurring(recurringId: string) {
    if (!confirm("Delete this recurring expense? This will stop future auto-splits.")) return
    setDeletingId(recurringId)
    try {
      const res = await fetch(`/api/recurring-expenses/${recurringId}`, { method: "DELETE" })
      if (res.ok) {
        setGroup((g) => g ? { ...g, recurringExpenses: g.recurringExpenses.filter((r) => r.id !== recurringId) } : g)
        toast.success("Recurring expense deleted")
      } else {
        toast.error("Failed to delete")
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function deleteSettlement(settlementId: string) {
    if (!confirm("Delete this settlement? Balances will be recalculated.")) return
    setDeletingId(settlementId)
    try {
      const res = await fetch(`/api/settlements/${settlementId}`, { method: "DELETE" })
      if (res.ok) {
        setGroup((g) => g ? { ...g, settlements: g.settlements.filter((s) => s.id !== settlementId) } : g)
        refreshGroup()
        toast.success("Settlement deleted")
      } else {
        toast.error("Failed to delete")
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function deleteTrip(tripId: string, tripName: string) {
    if (!confirm(`Delete event "${tripName}"? All itinerary data will be removed.`)) return
    setDeletingId(tripId)
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" })
      if (res.ok) {
        setTrips((prev) => prev.filter((t) => t.id !== tripId))
        toast.success("Event deleted")
      } else {
        toast.error("Failed to delete event")
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-5 md:p-8 space-y-6 max-w-5xl mr-auto">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (!group) return null

  const isAdmin = group.members.find((m) => m.userId === userId)?.role === "ADMIN"
  const myBalance = group.balanceMap[userId] ?? 0
  const totalExpenses = group.expenses.reduce((s, e) => s + e.amount, 0)
  const mySettlements = group.suggestedSettlements.filter((s) => s.from === userId)

  return (
    <div className="p-4 md:p-6 max-w-6xl mr-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-2 min-w-0">
          <Link href="/groups">
            <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground leading-tight">{group.name}</h1>
              {group.workspaceType === "TEAM" && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-0 text-xs">Team</Badge>
              )}
              <Badge variant="outline" className="text-xs font-semibold">{group.currency}</Badge>
            </div>
            {group.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex -space-x-1.5">
                {group.members.slice(0, 6).map((m, i) => (
                  <Avatar key={m.userId} className="h-5 w-5 ring-2 ring-background" style={{ zIndex: 6 - i }}>
                    <AvatarFallback className="text-[8px] font-bold" style={{ background: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 70%, 85%)`, color: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 60%, 30%)` }}>
                      {m.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{group.members.length} members</span>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <a href={`/groups/${group.id}/print`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-accent transition-colors">
            <Printer className="h-3.5 w-3.5" />Print
          </a>
          {planStatus?.plan === "FREE" ? (
            <button
              onClick={() => toast.error("CSV export is a Pro feature. Upgrade to Pro to export expenses.")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-accent transition-colors"
            >
              <Download className="h-3.5 w-3.5" />Export
            </button>
          ) : (
            <a href={`/api/groups/${group.id}/export?format=csv`} download
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-accent transition-colors">
              <Download className="h-3.5 w-3.5" />Export
            </a>
          )}
        </div>
      </div>

      {/* Two-column layout: sidebar (left) + tabs (right) */}
      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-5 lg:items-start">

        {/* ── LEFT SIDEBAR ── */}
        <div className="space-y-3 mb-5 lg:mb-0 lg:sticky lg:top-6">

          {/* Your balance — prominent */}
          <div className={cn(
            "rounded-2xl p-4",
            myBalance > 0.01
              ? "bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20"
              : myBalance < -0.01
              ? "bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20"
              : "glass"
          )}>
            <p className={cn("text-xs font-medium mb-0.5",
              myBalance > 0.01 ? "text-emerald-600 dark:text-emerald-400"
              : myBalance < -0.01 ? "text-rose-500 dark:text-rose-400"
              : "text-muted-foreground"
            )}>
              {myBalance > 0.01 ? "Owed to you" : myBalance < -0.01 ? "You owe" : "You're all settled up"}
            </p>
            <p className={cn("text-2xl font-bold tabular-nums",
              myBalance > 0.01 ? "text-emerald-700 dark:text-emerald-300"
              : myBalance < -0.01 ? "text-rose-600 dark:text-rose-300"
              : "text-muted-foreground"
            )}>
              {formatCurrency(Math.abs(myBalance), group.currency)}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="glass rounded-xl p-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Total spent</p>
              <p className="text-base font-bold text-foreground tabular-nums leading-tight">{formatCurrency(totalExpenses, group.currency)}</p>
            </div>
            <div className="glass rounded-xl p-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Expenses</p>
              <p className="text-base font-bold text-foreground leading-tight">{group.expenses.length}</p>
            </div>
          </div>

          {/* You owe + Others owe — combined */}
          {group.suggestedSettlements.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden">
              {/* Your debts */}
              {mySettlements.length > 0 && (
                <div className="p-3 border-b border-border/60">
                  <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-2">You owe</p>
                  <div className="space-y-2">
                    {mySettlements.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{s.toName}</p>
                          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(s.amount, group.currency)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {group.currency.toUpperCase() === "CAD" && (
                            <InteracHelperDialog
                              amount={s.amount}
                              currency={group.currency}
                              toName={s.toName}
                              toEmail={group.members.find((m) => m.userId === s.to)?.user.email ?? ""}
                              groupName={group.name}
                              onSent={async () => {
                                await fetch("/api/settlements", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ groupId: group.id, toUserId: s.to, amount: s.amount, note: "Interac e-Transfer" }),
                                })
                                refreshGroup()
                              }}
                            />
                          )}
                          <AddSettlementDialog
                            groupId={group.id}
                            currency={group.currency}
                            members={group.members}
                            currentUserId={userId}
                            suggestedTo={s.to}
                            suggestedAmount={s.amount}
                            onCreated={() => refreshGroup()}
                            compact
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Others owe */}
              {group.suggestedSettlements.filter((s) => s.from !== userId).length > 0 && (
                <div className="p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Others owe</p>
                  <div className="space-y-0.5">
                    {group.suggestedSettlements.filter((s) => s.from !== userId).map((s, i) => {
                      const globalIdx = group.suggestedSettlements.indexOf(s)
                      const isExpanded = expandedDebts.has(globalIdx)
                      return (
                        <div key={i}>
                          <button
                            onClick={() => setExpandedDebts((prev) => {
                              const next = new Set(prev)
                              next.has(globalIdx) ? next.delete(globalIdx) : next.add(globalIdx)
                              return next
                            })}
                            className="w-full flex items-center gap-1.5 text-xs hover:bg-accent/50 rounded-lg px-1.5 py-1 transition-colors"
                          >
                            <span className="font-medium text-foreground/80 truncate">{s.fromName}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-foreground/60 truncate">{s.toName}</span>
                            <span className="ml-auto font-semibold text-foreground tabular-nums shrink-0">{formatCurrency(s.amount, group.currency)}</span>
                            {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
                          </button>
                          {isExpanded && s.reasons.length > 0 && (
                            <div className="ml-3 mt-1 mb-1 pl-2 border-l-2 border-border space-y-0.5">
                              {s.reasons.map((r) => (
                                <div key={r.expenseId} className="flex justify-between text-[11px] text-muted-foreground">
                                  <span className="truncate max-w-[140px]">{r.description}</span>
                                  <span className="font-medium shrink-0 ml-2">{formatCurrency(r.shareAmount, group.currency)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="glass rounded-2xl p-3 space-y-1.5">
            <AddExpenseDialog
              groupId={group.id}
              currency={group.currency}
              members={group.members}
              currentUserId={userId}
              defaultSplitType={group.defaultSplitType as "EQUAL" | "SELECTED" | "SHARES" | "PERCENTAGE" | "EXACT"}
              defaultSplitShares={group.defaultSplitShares ?? undefined}
              onCreated={() => refreshGroup()}
              trigger={
                <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
                  <Plus className="h-4 w-4 shrink-0" />
                  Add Expense
                </button>
              }
            />
            <button
              onClick={() => setOpenDialog("addRecurring")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors"
            >
              <RefreshCw className="h-4 w-4 shrink-0 text-muted-foreground" />
              Add Recurring
            </button>
            <AddSettlementDialog
              groupId={group.id}
              currency={group.currency}
              members={group.members}
              currentUserId={userId}
              onCreated={() => refreshGroup()}
              trigger={
                <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  Settle Up
                </button>
              }
            />
            <button onClick={() => setOpenDialog("addMember")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              Add Member
            </button>
            <button onClick={() => setOpenDialog("createTrip")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border hover:bg-accent text-sm font-medium text-foreground transition-colors">
              <Plane className="h-4 w-4 shrink-0 text-muted-foreground" />
              Add Event
            </button>
          </div>

          {/* Budget */}
          <BudgetProgressCard groupId={group.id} currency={group.currency} />
        </div>

        {/* ── RIGHT: TABS ── */}
        <div className="min-w-0">
      {(() => {
        const ALL_TABS = [
          { value: "expenses",    label: "Expenses",    count: group.expenses.length,          icon: Receipt },
          { value: "balances",    label: "Balances",    count: null,                           icon: ArrowLeftRight },
          { value: "trips",       label: "Events",      count: trips.length,                   icon: Plane },
          { value: "members",     label: "Members",     count: group.members.length + (group.guests?.length ?? 0), icon: Users },
          { value: "insights",    label: "AI Insights", count: null,                           icon: Sparkles },
          { value: "recurring",   label: "Recurring",   count: group.recurringExpenses.length, icon: Repeat2 },
          { value: "settings",    label: "Settings",    count: null,                           icon: Settings },
        ]
        const primaryTabs = ALL_TABS.slice(0, 5)
        const moreTabs    = ALL_TABS.slice(5)
        const isMore = moreTabs.some((t) => t.value === activeGroupTab)

        return (
          <div className="border-b border-border flex items-center">
            {/* Primary tabs */}
            <div className="flex">
              {primaryTabs.map(({ value, label, count }) => {
                const active = activeGroupTab === value
                return (
                  <button
                    key={value}
                    onClick={() => setActiveGroupTab(value)}
                    className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                      active
                        ? "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400"
                        : "text-muted-foreground border-transparent hover:text-foreground"
                    }`}
                  >
                    {label}
                    {count !== null && count > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ${active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" : "bg-muted text-muted-foreground"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* More dropdown */}
            <div className="relative ml-auto shrink-0">
              <button
                onClick={() => setMoreMenuOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isMore
                    ? "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {isMore ? (moreTabs.find((t) => t.value === activeGroupTab)?.label ?? "More") : "More"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-border bg-popover shadow-lg overflow-hidden py-1">
                    {moreTabs.map(({ value, label, count, icon: Icon }) => {
                      const active = activeGroupTab === value
                      return (
                        <button
                          key={value}
                          onClick={() => { setActiveGroupTab(value); setMoreMenuOpen(false) }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                            active
                              ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-left">{label}</span>
                          {count !== null && count > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                              {count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      <Tabs value={activeGroupTab} onValueChange={setActiveGroupTab}>

        {/* Expenses */}
        <TabsContent value="expenses" className="mt-4 space-y-3">
          {group.expenses.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No expenses yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Add the first expense to start splitting</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              {group.expenses.map((expense, idx) => (
                <div key={expense.id}>
                  {idx > 0 && <div className="h-px bg-border/60 mx-4" />}
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/40 group transition-colors">
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => setExpandedExpenses((prev) => {
                        const next = new Set(prev); next.has(expense.id) ? next.delete(expense.id) : next.add(expense.id); return next
                      })}
                    >
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${CATEGORY_COLORS[expense.category] ?? "bg-gray-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-foreground text-sm truncate">{expense.description}</p>
                          {expense.trip && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-500/15 dark:text-indigo-400 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                              <Plane className="h-2.5 w-2.5" />{expense.trip.name}
                            </span>
                          )}
                          {expense.visibility === "PAYERS_ONLY" && <EyeOff className="h-3 w-3 text-amber-500 shrink-0" />}
                          {expense.approvalStatus === "PENDING_APPROVAL" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-100 dark:bg-orange-500/15 dark:text-orange-400 px-1.5 py-0.5 rounded-full shrink-0">
                              <Clock className="h-2.5 w-2.5" />Pending
                            </span>
                          )}
                          {expense.approvalStatus === "REJECTED" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 bg-red-100 dark:bg-red-500/15 dark:text-red-400 px-1.5 py-0.5 rounded-full shrink-0">
                              <XCircle className="h-2.5 w-2.5" />Rejected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Paid by {expense.guestPayeeName ? `${expense.guestPayeeName} (external)` : expense.paidBy.name} · {format(new Date(expense.date), "MMM d")} · {expense.category}
                          {expense.createdBy && expense.createdBy.id !== expense.paidById && (
                            <> · <span className="text-muted-foreground/70">added by {expense.createdBy.name}</span></>
                          )}
                        </p>
                      </div>
                    </button>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground text-sm tabular-nums">{formatCurrency(expense.amount, expense.currency)}</p>
                      <div className="flex items-center justify-end gap-0.5 mt-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {isAdmin && group.workspaceType === "TEAM" && expense.approvalStatus === "PENDING_APPROVAL" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" disabled={approvingId === expense.id} onClick={() => approveExpense(expense.id, "APPROVE")}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" disabled={approvingId === expense.id} onClick={() => approveExpense(expense.id, "REJECT")}>
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <EditExpenseDialog expense={expense as any} members={group.members} currency={group.currency} onUpdated={() => refreshGroup()} />
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => deleteExpense(expense.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {expandedExpenses.has(expense.id) && expense.splits.length > 0 && (
                    <div className="px-4 pb-3">
                      <div className="rounded-xl bg-muted/40 border border-border/60 overflow-hidden">
                        {expense.splits.map((s, i) => {
                          const displayName = s.user?.name ?? s.guest?.name ?? "Guest"
                          const isMe = s.userId === userId
                          return (
                            <div key={s.userId ?? s.guestMemberId} className={cn("flex items-center justify-between px-3 py-2 text-xs", i > 0 && "border-t border-border/40")}>
                              <span className="text-muted-foreground">{displayName}{isMe ? " (you)" : ""}{s.guestMemberId && <span className="ml-1 text-amber-600 dark:text-amber-400">(guest)</span>}</span>
                              <span className="font-semibold text-foreground tabular-nums">{formatCurrency(s.amount, group.currency)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settlements */}

        {/* Recurring */}
        <TabsContent value="recurring" className="mt-4">
          {group.recurringExpenses.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center mb-3">
                <RefreshCw className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No recurring expenses</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Auto-split bills every week, month, or quarter</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              {group.recurringExpenses.map((r, idx) => (
                <div key={r.id}>
                  {idx > 0 && <div className="h-px bg-border/60 mx-4" />}
                  <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/40 group/row transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-sm">{r.description}</p>
                        <Badge variant="outline" className="text-[10px] text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 px-1.5 py-0">
                          {r.frequency === "WEEKLY" ? "Weekly" : r.frequency === "MONTHLY" ? "Monthly" : "Quarterly"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Next: {format(new Date(r.nextDueDate), "MMM d")} · {r.category} · by {r.createdBy.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-foreground text-sm tabular-nums">{formatCurrency(r.lastAmount, r.currency)}</p>
                        <p className="text-xs text-muted-foreground">per period</p>
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 md:opacity-0 md:group-hover/row:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        disabled={deletingId === r.id}
                        onClick={() => deleteRecurring(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Trips */}
        <TabsContent value="trips" className="mt-4">
          {trips.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center mb-3">
                <Plane className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No events yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Create an event to track expenses for a trip, dinner, or celebration</p>
              <button
                onClick={() => setOpenDialog("createTrip")}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Create first event
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((t) => (
                <div key={t.id} className="glass rounded-2xl p-4 hover:bg-accent/40 transition-colors flex items-center gap-4 group/trip">
                  <Link href={`/trips/${t.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-2xl shrink-0">
                      {t.coverEmoji ?? "✈️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{t.name}</p>
                        <span className="text-xs text-muted-foreground capitalize shrink-0">{(t.eventType ?? "TRIP").toLowerCase()}</span>
                      </div>
                      {t.destination && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t.destination}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(t.startDate), "MMM d")} – {format(new Date(t.endDate), "MMM d, yyyy")}
                        {t._count.days > 0 && ` · ${t._count.days} day${t._count.days !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 md:opacity-0 md:group-hover/trip:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all shrink-0"
                    disabled={deletingId === t.id}
                    onClick={(e) => { e.preventDefault(); deleteTrip(t.id, t.name) }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <button
                onClick={() => setOpenDialog("createTrip")}
                className="w-full glass rounded-2xl p-4 border-2 border-dashed border-border hover:border-indigo-400/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground"
              >
                <Plus className="h-4 w-4" />
                New event
              </button>
            </div>
          )}
        </TabsContent>

        {/* Members */}
        <TabsContent value="members" className="mt-4 space-y-3">
          <MembersTab
            group={group}
            userId={userId}
            isAdmin={isAdmin}
            onGroupChange={setGroup}
            onLeave={() => router.push("/groups")}
          />
        </TabsContent>

        {/* Balances */}
        <TabsContent value="balances" className="mt-4 space-y-6">
          {/* Section 1 — Balances */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Balances</p>
            <div className="space-y-3">
              {[
                ...group.members.map((m) => ({ key: m.userId, name: m.user.name + (m.userId === userId ? " (you)" : ""), balanceKey: m.userId, isGuest: false })),
                ...(group.guests ?? []).map((g) => ({ key: `guest_${g.id}`, name: `${g.name} (guest)`, balanceKey: `guest_${g.id}`, isGuest: true })),
              ].map(({ key, name, balanceKey, isGuest }) => {
                const balance = group.balanceMap[balanceKey] ?? 0
                const allBalances = [
                  ...group.members.map((mm) => Math.abs(group.balanceMap[mm.userId] ?? 0)),
                  ...(group.guests ?? []).map((g) => Math.abs(group.balanceMap[`guest_${g.id}`] ?? 0)),
                ]
                const maxBalance = Math.max(...allBalances, 1)
                const barWidth = Math.round((Math.abs(balance) / maxBalance) * 100)
                return (
                  <div key={key} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className={cn("text-[10px] font-bold", isGuest ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300")}>
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold text-foreground">{name}</span>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold tabular-nums",
                          balance > 0.01 ? "text-emerald-600 dark:text-emerald-400"
                          : balance < -0.01 ? "text-rose-500 dark:text-rose-400"
                          : "text-muted-foreground/50"
                        )}>
                          {balance > 0.01 ? "+" : ""}{formatCurrency(balance, group.currency)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {Math.abs(balance) < 0.01 ? "settled" : balance > 0 ? "owed to them" : "they owe"}
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all",
                          balance > 0.01 ? "bg-emerald-500" : balance < -0.01 ? "bg-rose-500" : "bg-muted-foreground/20"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 2 — Suggested Settlements */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Suggested Settlements</p>
            {group.suggestedSettlements.length === 0 ? (
              <div className="glass rounded-2xl px-4 py-5 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-sm text-muted-foreground">All settled up!</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                {group.suggestedSettlements.map((s, idx) => (
                  <div key={idx}>
                    {idx > 0 && <div className="h-px bg-border/60 mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                            {s.fromName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            {s.toName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{s.fromName} → {s.toName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(s.amount, group.currency)}</p>
                        <div className="flex items-center gap-1">
                          {group.currency.toUpperCase() === "CAD" && (
                            <InteracHelperDialog
                              amount={s.amount}
                              currency={group.currency}
                              toName={s.toName}
                              toEmail={group.members.find((m) => m.userId === s.to)?.user.email ?? ""}
                              groupName={group.name}
                              onSent={async () => {
                                await fetch("/api/settlements", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ groupId: group.id, toUserId: s.to, amount: s.amount, note: "Interac e-Transfer" }),
                                })
                                refreshGroup()
                              }}
                            />
                          )}
                          {stripeEnabled && (
                            <AddSettlementDialog
                              groupId={group.id}
                              currency={group.currency}
                              members={group.members}
                              currentUserId={userId}
                              suggestedTo={s.to}
                              suggestedAmount={s.amount}

                              onCreated={() => refreshGroup()}
                              compact
                              trigger={
                                <Button variant="outline" size="sm" className="h-7 text-xs px-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                  Pay via Stripe
                                </Button>
                              }
                            />
                          )}
                          <AddSettlementDialog
                            groupId={group.id}
                            currency={group.currency}
                            members={group.members}
                            currentUserId={userId}
                            suggestedTo={s.to}
                            suggestedAmount={s.amount}
                            onCreated={() => refreshGroup()}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3 — Settlement History */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Settlement History {group.settlements.length > 0 && <span className="text-muted-foreground/50 font-normal">· {group.settlements.length}</span>}
            </p>
            {group.settlements.length === 0 ? (
              <div className="text-center py-10">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No settlements yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Payments between members will appear here</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                {group.settlements.map((s, idx) => (
                  <div key={s.id}>
                    {idx > 0 && <div className="h-px bg-border/60 mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/40 group/row transition-colors">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            {s.fromUser.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                            {s.toUser.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{s.fromUser.name} → {s.toUser.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.note ? `${s.note} · ` : ""}{format(new Date(s.createdAt), "MMM d, yyyy")}
                          {s.createdBy && s.createdBy.id !== s.fromUser.id && (
                            <> · <span className="text-muted-foreground/70">recorded by {s.createdBy.name}</span></>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(s.amount, s.currency)}</p>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 md:opacity-0 md:group-hover/row:opacity-100 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                          disabled={deletingId === s.id}
                          onClick={() => deleteSettlement(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* AI Insights */}
        <TabsContent value="insights">
          <InsightsTab
            groupId={group.id}
            canUseAI={planStatus?.plan !== "FREE"}
            aiScansUsed={planStatus?.aiScansUsed ?? 0}
            aiScansLimit={planStatus?.aiScansLimit ?? 20}
            bonusScans={(planStatus as any)?.bonusScans ?? 0}
          />
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4 space-y-4">

          {group.workspaceType === "TEAM" && <ExpensePolicyCard groupId={group.id} />}

          {/* Inline group editor */}
          <GroupSettingsCard
            group={group}
            onUpdated={(updates) => setGroup((g) => g ? ({ ...g, ...updates } as GroupDetail) : g)}
          />

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
                <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Export Data</p>
                <p className="text-xs text-muted-foreground">Download expense records</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {planStatus?.plan === "FREE" ? (
                <>
                  <button onClick={() => toast.error("CSV export is a Pro feature. Upgrade to Pro to export expenses.")}
                    className="inline-flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-2 hover:bg-accent transition-colors text-foreground/80">
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />CSV
                  </button>
                  <button onClick={() => toast.error("QuickBooks export is a Pro feature. Upgrade to Pro to export expenses.")}
                    className="inline-flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-2 hover:bg-accent transition-colors text-foreground/80">
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />QuickBooks (IIF)
                  </button>
                </>
              ) : (
                <>
                  <a href={`/api/groups/${group.id}/export?format=csv`} download className="inline-flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-2 hover:bg-accent transition-colors text-foreground/80">
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />CSV
                  </a>
                  <a href={`/api/groups/${group.id}/export?format=qbo`} download className="inline-flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-2 hover:bg-accent transition-colors text-foreground/80">
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />QuickBooks (IIF)
                  </a>
                </>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="glass rounded-2xl border border-red-200 dark:border-red-500/25 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-500/15 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-500 dark:text-red-400">Danger Zone</p>
                  <p className="text-xs text-muted-foreground">Irreversible actions</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 bg-red-50 dark:bg-red-500/10 rounded-xl p-4">
                <div>
                  <p className="text-sm font-medium text-foreground/80">Delete this group</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Permanently removes all expenses and settlements.</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  onClick={async () => {
                    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return
                    const res = await fetch(`/api/groups/${group.id}`, { method: "DELETE" })
                    if (res.ok) {
                      toast.success("Group deleted")
                      router.push("/groups")
                    } else {
                      toast.error("Failed to delete group")
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
        </div>{/* end right col */}
      </div>{/* end two-col grid */}

      {/* Dialogs */}
      <AddMemberDialog
        groupId={group.id}
        existingMemberIds={group.members.map((m) => m.userId)}
        defaultSplitType={group.defaultSplitType}
        defaultSplitShares={group.defaultSplitShares}
        onSplitShiftUpdated={(shares) =>
          setGroup((g) => g ? { ...g, defaultSplitShares: shares } : g)
        }
        open={openDialog === "addMember"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onAdded={(member) => {
          setGroup((g) => g ? { ...g, members: [...g.members, member as Member] } : g)
          setOpenDialog(null)
        }}
        onGuestAdded={(guest) => {
          setGroup((g) => g ? { ...g, guests: [...(g.guests ?? []), guest as GuestMember] } : g)
          setOpenDialog(null)
        }}
      />
      <AddRecurringExpenseDialog
        groupId={group.id}
        currency={group.currency}
        members={group.members}
        canCreate={planStatus?.plan !== "FREE"}
        open={openDialog === "addRecurring"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onCreated={(r) => {
          setGroup((g) => g ? { ...g, recurringExpenses: [...g.recurringExpenses, r as RecurringExpense] } : g)
          setOpenDialog(null)
        }}
      />
      <CreateTripDialog
        groupId={group.id}
        open={openDialog === "createTrip"}
        onOpenChange={(v) => !v && setOpenDialog(null)}
        onCreated={(t) => {
          setTrips((prev) => [t as typeof trips[0], ...prev])
          setOpenDialog(null)
        }}
      />
    </div>
  )
}

// ── Members tab with inline share editing ────────────────────────────────────

function MembersTab({
  group,
  userId,
  isAdmin,
  onGroupChange,
  onLeave,
}: {
  group: GroupDetail
  userId: string
  isAdmin: boolean
  onGroupChange: React.Dispatch<React.SetStateAction<GroupDetail | null>>
  onLeave: () => void
}) {
  const isShares = group.defaultSplitType === "SHARES"
  const isPercentage = group.defaultSplitType === "PERCENTAGE"
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<string>("")
  const [editSplitType, setEditSplitType] = useState<string>("")
  const [editShare, setEditShare] = useState<string>("")
  const [savingMember, setSavingMember] = useState(false)

  function openEdit(m: typeof group.members[0]) {
    setExpandedMember(m.userId)
    setEditRole(m.role)
    setEditSplitType(group.defaultSplitType || "EQUAL")
    setEditShare(String(group.defaultSplitShares?.[m.userId] ?? ""))
  }

  async function saveMember(memberId: string) {
    setSavingMember(true)
    try {
      const member = group.members.find((m) => m.userId === memberId)!
      // Role change
      if (editRole !== member.role) {
        const res = await fetch(`/api/groups/${group.id}/members`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: memberId, role: editRole }),
        })
        if (!res.ok) { toast.error("Failed to update role"); return }
        onGroupChange((g) => g ? { ...g, members: g.members.map((m) => m.userId === memberId ? { ...m, role: editRole } : m) } : g)
      }
      // Share/percentage change only (split type is display-only in this panel)
      const isNewShares = editSplitType === "SHARES"
      const isNewPercentage = editSplitType === "PERCENTAGE"
      const val = parseFloat(editShare)
      if ((isNewShares || isNewPercentage) && !isNaN(val) && val >= 0) {
        const newShares = { ...(group.defaultSplitShares ?? {}), [memberId]: val }
        const res = await fetch(`/api/groups/${group.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultSplitShares: newShares }),
        })
        if (!res.ok) { toast.error("Failed to update share"); return }
        onGroupChange((g) => g ? { ...g, defaultSplitShares: newShares } : g)
      }
      toast.success("Member updated")
      setExpandedMember(null)
    } finally {
      setSavingMember(false)
    }
  }

  const percentageTotal = isPercentage
    ? group.members.reduce((sum, m) => sum + (group.defaultSplitShares?.[m.userId] ?? 0), 0)
    : 0

  return (
    <>
    <div className="glass rounded-2xl overflow-hidden">
      {group.members.map((m, idx) => {
        const balance = group.balanceMap[m.userId] ?? 0
        const hasBalance = Math.abs(balance) > 0.01
        const canRemove = isAdmin ? m.userId !== userId : m.userId === userId
        const isSelf = m.userId === userId
        const isExpanded = expandedMember === m.userId
        const currentShare = group.defaultSplitShares?.[m.userId]

        return (
          <div key={m.userId}>
            {idx > 0 && <div className="h-px bg-border/60 mx-4" />}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback
                  className="text-sm font-bold"
                  style={{
                    background: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 70%, 88%)`,
                    color: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 60%, 35%)`,
                  }}
                >
                  {m.user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-foreground text-sm">{m.user.name}</p>
                  {isSelf && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">you</span>}
                  {m.role === "ADMIN" && <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/15 px-1.5 py-0.5 rounded-full font-medium">Admin</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{m.user.email}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {group.defaultSplitType === "SHARES"
                    ? currentShare != null ? `${currentShare} shares` : "Shares — not set"
                    : group.defaultSplitType === "PERCENTAGE"
                    ? currentShare != null ? `${currentShare}%` : "Percentage — not set"
                    : group.defaultSplitType === "EXACT"
                    ? "Exact amount"
                    : "Equal split"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canRemove && hasBalance && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium" title="Settle up before removing">
                    Unsettled
                  </span>
                )}
                <p className={cn("text-sm font-bold tabular-nums",
                  balance > 0.01 ? "text-emerald-600 dark:text-emerald-400"
                  : balance < -0.01 ? "text-rose-500 dark:text-rose-400"
                  : "text-muted-foreground/50"
                )}>
                  {balance > 0.01 ? "+" : ""}{formatCurrency(balance, group.currency)}
                </p>
                {/* Edit button — always visible */}
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                  onClick={() => isExpanded ? setExpandedMember(null) : openEdit(m)}
                >
                  {isExpanded ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </Button>
                {canRemove && (
                  hasBalance ? null : (
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      onClick={async () => {
                        if (!confirm(isSelf ? "Leave this group?" : `Remove ${m.user.name} from this group?`)) return
                        const res = await fetch(`/api/groups/${group.id}/members`, {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: m.userId }),
                        })
                        if (res.ok) {
                          if (isSelf) {
                            onLeave()
                          } else {
                            onGroupChange((g) => g ? { ...g, members: g.members.filter((mem) => mem.userId !== m.userId) } : g)
                            toast.success(`${m.user.name} removed from group`)
                          }
                        } else {
                          const data = await res.json()
                          toast.error(data.error ?? "Failed to remove member")
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* Inline edit panel */}
            {isExpanded && (
              <div className="mx-4 mb-3 p-3 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                {isAdmin && !isSelf && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Role</p>
                    <div className="flex gap-2">
                      {["MEMBER", "ADMIN"].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setEditRole(r)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                            editRole === r
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {r === "ADMIN" ? "Admin" : "Member"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Split type (for share entry)</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {["EQUAL", "SHARES", "PERCENTAGE", "EXACT"].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditSplitType(t)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
                            editSplitType === t
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {t.charAt(0) + t.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(editSplitType === "SHARES" || editSplitType === "PERCENTAGE") && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      {editSplitType === "PERCENTAGE" ? "Percentage for this member" : "Shares for this member"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min="0" step={editSplitType === "PERCENTAGE" ? "0.1" : "1"}
                        max={editSplitType === "PERCENTAGE" ? "100" : undefined}
                        placeholder="0"
                        value={editShare}
                        onChange={(e) => setEditShare(e.target.value)}
                        className="w-24 h-8 text-sm"
                      />
                      <span className="text-sm text-muted-foreground">{editSplitType === "PERCENTAGE" ? "%" : "shares"}</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" disabled={savingMember} onClick={() => saveMember(m.userId)}>
                    {savingMember ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExpandedMember(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {isPercentage && (
        <div className={cn(
          "px-4 py-2.5 border-t border-border/60 text-xs flex items-center justify-between",
          Math.abs(percentageTotal - 100) < 0.01
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400"
        )}>
          <span>Total assigned</span>
          <span className="font-semibold tabular-nums">{percentageTotal.toFixed(1)}% / 100%</span>
        </div>
      )}
    </div>

    {/* Guests section */}

    {(group.guests?.length ?? 0) > 0 && (
      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
          Guests
        </p>
        <div className="glass rounded-2xl overflow-hidden">
          {(group.guests ?? []).map((g, idx) => {
            const balance = group.balanceMap[`guest_${g.id}`] ?? 0
            return (
              <div key={g.id}>
                {idx > 0 && <div className="h-px bg-border/60 mx-4" />}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      {g.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                        Guest
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {g.email ?? "No email · splits managed by admin"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {Math.abs(balance) > 0.01 ? (
                      <p className={cn("text-xs font-semibold tabular-nums",
                        balance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                      )}>
                        {balance > 0 ? "+" : ""}{formatCurrency(balance, group.currency)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50">Settled</p>
                    )}
                  </div>
                  {isAdmin && (
                    <GuestActionMenu guest={g} groupId={group.id} onGroupChange={onGroupChange} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )}
    </>
  )
}

function GuestActionMenu({
  guest,
  groupId,
  onGroupChange,
}: {
  guest: GuestMember
  groupId: string
  onGroupChange: React.Dispatch<React.SetStateAction<GroupDetail | null>>
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState(guest.name)
  const [email, setEmail] = useState(guest.email ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || "" }),
      })
      if (!res.ok) { toast.error("Failed to update guest"); return }
      const updated = await res.json()
      onGroupChange((g) => g ? { ...g, guests: g.guests.map((gg) => gg.id === guest.id ? updated : gg) } : g)
      toast.success("Guest updated")
      setEditOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Remove ${guest.name} from this group? Their historical splits will remain.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/guests/${guest.id}`, { method: "DELETE" })
      if (!res.ok) { toast.error("Failed to remove guest"); return }
      onGroupChange((g) => g ? { ...g, guests: g.guests.filter((gg) => gg.id !== guest.id) } : g)
      toast.success(`${guest.name} removed`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={deleting} onClick={remove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit guest</DialogTitle>
            <DialogDescription>Update {guest.name}&apos;s name or add an email so they can link an account later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input type="email" placeholder="For future account linking" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={saving || !name.trim()} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Inline group settings card (replaces EditGroupDialog) ────────────────────

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD", "AED", "CHF"]
const SPLIT_TYPE_EDIT_OPTIONS = [
  { value: "EQUAL",      label: "Equal",      desc: "Split evenly between all members" },
  { value: "SHARES",     label: "Shares",     desc: "Proportional headcount (e.g. family of 4 vs 2)" },
  { value: "PERCENTAGE", label: "Percentage", desc: "Each member pays a fixed %" },
  { value: "EXACT",      label: "Exact",      desc: "Enter exact amounts each time" },
]

function GroupSettingsCard({
  group,
  onUpdated,
}: {
  group: GroupDetail
  onUpdated: (updates: Partial<GroupDetail>) => void
}) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? "")
  const [currency, setCurrency] = useState(group.currency)
  const [splitType, setSplitType] = useState(group.defaultSplitType || "EQUAL")
  const [shares, setShares] = useState<Record<string, string>>(
    Object.fromEntries(group.members.map((m) => [m.userId, String(group.defaultSplitShares?.[m.userId] ?? "")]))
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toast.error("Group name is required"); return }
    const splitShares = splitType === "SHARES"
      ? Object.fromEntries(
          group.members.map((m) => [m.userId, parseFloat(shares[m.userId]) || 0]).filter(([, v]) => (v as number) > 0)
        )
      : null
    setSaving(true)
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, currency, defaultSplitType: splitType, defaultSplitShares: splitShares }),
      })
      if (!res.ok) { toast.error("Failed to update group"); return }
      toast.success("Group updated")
      onUpdated({ name: name.trim(), description: description.trim() || null, currency, defaultSplitType: splitType, defaultSplitShares: splitShares })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
          <Receipt className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Group settings</p>
          <p className="text-xs text-muted-foreground">Name, currency and default split</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Group name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family, Apartment" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group for?" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Currency</Label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Default split for new expenses</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {SPLIT_TYPE_EDIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSplitType(opt.value)}
              className={cn(
                "rounded-lg border px-2 py-2 text-xs font-medium transition-colors text-center",
                splitType === opt.value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                  : "border-border bg-background text-muted-foreground hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{SPLIT_TYPE_EDIT_OPTIONS.find((o) => o.value === splitType)?.desc}</p>
      </div>

      {splitType === "SHARES" && group.members.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-sm">Shares per member</Label>
          <div className="rounded-xl border border-border overflow-hidden">
            {group.members.map((m, i) => (
              <div key={m.userId} className={cn("flex items-center gap-3 px-3 py-2.5", i > 0 && "border-t border-border/50")}>
                <span className="text-sm text-foreground flex-1">{m.user.name}</span>
                <Input
                  type="number" min="0" step="1" placeholder="0"
                  value={shares[m.userId] ?? ""}
                  onChange={(e) => setShares((s) => ({ ...s, [m.userId]: e.target.value }))}
                  className="w-20 h-7 text-xs text-right"
                />
                <span className="text-xs text-muted-foreground w-10">shares</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}

// ── Default split settings card ───────────────────────────────────────────────

const SPLIT_TYPE_OPTIONS = [
  { value: "EQUAL",      label: "Equal",       desc: "Split evenly between all members" },
  { value: "SHARES",     label: "Shares",      desc: "Proportional headcount (e.g. family of 4 vs 2)" },
  { value: "PERCENTAGE", label: "Percentage",  desc: "Each member pays a fixed %" },
  { value: "EXACT",      label: "Exact",       desc: "Enter exact amounts each time" },
]

function DefaultSplitSettings({
  group,
  onSaved,
}: {
  group: GroupDetail
  onSaved: (type: string, shares: Record<string, number> | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [splitType, setSplitType] = useState(group.defaultSplitType || "EQUAL")
  const [shares, setShares] = useState<Record<string, string>>(
    Object.fromEntries(group.members.map((m) => [m.userId, String(group.defaultSplitShares?.[m.userId] ?? "")]))
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const splitData = splitType === "SHARES"
        ? Object.fromEntries(
            group.members
              .map((m) => [m.userId, parseFloat(shares[m.userId]) || 0])
              .filter(([, v]) => (v as number) > 0)
          )
        : null
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultSplitType: splitType, defaultSplitShares: splitData }),
      })
      if (!res.ok) { toast.error("Failed to save"); return }
      onSaved(splitType, splitData)
      setEditing(false)
      toast.success("Default split saved")
    } finally {
      setSaving(false)
    }
  }

  const currentLabel = SPLIT_TYPE_OPTIONS.find((o) => o.value === group.defaultSplitType)?.label ?? "Equal"

  return (
    <div className="mt-4 glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Default split</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            New expenses start with this split — you can change it per expense
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg">
            {currentLabel}
          </span>
          {group.defaultSplitType === "SHARES" && group.defaultSplitShares && (
            <span className="text-xs text-muted-foreground">
              {group.members.map((m) => `${m.user.name.split(" ")[0]}: ${(group.defaultSplitShares as Record<string,number>)[m.userId] ?? 0}`).join(" · ")}
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {SPLIT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSplitType(opt.value)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium transition-colors text-center",
                  splitType === opt.value
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {SPLIT_TYPE_OPTIONS.find((o) => o.value === splitType)?.desc}
          </p>

          {splitType === "SHARES" && (
            <div className="rounded-xl border border-border overflow-hidden">
              {group.members.map((m, i) => (
                <div key={m.userId} className={cn("flex items-center gap-3 px-3 py-2", i > 0 && "border-t border-border/50")}>
                  <span className="text-sm text-foreground flex-1">{m.user.name}</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={shares[m.userId] ?? ""}
                    onChange={(e) => setShares((s) => ({ ...s, [m.userId]: e.target.value }))}
                    className="w-16 h-7 text-xs text-right"
                  />
                  <span className="text-xs text-muted-foreground w-10">shares</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setSplitType(group.defaultSplitType || "EQUAL") }}>
              Cancel
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save default"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
