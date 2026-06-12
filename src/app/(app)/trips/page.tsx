"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { MapPin, Calendar, Users, Wallet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/balance"

interface Trip {
  id: string
  name: string
  destination: string | null
  coverEmoji: string | null
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
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
        <p className="text-gray-500 mt-1">All your planned and past group trips</p>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-4xl mb-3">✈️</p>
          <p className="font-medium">No trips yet</p>
          <p className="text-sm mt-1">Create a trip from any group page</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((trip) => {
            const now = new Date()
            const start = new Date(trip.startDate)
            const end = new Date(trip.endDate)
            const status =
              now < start ? "upcoming" : now > end ? "past" : "active"

            return (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-5 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{trip.coverEmoji ?? "✈️"}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{trip.name}</p>
                          {trip.destination && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              {trip.destination}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${
                          status === "active"
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                            : status === "upcoming"
                            ? "border-violet-300 text-violet-700 bg-violet-50"
                            : "border-gray-200 text-gray-500"
                        }`}
                      >
                        {status}
                      </Badge>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(start, "MMM d")} – {format(end, "MMM d, yyyy")}
                    </div>

                    {/* Group + stats */}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {trip.group.name}
                      </span>
                      {trip.fund && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <Wallet className="h-3.5 w-3.5" />
                          {formatCurrency(trip.fund.targetAmount, trip.fund.currency)} fund
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
