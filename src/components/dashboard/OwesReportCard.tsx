"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/balance"

interface FriendBalance {
  userId: string
  name: string
  avatar: string | null
  netBalance: number
  currency: string
  groups: { id: string; name: string; balance: number }[]
}

function PersonRow({ f }: { f: FriendBalance }) {
  const isOwed = f.netBalance > 0
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <Avatar className="h-9 w-9 shrink-0">
        {f.avatar && <AvatarImage src={f.avatar} alt={f.name} className="object-cover" />}
        <AvatarFallback
          className={`text-sm font-semibold ${
            isOwed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                   : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"
          }`}
        >
          {f.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{f.name}</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {f.groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="text-[10px] text-muted-foreground bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded transition-colors"
            >
              {g.name}
            </Link>
          ))}
        </div>
      </div>

      <p
        className={`text-sm font-bold tabular-nums shrink-0 ${
          isOwed ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {formatCurrency(Math.abs(f.netBalance), f.currency)}
      </p>
    </div>
  )
}

export function OwesReportCard() {
  const [balances, setBalances] = useState<FriendBalance[] | null>(null)

  useEffect(() => {
    fetch("/api/friends/balances")
      .then((r) => (r.ok ? r.json() : []))
      .then(setBalances)
  }, [])

  if (balances === null) {
    return (
      <Card className="border-0 shadow-none glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground/70">Who Owes Who</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </CardContent>
      </Card>
    )
  }

  const owedToYou = balances.filter((f) => f.netBalance > 0)
  const youOwe = balances.filter((f) => f.netBalance < 0)

  const totalOwedToYou = owedToYou.reduce((s, f) => s + f.netBalance, 0)
  const totalYouOwe = youOwe.reduce((s, f) => s + Math.abs(f.netBalance), 0)

  if (balances.length === 0) {
    return (
      <Card className="border-0 shadow-none glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground/70">Who Owes Who</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
            <p className="text-sm font-medium text-foreground">All settled up!</p>
            <p className="text-xs text-muted-foreground mt-1">No outstanding balances with anyone.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-none glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground/70">Who Owes Who</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {/* Owed to you */}
          <div>
            <div className="flex items-center gap-1.5 mb-1 mt-2">
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                Owed to you
              </p>
              {owedToYou.length > 0 && (
                <span className="ml-auto text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(totalOwedToYou)}
                </span>
              )}
            </div>
            {owedToYou.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nobody owes you right now</p>
            ) : (
              owedToYou.map((f) => <PersonRow key={f.userId} f={f} />)
            )}
          </div>

          {/* You owe */}
          <div>
            <div className="flex items-center gap-1.5 mb-1 mt-2">
              <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                You owe
              </p>
              {youOwe.length > 0 && (
                <span className="ml-auto text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatCurrency(totalYouOwe)}
                </span>
              )}
            </div>
            {youOwe.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">You don&apos;t owe anyone</p>
            ) : (
              youOwe.map((f) => <PersonRow key={f.userId} f={f} />)
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
