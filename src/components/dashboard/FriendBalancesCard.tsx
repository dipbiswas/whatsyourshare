"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingDown, TrendingUp, Globe } from "lucide-react"
import { formatCurrency } from "@/lib/balance"

interface FriendBalance {
  userId: string
  name: string
  avatar: string | null
  netBalance: number
  currency: string
  groups: { id: string; name: string; balance: number }[]
}

export function FriendBalancesCard() {
  const [balances, setBalances] = useState<FriendBalance[] | null>(null)

  useEffect(() => {
    fetch("/api/friends/balances")
      .then((r) => (r.ok ? r.json() : []))
      .then(setBalances)
  }, [])

  if (balances === null) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Friend Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </CardContent>
      </Card>
    )
  }

  if (balances.length === 0) return null

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-indigo-600" />
          <CardTitle className="text-base font-semibold">Across All Groups</CardTitle>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Your net balances with each person</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {balances.map((f) => (
          <div key={f.userId} className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback
                className={`text-sm font-semibold ${
                  f.netBalance > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                }`}
              >
                {f.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{f.name}</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {f.groups.map((g) => (
                  <span key={g.id} className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 justify-end">
                {f.netBalance > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    f.netBalance > 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {formatCurrency(Math.abs(f.netBalance), f.currency)}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {f.netBalance > 0 ? "owes you" : "you owe"}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
