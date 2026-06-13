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
import { AddSettlementDialog } from "@/components/settlements/AddSettlementDialog"
import { AddMemberDialog } from "@/components/groups/AddMemberDialog"
import { AddRecurringExpenseDialog } from "@/components/expenses/AddRecurringExpenseDialog"
import { BudgetProgressCard } from "@/components/budget/BudgetProgressCard"
import { CreateTripDialog } from "@/components/trips/CreateTripDialog"
import { ExpensePolicyCard } from "@/components/groups/ExpensePolicyCard"
import { GroupCardCard } from "@/components/cards/GroupCardCard"
import { InviteMemberDialog } from "@/components/groups/InviteMemberDialog"
import { formatCurrency } from "@/lib/balance"
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

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDebts, setExpandedDebts] = useState<Set<number>>(new Set())
  const [approvingId, setApprovingId] = useState<string | null>(null)

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
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (!group) return null

  const isAdmin = group.members.find((m) => m.userId === userId)?.role === "ADMIN"
  const myBalance = group.balanceMap[userId] ?? 0
  const totalExpenses = group.expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/groups">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          {group.description && <p className="text-gray-500 text-sm mt-0.5">{group.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {group.workspaceType === "TEAM" && (
            <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Team</Badge>
          )}
          <Badge variant="outline">{group.currency}</Badge>
          <a
            href={`/api/groups/${group.id}/export?format=csv`}
            download
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Expenses</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalExpenses, group.currency)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Your Balance</p>
            <div className="flex items-center gap-2 mt-1">
              {myBalance > 0.01 ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              ) : myBalance < -0.01 ? (
                <TrendingDown className="h-5 w-5 text-red-500" />
              ) : (
                <Minus className="h-5 w-5 text-gray-400" />
              )}
              <p
                className={`text-2xl font-bold ${
                  myBalance > 0.01
                    ? "text-emerald-600"
                    : myBalance < -0.01
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {formatCurrency(Math.abs(myBalance), group.currency)}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {myBalance > 0.01 ? "owed to you" : myBalance < -0.01 ? "you owe" : "settled up"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Members</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{group.members.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      <BudgetProgressCard groupId={group.id} currency={group.currency} />

      {/* Suggested Settlements — with transparent debt breakdown */}
      {group.suggestedSettlements.length > 0 && (
        <Card className="border-0 shadow-sm bg-amber-50 border border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-800">Suggested Settlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {group.suggestedSettlements.map((s, i) => {
              const isExpanded = expandedDebts.has(i)
              const toggle = () =>
                setExpandedDebts((prev) => {
                  const next = new Set(prev)
                  next.has(i) ? next.delete(i) : next.add(i)
                  return next
                })
              return (
                <div key={i} className="rounded-lg overflow-hidden">
                  <button
                    onClick={toggle}
                    className="w-full flex items-center justify-between text-sm px-1 py-1.5 hover:bg-amber-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 text-amber-900">
                      <span className="font-medium">{s.fromName}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span className="font-medium">{s.toName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-amber-800">
                        {formatCurrency(s.amount, group.currency)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="ml-2 mb-1 pl-3 border-l-2 border-amber-200 space-y-1.5">
                      {s.reasons.length > 0 ? (
                        <>
                          <p className="text-xs text-amber-700 font-medium pt-1">
                            Why {s.fromName} owes {s.toName}:
                          </p>
                          {s.reasons.map((r) => (
                            <div key={r.expenseId} className="flex justify-between text-xs text-amber-800">
                              <span className="truncate max-w-[200px]">{r.description}</span>
                              <span className="font-medium shrink-0 ml-2">
                                {formatCurrency(r.shareAmount, group.currency)}
                              </span>
                            </div>
                          ))}
                          {s.hasRerouting && (
                            <div className="flex items-center gap-1 text-xs text-amber-600 pt-0.5">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span>Includes rerouted debt for optimal settlement</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-amber-600 pt-1 pb-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>This is a rerouted debt — optimised across the group</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <AddExpenseDialog
          groupId={group.id}
          currency={group.currency}
          members={group.members}
          currentUserId={userId}
          onCreated={(expense) =>
            setGroup((g) =>
              g ? { ...g, expenses: [expense as Expense, ...g.expenses] } : g
            )
          }
        />
        <AddSettlementDialog
          groupId={group.id}
          currency={group.currency}
          members={group.members}
          currentUserId={userId}
          onCreated={() => refreshGroup()}
        />
        <AddMemberDialog
          groupId={group.id}
          onAdded={(member) =>
            setGroup((g) =>
              g ? { ...g, members: [...g.members, member as Member] } : g
            )
          }
        />
        <AddRecurringExpenseDialog
          groupId={group.id}
          currency={group.currency}
          onCreated={(r) =>
            setGroup((g) =>
              g ? { ...g, recurringExpenses: [...g.recurringExpenses, r as RecurringExpense] } : g
            )
          }
        />
        <CreateTripDialog groupId={group.id} />
        <InviteMemberDialog groupId={group.id} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses ({group.expenses.length})</TabsTrigger>
          <TabsTrigger value="settlements">Payments ({group.settlements.length})</TabsTrigger>
          <TabsTrigger value="recurring">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Recurring ({group.recurringExpenses.length})
          </TabsTrigger>
          <TabsTrigger value="members">Members ({group.members.length})</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-4">
          {group.expenses.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No expenses yet. Add the first one!</div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                {group.expenses.map((expense, idx) => (
                  <div key={expense.id}>
                    {idx > 0 && <Separator />}
                    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {expense.category}
                          </Badge>
                          {expense.visibility === "PAYERS_ONLY" && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                              <EyeOff className="h-3 w-3" />
                              Private
                            </span>
                          )}
                          {expense.approvalStatus === "PENDING_APPROVAL" && (
                            <span className="flex items-center gap-0.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded shrink-0">
                              <Clock className="h-3 w-3" />
                              Pending
                            </span>
                          )}
                          {expense.approvalStatus === "APPROVED" && (
                            <span className="flex items-center gap-0.5 text-xs text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded shrink-0">
                              <CheckCircle2 className="h-3 w-3" />
                              Approved
                            </span>
                          )}
                          {expense.approvalStatus === "REJECTED" && (
                            <span className="flex items-center gap-0.5 text-xs text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shrink-0">
                              <XCircle className="h-3 w-3" />
                              Rejected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Paid by <strong>{expense.paidBy.name}</strong> ·{" "}
                          {format(new Date(expense.date), "MMM d, yyyy")}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {expense.splits.map((s) => (
                            <span
                              key={s.userId}
                              className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                            >
                              {s.user.name}: {formatCurrency(s.amount, expense.currency)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(expense.amount, expense.currency)}
                        </p>
                        <div className="flex items-center justify-end gap-1">
                          {/* Approval buttons for admins in TEAM groups */}
                          {isAdmin && group.workspaceType === "TEAM" && expense.approvalStatus === "PENDING_APPROVAL" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-500 hover:text-green-700 hover:bg-green-50"
                                disabled={approvingId === expense.id}
                                onClick={() => approveExpense(expense.id, "APPROVE")}
                                title="Approve"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                                disabled={approvingId === expense.id}
                                onClick={() => approveExpense(expense.id, "REJECT")}
                                title="Reject"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteExpense(expense.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settlements Tab */}
        <TabsContent value="settlements" className="mt-4">
          {group.settlements.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No payments recorded yet.</div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                {group.settlements.map((s, idx) => (
                  <div key={s.id}>
                    {idx > 0 && <Separator />}
                    <div className="flex items-center gap-4 p-4">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700 font-semibold">
                            {s.fromUser.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            <strong>{s.fromUser.name}</strong> paid <strong>{s.toUser.name}</strong>
                          </p>
                          {s.note && <p className="text-xs text-gray-400">{s.note}</p>}
                          <p className="text-xs text-gray-400">
                            {format(new Date(s.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-emerald-600 shrink-0">
                        {formatCurrency(s.amount, s.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recurring Expenses Tab */}
        <TabsContent value="recurring" className="mt-4">
          {group.recurringExpenses.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              No recurring expenses. Add one to auto-split bills every week, month, or quarter.
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                {group.recurringExpenses.map((r, idx) => (
                  <div key={r.id}>
                    {idx > 0 && <Separator />}
                    <div className="flex items-center gap-4 p-4 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">{r.description}</p>
                          <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                          <Badge variant="outline" className="text-xs text-violet-600 border-violet-200">
                            {r.frequency === "WEEKLY" ? "Weekly" : r.frequency === "MONTHLY" ? "Monthly" : "Quarterly"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Next due:{" "}
                          <strong>{format(new Date(r.nextDueDate), "MMM d, yyyy")}</strong>
                          {" · "}Created by {r.createdBy.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(r.lastAmount, r.currency)}
                        </p>
                        <p className="text-xs text-gray-400">per period</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {group.members.map((m, idx) => (
                <div key={m.userId}>
                  {idx > 0 && <Separator />}
                  <div className="flex items-center gap-3 p-4">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-violet-100 text-violet-700 font-semibold">
                        {m.user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {m.user.name}
                        {m.userId === userId && " (you)"}
                      </p>
                      <p className="text-sm text-gray-500">{m.user.email}</p>
                    </div>
                    <Badge variant={m.role === "ADMIN" ? "default" : "secondary"} className="text-xs">
                      {m.role}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {group.members.map((m, idx) => {
                const balance = group.balanceMap[m.userId] ?? 0
                return (
                  <div key={m.userId}>
                    {idx > 0 && <Separator />}
                    <div className="flex items-center gap-3 p-4">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-violet-100 text-violet-700 font-semibold">
                          {m.user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {m.user.name}
                          {m.userId === userId && " (you)"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {Math.abs(balance) < 0.01
                            ? "settled up"
                            : balance > 0
                            ? "is owed"
                            : "owes"}
                        </p>
                      </div>
                      <p
                        className={`font-semibold ${
                          balance > 0.01
                            ? "text-emerald-600"
                            : balance < -0.01
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        {formatCurrency(Math.abs(balance), group.currency)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          {/* Group Card */}
          <GroupCardCard groupId={group.id} isAdmin={!!isAdmin} />

          {/* Expense Policy — TEAM workspace only */}
          {group.workspaceType === "TEAM" && (
            <ExpensePolicyCard groupId={group.id} />
          )}

          {/* Export */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-violet-600" />
                <CardTitle className="text-base">Export Data</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <a
                href={`/api/groups/${group.id}/export?format=csv`}
                download
                className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-gray-500" />
                Download CSV
              </a>
              <a
                href={`/api/groups/${group.id}/export?format=qbo`}
                download
                className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-md px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-gray-500" />
                Download QuickBooks (IIF)
              </a>
            </CardContent>
          </Card>

          {/* Danger Zone — admin only */}
          {isAdmin && (
            <Card className="border border-red-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Delete this group</p>
                  <p className="text-xs text-gray-500 mt-0.5">Permanently deletes the group, all expenses, and settlements. This cannot be undone.</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
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
                  Delete Group
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
