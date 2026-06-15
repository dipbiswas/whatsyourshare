"use client"

import { useEffect, useState, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { format, differenceInDays } from "date-fns"
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Link2,
  Link2Off,
  Plus,
  Trash2,
  Check,
  X,
  Pencil,
  Circle,
  Clock3,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TripFundCard } from "@/components/trips/TripFundCard"
import { EditTripDialog } from "@/components/trips/EditTripDialog"
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog"
import { EditExpenseDialog } from "@/components/expenses/EditExpenseDialog"
import { AddSettlementDialog } from "@/components/settlements/AddSettlementDialog"
import { calculateGroupBalances, simplifyDebts, formatCurrency } from "@/lib/balance"

interface Member {
  userId: string
  role: string
  user: { id: string; name: string; avatar: string | null }
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
  date: string
  paidById: string
  splitType: string
  paidBy: { id: string; name: string }
  createdBy?: { id: string; name: string } | null
  splits: Split[]
}

interface TripDay {
  id: string
  date: string
  label: string | null
  expenses: Expense[]
}

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

interface TripDetail {
  id: string
  name: string
  destination: string | null
  coverEmoji: string | null
  eventType: string
  startDate: string
  endDate: string
  createdById: string
  createdBy: { id: string; name: string; email: string }
  group: {
    id: string
    name: string
    currency: string
    members: Member[]
  }
  days: TripDay[]
  fund: Fund | null
  unlinkedExpenses: Expense[]
  memberSpend: Record<string, number>
  groupSettlements: { fromUserId: string; toUserId: string; amount: number }[]
  memberIds: string[] | null
  hideFromNonMembers: boolean
  eventExpenses: Expense[]
}

