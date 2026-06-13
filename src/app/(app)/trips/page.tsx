"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { MapPin, Calendar, Users, Wallet, CalendarDays } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/balance"

interface Trip {
  id: string
  name: string
  destination: string | null
  coverEmoji: string | null
  eventType: string
  startDate: string
  endDate: string
  group: { id: string; name: string; currency: string }
  _count: { days: number }
  fund: { id: string; status: string; targetAmount: number; currency: string } | null
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then(setTrips)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-5 md:p-8 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Events</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Time-bounded events within a group — track spending for a specific trip, celebration, dinner, or project separately from your group&apos;s everyday expenses.
        </p>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground/70 mb-1">No events yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Events live inside groups. Open a group and create an event to get started.
          </p>

          {/* Explainer */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left">
            {[
              {
                icon: "👥",
                title: "Group = who",
                body: "A permanent space for a set of people — roommates, a team, a couple.",
              },
              {
                icon: "🎉",
                title: "Event = what + when",
                body: "A trip, celebration, dinner, or project with dates. Track it separately from everyday expenses.",
              },
              {
                icon: "📊",
                title: "Separate totals",
                body: "Event expenses are tracked on their own so you can see exactly what that event cost.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="glass rounded-2xl p-4">
                <p className="text-2xl mb-2">{icon}</p>
                <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <Link href="/groups" className="inline-block mt-6 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            Go to a group to create an event →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((trip) => {
            const now = new Date()
            const start = new Date(trip.startDate)
            const end = new Date(trip.endDate)
            const status = now < start ? "upcoming" : now > end ? "past" : "active"

            return (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <div className="glass rounded-2xl p-5 space-y-3 hover:bg-accent/30 transition-colors cursor-pointer h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{trip.coverEmoji ?? "✈️"}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{trip.name}</p>
                        {trip.destination && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {trip.destination}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          status === "active"
                            ? "border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                            : status === "upcoming"
                            ? "border-indigo-300 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {(trip.eventType ?? "TRIP").toLowerCase()}
                      </span>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {format(start, "MMM d")} – {format(end, "MMM d, yyyy")}
                  </div>

                  {/* Group + fund */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {trip.group.name}
                    </span>
                    {trip.fund && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Wallet className="h-3.5 w-3.5" />
                        {formatCurrency(trip.fund.targetAmount, trip.fund.currency)} fund
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
