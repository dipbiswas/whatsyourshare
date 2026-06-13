"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/balance"
import { cn } from "@/lib/utils"

interface FriendBalance {
  userId: string
  name: string
  avatar: string | null
  netBalance: number
  currency: string
  groups: { id: string; name: string; balance: number }[]
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function avatarColor(id: string) {
  const colors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500",
    "bg-amber-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500",
  ]
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return colors[Math.abs(hash) % colors.length]
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/friends/balances")
      .then((r) => r.json())
      .then((d) => setFriends(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const youAreOwed = friends.filter((f) => f.netBalance > 0.01)
  const youOwe = friends.filter((f) => f.netBalance < -0.01)
  const settled = friends.filter((f) => Math.abs(f.netBalance) <= 0.01)

  const totalOwed = youAreOwed.reduce((s, f) => s + f.netBalance, 0)
  const totalOwe = youOwe.reduce((s, f) => s + Math.abs(f.netBalance), 0)

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Friends</h1>
        <p className="text-sm text-muted-foreground mt-0.5">People you've shared expenses with</p>
      </div>

      {/* Summary */}
      {!loading && friends.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">You are owed</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatCurrency(totalOwed)}
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">
              across {youAreOwed.length} {youAreOwed.length === 1 ? "person" : "people"}
            </p>
          </div>
          <div className="rounded-2xl p-4 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-400 mb-1">You owe</p>
            <p className="text-xl font-bold text-rose-700 dark:text-rose-300 tabular-nums">
              {formatCurrency(totalOwe)}
            </p>
            <p className="text-xs text-rose-600/70 dark:text-rose-400/60 mt-0.5">
              across {youOwe.length} {youOwe.length === 1 ? "person" : "people"}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && friends.length === 0 && (
        <div className="text-center py-24">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground/70">No friends yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add members to a group and split some expenses to see them here.
          </p>
        </div>
      )}

      {/* They owe you */}
      {youAreOwed.length > 0 && (
        <Section title="They owe you" icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}>
          {youAreOwed.map((f) => <FriendRow key={f.userId} friend={f} />)}
        </Section>
      )}

      {/* You owe them */}
      {youOwe.length > 0 && (
        <Section title="You owe" icon={<TrendingDown className="h-4 w-4 text-rose-500" />}>
          {youOwe.map((f) => <FriendRow key={f.userId} friend={f} />)}
        </Section>
      )}

      {/* Settled */}
      {settled.length > 0 && (
        <Section title="Settled up" icon={<Minus className="h-4 w-4 text-muted-foreground" />} muted>
          {settled.map((f) => <FriendRow key={f.userId} friend={f} />)}
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  icon,
  muted,
  children,
}: {
  title: string
  icon: React.ReactNode
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className={cn("text-xs font-semibold uppercase tracking-wider", muted ? "text-muted-foreground/60" : "text-muted-foreground")}>
          {title}
        </p>
      </div>
      <div className="glass rounded-2xl overflow-hidden divide-y divide-border/60">
        {children}
      </div>
    </div>
  )
}

function FriendRow({ friend: f }: { friend: FriendBalance }) {
  const settled = Math.abs(f.netBalance) <= 0.01
  const owedToMe = f.netBalance > 0.01

  return (
    <div className="px-4 py-3.5 flex items-center gap-3">
      {/* Avatar */}
      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(f.userId))}>
        {initials(f.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{f.name}</p>
        <div className="flex flex-wrap gap-x-2 mt-0.5">
          {f.groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="text-xs text-muted-foreground hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            >
              {g.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Balance */}
      <div className="text-right shrink-0">
        {settled ? (
          <span className="text-xs text-muted-foreground font-medium">Settled</span>
        ) : (
          <>
            <p className={cn(
              "text-sm font-bold tabular-nums",
              owedToMe ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {owedToMe ? "+" : "-"}{formatCurrency(Math.abs(f.netBalance), f.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {owedToMe ? "owes you" : "you owe"}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
