"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  ArrowLeft,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Settings2,
  Plus,
  Users,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog"
import { EditExpenseDialog } from "@/components/expenses/EditExpenseDialog"
import { AddSettlementDialog } from "@/components/settlements/AddSettlementDialog"
import { AddMemberDialog } from "@/components/groups/AddMemberDialog"
import { AddRecurringExpenseDialog } from "@/components/expenses/AddRecurringExpenseDialog"
import { BudgetProgressCard } from "@/components/budget/BudgetProgressCard"
import { CreateTripDialog } from "@/components/trips/CreateTripDialog"
import { ExpensePolicyCard } from "@/components/groups/ExpensePolicyCard"
import { GroupCardCard } from "@/components/cards/GroupCardCard"
import { InviteMemberDialog } from "@/components/groups/InviteMemberDialog"
import { InteracHelperDialog } from "@/components/settlements/InteracHelperDialog"
import { formatCurrency } from "@/lib/balance"
import { cn } from "@/lib/utils"
import type { AnnotatedTransfer } from "@/lib/balance"

interface Member {
  userId: string
  role: string
  user: { id: string; name: string; email: string; avatar: string | null }
}

interface Split {
  userId: string
  amount: number
  user: { id: string; name: string }
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
  splits: Split[]
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
}

interface GroupDetail {
  id: string
  name: string
  description: string | null
  currency: string
  workspaceType: "PERSONAL" | "TEAM"
  members: Member[]
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
  General: "bg-gray-300",
  Other: "bg-teal-400",
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDebts, setExpandedDebts] = useState<Set<number>>(new Set())
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [showMoreActions, setShowMoreActions] = useState(false)

  const userId = session?.user.id ?? ""

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
        g
          ? {
              ...g,
              expenses: g.expenses.map((e) =>
                e.id === expenseId ? { ...e, approvalStatus: updated.approvalStatus } : e
              ),
            }
          : g
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

  if (loading) {
    return (
      <div className="space-y-0">
        {/* Hero skeleton */}
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 p-5 md:p-8">
          <Skeleton className="h-5 w-24 bg-white/20 mb-4" />
          <Skeleton className="h-8 w-56 bg-white/20 mb-2" />
          <Skeleton className="h-4 w-40 bg-white/20" />
        </div>
        <div className="p-5 md:p-8 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!group) return null

  const isAdmin = group.members.find((m) => m.userId === userId)?.role === "ADMIN"
  const myBalance = group.balanceMap[userId] ?? 0
  const totalExpenses = group.expenses.reduce((s, e) => s + e.amount, 0)
  const mySettlements = group.suggestedSettlements.filter((s) => s.from === userId)

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-violet-800 text-white">
        <div className="px-5 md:px-8 pt-5 pb-6">
          {/* Back */}
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 text-violet-200 hover:text-white text-sm font-medium mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All groups
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl md:text-3xl font-bold">{group.name}</h1>
                {group.workspaceType === "TEAM" && (
                  <Badge className="bg-white/20 text-white border-0 text-xs">Team</Badge>
                )}
                <Badge className="bg-white/20 text-white border-0 text-xs font-semibold">{group.currency}</Badge>
              </div>
              {group.description && (
                <p className="text-violet-200 text-sm">{group.description}</p>
              )}
              {/* Member avatars */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex -space-x-2">
                  {group.members.slice(0, 6).map((m, i) => (
                    <Avatar key={m.userId} className="h-7 w-7 ring-2 ring-violet-700" style={{ zIndex: 6 - i }}>
                      <AvatarFallback
                        className="text-[10px] font-bold"
                        style={{
                          background: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 70%, 75%)`,
                          color: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 60%, 25%)`,
                        }}
                      >
                        {m.user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-violet-200 text-xs">{group.members.length} members</span>
              </div>
            </div>

            {/* Export shortcut */}
            <a
              href={`/api/groups/${group.id}/export?format=csv`}
              download
              className="hidden md:flex items-center gap-1.5 text-xs text-violet-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 border-t border-white/10">
          <div className="px-5 md:px-8 py-4 text-center border-r border-white/10">
            <p className="text-violet-200 text-xs font-medium">Total spent</p>
            <p className="text-white font-bold text-lg tabular-nums mt-0.5">{formatCurrency(totalExpenses, group.currency)}</p>
          </div>
          <div className="px-4 py-4 text-center border-r border-white/10">
            <p className="text-violet-200 text-xs font-medium">Your balance</p>
            <p className={cn("font-bold text-lg tabular-nums mt-0.5", myBalance > 0.01 ? "text-emerald-300" : myBalance < -0.01 ? "text-rose-300" : "text-white/60")}>
              {myBalance > 0.01 ? "+" : myBalance < -0.01 ? "-" : ""}{formatCurrency(Math.abs(myBalance), group.currency)}
            </p>
          </div>
          <div className="px-4 md:px-8 py-4 text-center">
            <p className="text-violet-200 text-xs font-medium">Expenses</p>
            <p className="text-white font-bold text-lg mt-0.5">{group.expenses.length}</p>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="p-5 md:p-8 space-y-5 max-w-5xl">

        {/* My pending settlements — only when I owe money */}
        {mySettlements.length > 0 && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 p-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-3">You owe</p>
            <div className="space-y-2">
              {mySettlements.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-200">
                    <span className="font-semibold">{formatCurrency(s.amount, group.currency)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{s.toName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
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
                          body: JSON.stringify({
                            groupId: group.id,
                            toUserId: s.to,
                            amount: s.amount,
                            note: "Interac e-Transfer",
                          }),
                        })
                        refreshGroup()
                      }}
                    />
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

        {/* All settlements summary (non-mine) — collapsed accordion */}
        {group.suggestedSettlements.filter((s) => s.from !== userId).length > 0 && (
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Others owe</p>
            <div className="space-y-2">
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
                      className="w-full flex items-center gap-2 text-sm hover:bg-accent/50 rounded-xl px-2 py-1.5 transition-colors"
                    >
                      <span className="font-medium text-foreground/80">{s.fromName}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground/80">{s.toName}</span>
                      <span className="ml-auto font-semibold text-foreground">{formatCurrency(s.amount, group.currency)}</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    {isExpanded && s.reasons.length > 0 && (
                      <div className="ml-4 mt-1 mb-2 pl-3 border-l-2 border-border space-y-1">
                        {s.reasons.map((r) => (
                          <div key={r.expenseId} className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-[200px]">{r.description}</span>
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

        {/* Budget */}
        <BudgetProgressCard groupId={group.id} currency={group.currency} />

        {/* Primary action + secondary overflow */}
        <div className="flex items-center gap-2 flex-wrap">
          <AddExpenseDialog
            groupId={group.id}
            currency={group.currency}
            members={group.members}
            currentUserId={userId}
            onCreated={() => refreshGroup()}
          />
          <AddSettlementDialog
            groupId={group.id}
            currency={group.currency}
            members={group.members}
            currentUserId={userId}
            onCreated={() => refreshGroup()}
          />
          {/* More actions */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-gray-600"
              onClick={() => setShowMoreActions((v) => !v)}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </Button>
            {showMoreActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoreActions(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 w-56 glass-strong rounded-xl shadow-2xl py-1 overflow-hidden">
                  {[
                    { label: "Add member", node: <AddMemberDialog groupId={group.id} onAdded={(member) => setGroup((g) => g ? { ...g, members: [...g.members, member as Member] } : g)} /> },
                    { label: "Add recurring", node: <AddRecurringExpenseDialog groupId={group.id} currency={group.currency} onCreated={(r) => setGroup((g) => g ? { ...g, recurringExpenses: [...g.recurringExpenses, r as RecurringExpense] } : g)} /> },
                    { label: "Create trip", node: <CreateTripDialog groupId={group.id} /> },
                    { label: "Invite by link", node: <InviteMemberDialog groupId={group.id} /> },
                  ].map(({ label, node }) => (
                    <div
                      key={label}
                      className="flex items-center px-3 py-2 text-sm text-foreground/80 hover:bg-accent cursor-pointer [&>*]:w-full [&_button]:justify-start [&_button]:px-0 [&_button]:h-auto [&_button]:py-0 [&_button]:text-foreground/80 [&_button]:bg-transparent [&_button]:shadow-none [&_button]:font-normal [&_button]:text-sm"
                      onClick={() => setShowMoreActions(false)}
                    >
                      {node}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="expenses">
          <TabsList className="w-full overflow-x-auto flex h-auto p-1 gap-0.5 bg-muted rounded-xl">
            <TabsTrigger value="expenses" className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
              Expenses {group.expenses.length > 0 && <span className="ml-1 text-gray-400">({group.expenses.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="settlements" className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
              Settlements {group.settlements.length > 0 && <span className="ml-1 text-gray-400">({group.settlements.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="recurring" className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
              Recurring
            </TabsTrigger>
            <TabsTrigger value="members" className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
              Members
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
              Balances
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="mt-4">
            {group.expenses.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <Plus className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No expenses yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Add the first expense to start splitting</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                {group.expenses.map((expense, idx) => (
                  <div key={expense.id}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 group transition-colors">
                      {/* Category dot */}
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${CATEGORY_COLORS[expense.category] ?? "bg-gray-300"}`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-foreground text-sm truncate">{expense.description}</p>
                          {expense.visibility === "PAYERS_ONLY" && (
                            <EyeOff className="h-3 w-3 text-amber-500 shrink-0" />
                          )}
                          {expense.approvalStatus === "PENDING_APPROVAL" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full shrink-0">
                              <Clock className="h-2.5 w-2.5" />Pending
                            </span>
                          )}
                          {expense.approvalStatus === "REJECTED" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full shrink-0">
                              <XCircle className="h-2.5 w-2.5" />Rejected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {expense.paidBy.name} · {format(new Date(expense.date), "MMM d")} · {expense.category}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-foreground text-sm tabular-nums">{formatCurrency(expense.amount, expense.currency)}</p>
                        <div className="flex items-center justify-end gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isAdmin && group.workspaceType === "TEAM" && expense.approvalStatus === "PENDING_APPROVAL" && (
                            <>
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                                disabled={approvingId === expense.id}
                                onClick={() => approveExpense(expense.id, "APPROVE")}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                                disabled={approvingId === expense.id}
                                onClick={() => approveExpense(expense.id, "REJECT")}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <EditExpenseDialog expense={expense} members={group.members} onUpdated={() => refreshGroup()} />
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteExpense(expense.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Settlements Tab */}
          <TabsContent value="settlements" className="mt-4">
            {group.settlements.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No settlements yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Payments between members will appear here</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                {group.settlements.map((s, idx) => (
                  <div key={s.id}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            {s.fromUser.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] font-bold bg-violet-100 text-violet-700">
                            {s.toUser.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {s.fromUser.name} → {s.toUser.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.note ? `${s.note} · ` : ""}{format(new Date(s.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <p className="font-bold text-emerald-600 tabular-nums shrink-0">{formatCurrency(s.amount, s.currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Recurring Tab */}
          <TabsContent value="recurring" className="mt-4">
            {group.recurringExpenses.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-violet-50 dark:bg-violet-500/15 flex items-center justify-center mb-3">
                  <RefreshCw className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No recurring expenses</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Auto-split bills every week, month, or quarter</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                {group.recurringExpenses.map((r, idx) => (
                  <div key={r.id}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
                    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground text-sm">{r.description}</p>
                          <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-200 px-1.5 py-0">
                            {r.frequency === "WEEKLY" ? "Weekly" : r.frequency === "MONTHLY" ? "Monthly" : "Quarterly"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Next: {format(new Date(r.nextDueDate), "MMM d")} · {r.category} · by {r.createdBy.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-foreground text-sm tabular-nums">{formatCurrency(r.lastAmount, r.currency)}</p>
                        <p className="text-xs text-muted-foreground">per period</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-4">
            <div className="glass rounded-2xl overflow-hidden">
              {group.members.map((m, idx) => {
                const balance = group.balanceMap[m.userId] ?? 0
                return (
                  <div key={m.userId}>
                    {idx > 0 && <div className="h-px bg-border mx-4" />}
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
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-foreground text-sm">{m.user.name}</p>
                          {m.userId === userId && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">you</span>}
                          {m.role === "ADMIN" && <span className="text-[10px] text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-500/15 px-1.5 py-0.5 rounded-full font-medium">Admin</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.user.email}</p>
                      </div>
                      <p className={cn("text-sm font-bold tabular-nums shrink-0",
                        balance > 0.01 ? "text-emerald-600 dark:text-emerald-400" : balance < -0.01 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground/50"
                      )}>
                        {balance > 0.01 ? "+" : ""}{formatCurrency(balance, group.currency)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          {/* Balances Tab */}
          <TabsContent value="balances" className="mt-4">
            <div className="space-y-3">
              {group.members.map((m) => {
                const balance = group.balanceMap[m.userId] ?? 0
                const maxBalance = Math.max(...group.members.map((mm) => Math.abs(group.balanceMap[mm.userId] ?? 0)), 1)
                const barWidth = Math.round((Math.abs(balance) / maxBalance) * 100)
                return (
                  <div key={m.userId} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px] font-bold bg-violet-100 text-violet-700">
                            {m.user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold text-foreground">
                          {m.user.name}{m.userId === userId && " (you)"}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold tabular-nums",
                          balance > 0.01 ? "text-emerald-600 dark:text-emerald-400" : balance < -0.01 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground/50"
                        )}>
                          {balance > 0.01 ? "+" : ""}{formatCurrency(balance, group.currency)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50">
                          {Math.abs(balance) < 0.01 ? "settled" : balance > 0 ? "owed to them" : "they owe"}
                        </p>
                      </div>
                    </div>
                    {/* Balance bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", balance > 0.01 ? "bg-emerald-500" : balance < -0.01 ? "bg-rose-500" : "bg-gray-300 dark:bg-gray-200")}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <GroupCardCard groupId={group.id} isAdmin={!!isAdmin} />

            {group.workspaceType === "TEAM" && <ExpensePolicyCard groupId={group.id} />}

            {/* Export */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-500/15 flex items-center justify-center">
                  <Download className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Export Data</p>
                  <p className="text-xs text-muted-foreground">Download expense records</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/groups/${group.id}/export?format=csv`}
                  download
                  className="inline-flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-2 hover:bg-accent transition-colors text-foreground/80"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  CSV
                </a>
                <a
                  href={`/api/groups/${group.id}/export?format=qbo`}
                  download
                  className="inline-flex items-center gap-1.5 text-sm font-medium border border-border rounded-lg px-3 py-2 hover:bg-accent transition-colors text-foreground/80"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  QuickBooks (IIF)
                </a>
              </div>
            </div>

            {/* Danger Zone */}
            {isAdmin && (
              <div className="glass rounded-2xl border border-red-200 dark:border-red-500/25 p-5">
                <div className="flex items-center gap-2 mb-4">
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
      </div>
    </div>
  )
}