interface ActionItem {
  id: string
  title: string
  description: string | null
  status: "OPEN" | "IN_PROGRESS" | "DONE"
  dueDate: string | null
  assignee: { id: string; name: string; avatar: string | null } | null
  createdBy: { id: string; name: string }
  expense: { id: string; description: string; amount: number; currency: string } | null
}

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [trip, setTrip] = useState<TripDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [generatingDays, setGeneratingDays] = useState(false)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [activeTab, setActiveTab] = useState<"itinerary" | "planning" | "expenses">("planning")

  const userId = session?.user.id ?? ""

  // Handle Stripe return
  useEffect(() => {
    const payment = searchParams.get("payment")
    const stripeSessionId = searchParams.get("session_id")
    if (payment === "success" && stripeSessionId) {
      fetch(`/api/payments/verify?sessionId=${stripeSessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "paid") {
            toast.success("Payment confirmed! Your contribution is recorded.")
            // Refresh trip data so fund card reflects the new PAID contribution
            fetch(`/api/trips/${id}`)
              .then((r) => r.ok ? r.json() : null)
              .then((d) => { if (d) setTrip(d) })
          } else {
            toast.error("Payment not confirmed yet — please refresh in a moment.")
          }
        })
    } else if (payment === "cancelled") {
      toast("Payment cancelled.")
    }
  }, [searchParams])

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text()
          throw new Error(`${r.status}: ${text}`)
        }
        return r.json()
      })
      .then((data) => {
        setTrip(data)
        // Auto-expand all days on load
        setExpandedDays(new Set(data.days.map((d: TripDay) => d.id)))
      })
      .catch((err) => {
        console.error("Trip fetch error:", err)
        toast.error("Failed to load trip: " + (err?.message ?? "unknown error"))
      })
      .finally(() => setLoading(false))
    fetch(`/api/trips/${id}/action-items`).then((r) => r.ok ? r.json() : []).then(setActionItems)
  }, [id, router])

  async function generateAllDays() {
    setGeneratingDays(true)
    try {
      const res = await fetch(`/api/trips/${id}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: "all" }),
      })
      if (!res.ok) { toast.error("Failed to generate days"); return }
      const updated = await fetch(`/api/trips/${id}`).then((r) => r.json())
      setTrip(updated)
      setExpandedDays(new Set(updated.days.map((d: TripDay) => d.id)))
      toast.success(`${updated.days.length} days generated!`)
    } finally {
      setGeneratingDays(false)
    }
  }

  async function refreshTrip() {
    const updated = await fetch(`/api/trips/${id}`).then((r) => r.json())
    setTrip(updated)
  }

  async function refreshActionItems() {
    const items = await fetch(`/api/trips/${id}/action-items`).then((r) => r.ok ? r.json() : [])
    setActionItems(items)
  }

  const [newItemTitle, setNewItemTitle] = useState("")
  const [newItemAssigneeId, setNewItemAssigneeId] = useState("")
  const [addingItem, setAddingItem] = useState(false)
  const [donePromptItemId, setDonePromptItemId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemTitle, setEditingItemTitle] = useState("")

  async function createActionItem() {
    const title = newItemTitle.trim()
    if (!title) return
    setAddingItem(true)
    try {
      const res = await fetch(`/api/trips/${id}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ...(newItemAssigneeId ? { assigneeId: newItemAssigneeId } : {}) }),
      })
      if (!res.ok) { toast.error("Failed to create action item"); return }
      const item = await res.json()
      setActionItems((prev) => [...prev, item])
      setNewItemTitle("")
      setNewItemAssigneeId("")
    } finally {
      setAddingItem(false)
    }
  }

  async function assignActionItem(itemId: string, assigneeId: string | null) {
    const res = await fetch(`/api/trips/${id}/action-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    })
    if (!res.ok) { toast.error("Failed to update assignee"); return }
    const updated = await res.json()
    setActionItems((prev) => prev.map((i) => i.id === itemId ? updated : i))
  }

  async function deleteActionItem(itemId: string) {
    if (!confirm("Delete this action item?")) return
    const res = await fetch(`/api/trips/${id}/action-items/${itemId}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to delete"); return }
    setActionItems((prev) => prev.filter((i) => i.id !== itemId))
    if (donePromptItemId === itemId) setDonePromptItemId(null)
  }

  async function saveActionItemTitle(itemId: string) {
    const title = editingItemTitle.trim()
    setEditingItemId(null)
    if (!title) return
    const res = await fetch(`/api/trips/${id}/action-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    if (res.ok) {
      const updated = await res.json()
      setActionItems((prev) => prev.map((i) => i.id === itemId ? { ...i, title: updated.title } : i))
    }
  }

  async function cycleActionItemStatus(item: ActionItem) {
    const next: ActionItem["status"] =
      item.status === "OPEN" ? "IN_PROGRESS" : item.status === "IN_PROGRESS" ? "DONE" : "OPEN"
    const res = await fetch(`/api/trips/${id}/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) { toast.error("Failed to update status"); return }
    const updated = await res.json()
    setActionItems((prev) => prev.map((i) => i.id === item.id ? updated : i))
    if (next === "DONE") setDonePromptItemId(item.id)
    else if (donePromptItemId === item.id) setDonePromptItemId(null)
  }

  const [editingMembers, setEditingMembers] = useState(false)
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<string>>(new Set())
  const [savingMembers, setSavingMembers] = useState(false)

  function openMemberEdit() {
    const current = trip?.memberIds
      ? new Set(trip.memberIds as string[])
      : new Set(trip?.group.members.map((m) => m.userId) ?? [])
    setPendingMemberIds(current)
    setEditingMembers(true)
  }

  function togglePendingMember(uid: string) {
    setPendingMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) {
        if (next.size === 1) return prev
        next.delete(uid)
      } else {
        next.add(uid)
      }
      return next
    })
  }

  async function saveMemberIds() {
    if (!trip) return
    const allSelected = pendingMemberIds.size === trip.group.members.length
    const memberIds = allSelected ? null : Array.from(pendingMemberIds)
    setSavingMembers(true)
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds }),
      })
      if (!res.ok) { toast.error("Failed to update members"); return }
      setTrip((t) => t ? { ...t, memberIds } : t)
      setEditingMembers(false)
      toast.success("Members updated")
    } finally {
      setSavingMembers(false)
    }
  }

  async function linkExpenseToDay(expenseId: string, dayId: string | null) {
    const res = await fetch(`/api/trips/${id}/days`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link-expense", expenseId, dayId }),
    })
    if (!res.ok) { toast.error("Failed to link expense"); return }

    await refreshTrip()
    toast.success(dayId ? "Expense linked to day" : "Expense unlinked")
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
  if (!trip) return (
    <div className="p-8 text-center">
      <p className="text-gray-500">Trip not found or failed to load.</p>
      <a href="/trips" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">← Back to trips</a>
    </div>
  )

  const eventMembers = trip.memberIds
    ? trip.group.members.filter((m) => (trip.memberIds as string[]).includes(m.userId))
    : trip.group.members

  const totalDays = differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1
  const totalSpent = trip.days
    .flatMap((d) => d.expenses)
    .reduce((s, e) => s + e.amount, 0)
  const isOrganizer = trip.createdById === userId
  const isTripMember = trip.memberIds
    ? (trip.memberIds as string[]).includes(userId)
    : true

  async function toggleHideFromNonMembers() {
    if (!trip) return
    const next = !trip.hideFromNonMembers
    setTrip((t) => t ? { ...t, hideFromNonMembers: next } : t)
    const res = await fetch(`/api/trips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideFromNonMembers: next }),
    })
    if (!res.ok) {
      setTrip((t) => t ? { ...t, hideFromNonMembers: !next } : t)
      toast.error("Failed to update visibility")
    } else {
      toast.success(next ? "Expenses hidden from non-members" : "Expenses visible to all group members")
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/trips">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{trip.coverEmoji ?? "✈️"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-2xl font-bold text-gray-900 flex-1">{trip.name}</h1>
                {isOrganizer && (
                  <>
                    <EditTripDialog
                      trip={trip as any}
                      onUpdated={(updates) => setTrip((t) => t ? { ...t, ...updates } as typeof t : t)}
                    />
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0"
                      onClick={async () => {
                        if (!confirm(`Delete "${trip.name}"? This cannot be undone.`)) return
                        const res = await fetch(`/api/trips/${id}`, { method: "DELETE" })
                        if (res.ok) {
                          toast.success("Event deleted")
                          router.push(`/groups/${trip.group.id}`)
                        } else {
                          toast.error("Failed to delete event")
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center flex-wrap gap-3 mt-1 text-sm text-gray-500">
                {trip.destination && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {trip.destination}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(trip.startDate), "MMM d")} –{" "}
                  {format(new Date(trip.endDate), "MMM d, yyyy")} · {totalDays} days
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {trip.group.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total spent</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalSpent, trip.group.currency)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Per day</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(totalDays > 0 ? totalSpent / totalDays : 0, trip.group.currency)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Per person</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(
                eventMembers.length > 0 ? totalSpent / eventMembers.length : 0,
                trip.group.currency
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {trip.days.flatMap((d) => d.expenses).length + trip.eventExpenses.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Members + Funding side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-3">
          {!editingMembers ? (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {eventMembers.map((m, i) => (
                  <Avatar key={m.userId} className="h-8 w-8 ring-2 ring-white dark:ring-gray-900" style={{ zIndex: eventMembers.length - i }}>
                    <AvatarFallback className="text-xs font-bold" style={{ background: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 70%, 85%)`, color: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 60%, 35%)` }}>
                      {m.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {eventMembers.map((m) => m.user.name.split(" ")[0]).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground">{eventMembers.length} of {trip.group.members.length} members</p>
              </div>
              {isOrganizer && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-indigo-600 shrink-0" onClick={openMemberEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Who&apos;s joining?</p>
              <div className="space-y-1.5">
                {trip.group.members.map((m) => {
                  const selected = pendingMemberIds.has(m.userId)
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => togglePendingMember(m.userId)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors text-left ${selected ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/30" : "border-border hover:bg-accent"}`}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-xs font-bold" style={{ background: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 70%, 85%)`, color: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 60%, 35%)` }}>
                          {m.user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm font-medium text-foreground">{m.user.name}</span>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-indigo-600 border-indigo-600" : "border-border"}`}>
                        {selected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs" disabled={savingMembers} onClick={saveMemberIds}>
                  {savingMembers ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingMembers(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense visibility toggle — only when trip has fewer members than group */}
      {trip.memberIds && (trip.memberIds as string[]).length < trip.group.members.length && isTripMember && (
        <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Hide expenses from non-members</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {trip.hideFromNonMembers
                ? "Event expenses are only visible to trip members in the group view"
                : "Event expenses are visible to everyone in the group"}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={trip.hideFromNonMembers}
            onClick={toggleHideFromNonMembers}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              trip.hideFromNonMembers ? "bg-indigo-600" : "bg-muted"
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${trip.hideFromNonMembers ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      )}

      {/* Trip Fund */}
      <TripFundCard
        tripId={trip.id}
        tripName={trip.name}
        eventType={(trip as any).eventType}
        fund={trip.fund}
        currentUserId={userId}
        isOrganizer={isOrganizer}
        organizerStripeOnboarded={(trip.createdBy as any).stripeOnboarded ?? false}
        memberCount={eventMembers.length}
        currency={trip.group.currency}
        organizerName={trip.createdBy.name}
        organizerEmail={trip.createdBy.email}
      />
      </div>

      {/* Per-person breakdown + Balances side by side */}
      {(() => {
        const allExpenses = [...trip.days.flatMap((d) => d.expenses), ...trip.eventExpenses]
        const hasSpend = Object.keys(trip.memberSpend).length > 0
        if (!hasSpend && allExpenses.length === 0) return null

        const nameMap: Record<string, string> = {}
        for (const m of eventMembers) nameMap[m.userId] = m.user.name

        const balanceMap = allExpenses.length > 0
          ? calculateGroupBalances(
              eventMembers.map((m) => ({ userId: m.userId })),
              allExpenses.map((e) => ({
                paidById: e.paidBy.id,
                amount: e.amount,
                splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
              })),
              trip.groupSettlements
            )
          : {}
        const transfers = simplifyDebts(balanceMap, nameMap)
        const allSettled = transfers.length === 0

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {/* Per-person breakdown */}
            {hasSpend && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    Per-person breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {eventMembers.map((m) => {
                      const spent = trip.memberSpend[m.userId] ?? 0
                      return (
                        <div key={m.userId} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-white/5">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                              {m.user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                              {m.userId === userId ? "You" : m.user.name.split(" ")[0]}
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {formatCurrency(spent, trip.group.currency)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Balances */}
            {allExpenses.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span className="text-base leading-none">⚖️</span>
                    Balances
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {eventMembers.map((m) => {
                      const bal = balanceMap[m.userId] ?? 0
                      const isYou = m.userId === userId
                      return (
                        <div key={m.userId} className="flex items-center gap-3">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                              {m.user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                            {isYou ? "You" : m.user.name}
                          </span>
                          {Math.abs(bal) < 0.01 ? (
                            <span className="text-xs text-gray-400 font-medium">settled</span>
                          ) : bal > 0 ? (
                            <span className="text-sm font-semibold text-emerald-600">+{formatCurrency(bal, trip.group.currency)}</span>
                          ) : (
                            <span className="text-sm font-semibold text-rose-500">{formatCurrency(bal, trip.group.currency)}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {allSettled ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium pt-1 border-t border-gray-100">
                      <span>✓</span> Everyone is settled up
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Suggested</p>
                      {transfers.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-700 flex-1 min-w-0">
                            <span className="font-medium">{t.from === userId ? "You" : t.fromName}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="font-medium">{t.to === userId ? "you" : t.toName}</span>
                          </span>
                          <span className="text-sm font-semibold text-gray-900 shrink-0">{formatCurrency(t.amount, trip.group.currency)}</span>
                          <AddSettlementDialog
                            groupId={trip.group.id}
                            currency={trip.group.currency}
                            members={trip.group.members.map((m) => ({ userId: m.userId, user: { id: m.userId, name: m.user.name } }))}
                            currentUserId={userId}
                            suggestedTo={t.to}
                            suggestedAmount={t.amount}
                            onCreated={refreshTrip}
                            compact
                            trigger={
                              <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
                                Settle up
                              </button>
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )
      })()}

      {/* Section tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-0 border-b border-gray-200">
          {(["planning", "expenses", "itinerary"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "itinerary" ? "Itinerary" : tab === "planning" ? "Planning" : "Event Expenses"}
              {tab === "planning" && actionItems.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 leading-none">
                  {actionItems.length}
                </span>
              )}
              {tab === "expenses" && trip.eventExpenses.length > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 leading-none">
                  {trip.eventExpenses.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Itinerary tab */}
        {activeTab === "itinerary" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {trip.days.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 ml-auto"
                  onClick={generateAllDays}
                  disabled={generatingDays}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {generatingDays ? "Generating…" : `Generate ${totalDays} days`}
                </Button>
              )}
            </div>

            {trip.days.length === 0 ? (
              <Card className="border-0 shadow-sm border-dashed border-2 border-gray-200">
                <CardContent className="py-10 text-center text-gray-400">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No itinerary days yet</p>
                  <p className="text-sm mt-1">Click &quot;Generate days&quot; to create a day-by-day timeline</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {trip.days.map((day, dayIdx) => {
                  const isOpen = expandedDays.has(day.id)
                  const dayTotal = day.expenses.reduce((s, e) => s + e.amount, 0)
                  return (
                    <Card key={day.id} className="border-0 shadow-sm overflow-hidden relative">
                      <button
                        onClick={() =>
                          setExpandedDays((prev) => {
                            const next = new Set(prev)
                            next.has(day.id) ? next.delete(day.id) : next.add(day.id)
                            return next
                          })
                        }
                        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm shrink-0">
                          {dayIdx + 1}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900">{day.label ?? `Day ${dayIdx + 1}`}</p>
                          <p className="text-xs text-gray-500">{format(new Date(day.date), "EEEE, MMM d")}</p>
                        </div>
                        <div className="text-right mr-2">
                          {dayTotal > 0 && (
                            <p className="text-sm font-semibold text-gray-700">
                              {formatCurrency(dayTotal, trip.group.currency)}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">{day.expenses.length} expense{day.expenses.length !== 1 ? "s" : ""}</p>
                        </div>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                      </button>
                      <div className="absolute right-12 top-1/2 -translate-y-1/2" onClick={(e) => e.stopPropagation()}>
                        <AddExpenseDialog
                          groupId={trip.group.id}
                          currency={trip.group.currency}
                          members={trip.group.members}
                          currentUserId={userId}
                          tripDayId={day.id}
                          onCreated={refreshTrip}
                          trigger={
                            <button className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 px-2.5 py-1.5 rounded-lg transition-colors">
                              <Plus className="h-3.5 w-3.5" /> Add
                            </button>
                          }
                        />
                      </div>
                      {isOpen && (
                        <div className="border-t border-gray-100">
                          {day.expenses.length === 0 ? (
                            <div className="flex items-center justify-between px-4 py-3 pl-16">
                              <p className="text-sm text-gray-400">No expenses for this day</p>
                              <AddExpenseDialog
                                groupId={trip.group.id}
                                currency={trip.group.currency}
                                members={trip.group.members}
                                currentUserId={userId}
                                tripDayId={day.id}
                                onCreated={refreshTrip}
                                trigger={
                                  <button className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 px-2.5 py-1.5 rounded-lg transition-colors">
                                    <Plus className="h-3.5 w-3.5" /> Add expense
                                  </button>
                                }
                              />
                            </div>
                          ) : (
                            day.expenses.map((expense, idx) => (
                              <div key={expense.id}>
                                {idx > 0 && <Separator />}
                                <div className="flex items-center gap-3 px-4 py-3 pl-16 hover:bg-gray-50 group">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium text-gray-800 truncate">{expense.description}</p>
                                      <Badge variant="secondary" className="text-xs shrink-0">{expense.category}</Badge>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Paid by {expense.paidBy.name}
                                      {expense.createdBy && expense.createdBy.id !== expense.paidById && ` · added by ${expense.createdBy.name}`}
                                    </p>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                                    {formatCurrency(expense.amount, trip.group.currency)}
                                  </p>
                                  <button
                                    title="Unlink from day"
                                    onClick={() => linkExpenseToDay(expense.id, null)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"
                                  >
                                    <Link2Off className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Unlinked expenses */}
            {trip.unlinkedExpenses.length > 0 && (
              <div className="space-y-3 pt-2">
                <h2 className="text-base font-semibold text-gray-900">
                  Unlinked group expenses
                  <span className="ml-2 text-sm font-normal text-gray-400">— assign these to a trip day</span>
                </h2>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    {trip.unlinkedExpenses.map((expense, idx) => (
                      <div key={expense.id}>
                        {idx > 0 && <Separator />}
                        <div className="flex items-center gap-4 p-4 hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                              <Badge variant="secondary" className="text-xs shrink-0">{expense.category}</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Paid by {expense.paidBy.name} · {format(new Date(expense.date), "MMM d")}
                              {expense.createdBy && expense.createdBy.id !== expense.paidById && ` · added by ${expense.createdBy.name}`}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 shrink-0">
                            {formatCurrency(expense.amount, trip.group.currency)}
                          </p>
                          {trip.days.length > 0 && (
                            <Select onValueChange={(dayId) => { if (typeof dayId === "string") linkExpenseToDay(expense.id, dayId) }}>
                              <SelectTrigger className="h-8 w-28 text-xs">
                                <Link2 className="h-3 w-3 mr-1" />
                                <SelectValue placeholder="Add to day" />
                              </SelectTrigger>
                              <SelectContent>
                                {trip.days.map((day, i) => (
                                  <SelectItem key={day.id} value={day.id} className="text-xs">
                                    {day.label ?? `Day ${i + 1}`} · {format(new Date(day.date), "MMM d")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Planning tab */}
        {activeTab === "planning" && (
          <div className="space-y-3">
            {/* Add item form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createActionItem() }}
                placeholder="Add an action item…"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-background"
              />
              <Select value={newItemAssigneeId} onValueChange={(v) => setNewItemAssigneeId(v ?? "")}>
                <SelectTrigger className="h-9 w-36 text-xs rounded-xl">
                  <span className="truncate text-xs text-left flex-1">
                    {eventMembers.find((m) => m.userId === newItemAssigneeId)?.user.name ?? <span className="text-muted-foreground">Assign to…</span>}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs text-gray-400">Unassigned</SelectItem>
                  {eventMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId} className="text-xs">
                      {m.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 h-9"
                disabled={addingItem || !newItemTitle.trim()}
                onClick={createActionItem}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {actionItems.length === 0 ? (
              <Card className="border-0 shadow-sm border-dashed border-2 border-gray-200">
                <CardContent className="py-10 text-center text-gray-400">
                  <p className="font-medium">No action items yet</p>
                  <p className="text-sm mt-1">Add tasks above to track what needs to be done</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {actionItems.map((item) => (
                  <div key={item.id} className="space-y-0">
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:bg-accent/40 group transition-colors">
                      {/* Status toggle */}
                      <button
                        title={`Status: ${item.status} — click to advance`}
                        onClick={() => cycleActionItemStatus(item)}
                        className="shrink-0 transition-colors"
                      >
                        {item.status === "OPEN" && <Circle className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                        {item.status === "IN_PROGRESS" && <Clock3 className="h-5 w-5 text-amber-500 hover:text-amber-600" />}
                        {item.status === "DONE" && <CheckCircle2 className="h-5 w-5 text-emerald-500 hover:text-emerald-600" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        {editingItemId === item.id ? (
                          <input
                            autoFocus
                            value={editingItemTitle}
                            onChange={(e) => setEditingItemTitle(e.target.value)}
                            onBlur={() => saveActionItemTitle(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); saveActionItemTitle(item.id) }
                              if (e.key === "Escape") setEditingItemId(null)
                            }}
                            className="w-full text-sm font-medium bg-transparent border-b border-indigo-400 outline-none pb-0.5"
                          />
                        ) : (
                          <>
                            <p
                              className={`text-sm font-medium leading-snug hidden md:block cursor-text ${item.status === "DONE" ? "line-through text-gray-400" : "text-gray-900"}`}
                              onClick={() => { setEditingItemId(item.id); setEditingItemTitle(item.title) }}
                            >
                              {item.title}
                            </p>
                            <p className={`text-sm font-medium leading-snug md:hidden ${item.status === "DONE" ? "line-through text-gray-400" : "text-gray-900"}`}>
                              {item.title}
                            </p>
                          </>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs font-medium ${
                            item.status === "OPEN" ? "text-gray-400" :
                            item.status === "IN_PROGRESS" ? "text-amber-600" : "text-emerald-600"
                          }`}>
                            {item.status === "OPEN" ? "Open" : item.status === "IN_PROGRESS" ? "In progress" : "Done"}
                          </span>
                          {item.expense && (
                            <span className="text-xs text-indigo-500 font-medium">
                              · {formatCurrency(item.expense.amount, trip.group.currency)} logged
                            </span>
                          )}
                          <span className="text-xs text-gray-400">· by {item.createdBy.name}</span>
                        </div>
                      </div>

                      {/* Assignee picker */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={item.assignee?.id ?? ""}
                          onValueChange={(val) => assignActionItem(item.id, val === "" ? null : val)}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs border-dashed rounded-lg">
                            <span className="truncate text-xs text-left flex-1">
                              {item.assignee?.name ?? <span className="text-muted-foreground">Assign…</span>}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="" className="text-xs text-gray-400">Unassigned</SelectItem>
                            {eventMembers.map((m) => (
                              <SelectItem key={m.userId} value={m.userId} className="text-xs">
                                {m.user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {editingItemId !== item.id && (
                        <button
                          onClick={() => { setEditingItemId(item.id); setEditingItemTitle(item.title) }}
                          className="md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-all shrink-0"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteActionItem(item.id)}
                        className="md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-all shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Done prompt */}
                    {donePromptItemId === item.id && !item.expense && (
                      <div className="ml-8 mt-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 flex-1">
                          Was money spent on this? Log an expense linked to this event.
                        </p>
                        <AddExpenseDialog
                          groupId={trip.group.id}
                          currency={trip.group.currency}
                          members={trip.group.members}
                          currentUserId={userId}
                          tripId={trip.id}
                          onCreated={async () => {
                            setDonePromptItemId(null)
                            await refreshTrip()
                            await refreshActionItems()
                          }}
                          trigger={
                            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 px-2.5 py-1 rounded-lg transition-colors shrink-0">
                              Add expense
                            </button>
                          }
                        />
                        <button
                          onClick={() => setDonePromptItemId(null)}
                          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Event Expenses tab */}
        {activeTab === "expenses" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Expenses linked directly to this event</p>
              <AddExpenseDialog
                groupId={trip.group.id}
                currency={trip.group.currency}
                members={trip.group.members}
                currentUserId={userId}
                tripId={trip.id}
                onCreated={async () => { await refreshTrip() }}
                trigger={
                  <button className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 px-2.5 py-1.5 rounded-lg transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add expense
                  </button>
                }
              />
            </div>

            {trip.eventExpenses.length === 0 ? (
              <Card className="border-0 shadow-sm border-dashed border-2 border-gray-200">
                <CardContent className="py-10 text-center text-gray-400">
                  <p className="font-medium">No event expenses yet</p>
                  <p className="text-sm mt-1">Expenses added here are linked to this event, not a specific day</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {trip.eventExpenses.map((expense, idx) => (
                    <div key={expense.id}>
                      {idx > 0 && <Separator />}
                      <div className="flex items-center gap-3 p-4 hover:bg-gray-50 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                            <Badge variant="secondary" className="text-xs shrink-0">{expense.category}</Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Paid by {expense.paidBy.name} · {format(new Date(expense.date), "MMM d")}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 shrink-0">
                          {formatCurrency(expense.amount, trip.group.currency)}
                        </p>
                        <EditExpenseDialog
                          expense={expense}
                          members={trip.group.members}
                          currency={trip.group.currency}
                          onUpdated={refreshTrip}
                        />
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete "${expense.description}"?`)) return
                            const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" })
                            if (res.ok) { toast.success("Expense deleted"); await refreshTrip() }
                            else toast.error("Failed to delete expense")
                          }}
                          className="md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-all shrink-0"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
