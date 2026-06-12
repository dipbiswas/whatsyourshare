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
import { formatCurrency } from "@/lib/balance"

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
  paidBy: { id: string; name: string }
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
  startDate: string
  endDate: string
  createdById: string
  createdBy: { id: string; name: string }
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

  const userId = session?.user.id ?? ""

  // Handle Stripe return
  useEffect(() => {
    const payment = searchParams.get("payment")
    const stripeSessionId = searchParams.get("session_id")
    if (payment === "success" && stripeSessionId) {
      fetch(`/api/payments/verify?sessionId=${stripeSessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "paid") toast.success("Payment confirmed! Your contribution is recorded.")
          else toast.error("Payment not confirmed yet — please refresh in a moment.")
        })
    } else if (payment === "cancelled") {
      toast("Payment cancelled.")
    }
  }, [searchParams])

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((data) => {
        setTrip(data)
        // Auto-expand all days on load
        setExpandedDays(new Set(data.days.map((d: TripDay) => d.id)))
      })
      .catch(() => router.push("/trips"))
      .finally(() => setLoading(false))
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
      // Refetch the full trip
      const updated = await fetch(`/api/trips/${id}`).then((r) => r.json())
      setTrip(updated)
      setExpandedDays(new Set(updated.days.map((d: TripDay) => d.id)))
      toast.success(`${updated.days.length} days generated!`)
    } finally {
      setGeneratingDays(false)
    }
  }

  async function linkExpenseToDay(expenseId: string, dayId: string | null) {
    const res = await fetch(`/api/trips/${id}/days`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link-expense", expenseId, dayId }),
    })
    if (!res.ok) { toast.error("Failed to link expense"); return }

    // Refresh trip
    const updated = await fetch(`/api/trips/${id}`).then((r) => r.json())
    setTrip(updated)
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
  if (!trip) return null

  const totalDays = differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1
  const totalSpent = trip.days
    .flatMap((d) => d.expenses)
    .reduce((s, e) => s + e.amount, 0)
  const isOrganizer = trip.createdById === userId

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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{trip.name}</h1>
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
                trip.group.members.length > 0 ? totalSpent / trip.group.members.length : 0,
                trip.group.currency
              )}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {trip.days.flatMap((d) => d.expenses).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trip Fund (Phase 4) */}
      <TripFundCard
        tripId={trip.id}
        tripName={trip.name}
        fund={trip.fund}
        currentUserId={userId}
        isOrganizer={isOrganizer}
        memberCount={trip.group.members.length}
        currency={trip.group.currency}
      />

      {/* Per-member cost breakdown */}
      {Object.keys(trip.memberSpend).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Per-person breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {trip.group.members.map((m) => {
                const spent = trip.memberSpend[m.userId] ?? 0
                return (
                  <div key={m.userId} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-semibold">
                        {m.user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {m.user.name}{m.userId === userId ? " (you)" : ""}
                      </p>
                      <p className="text-sm font-bold text-gray-900">
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

      {/* Itinerary Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Itinerary</h2>
          {trip.days.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
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
                <Card key={day.id} className="border-0 shadow-sm overflow-hidden">
                  {/* Day header */}
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
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 font-bold text-sm shrink-0">
                      {dayIdx + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">
                        {day.label ?? `Day ${dayIdx + 1}`}
                      </p>
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
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    )}
                  </button>

                  {/* Day expenses */}
                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {day.expenses.length === 0 ? (
                        <p className="text-sm text-gray-400 px-4 py-3">No expenses for this day</p>
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
      </div>

      {/* Unlinked expenses */}
      {trip.unlinkedExpenses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">
            Unlinked group expenses
            <span className="ml-2 text-sm font-normal text-gray-400">
              — assign these to a trip day
            </span>
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
  )
}
