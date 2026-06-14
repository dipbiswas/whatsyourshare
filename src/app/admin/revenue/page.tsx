"use client"

import { useEffect, useState } from "react"
import { DollarSign, Users, TrendingUp, TrendingDown, Zap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface RevenueData {
  mrr: number
  proCount: number
  familyCount: number
  freeCount: number
  totalUsers: number
  newPayingThisMonth: number
  newPayingLastMonth: number
  recentChurn: number
  usersWithBonusScans: number
  history: { label: string; newSubscribers: number }[]
  pricing: { pro: number; family: number; topupSmall: number; topupLarge: number }
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", color)}>
        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/revenue")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
    </div>
  )
  if (!data) return null

  const arr = data.newPayingThisMonth - data.newPayingLastMonth
  const arrDirection = arr >= 0 ? "up" : "down"

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Subscription and top-up overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          color="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          label="MRR"
          value={`$${data.mrr.toFixed(2)}`}
          sub={`$${(data.mrr * 12).toFixed(0)} ARR`}
        />
        <StatCard
          icon={Users}
          color="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
          label="Paying users"
          value={String(data.proCount + data.familyCount)}
          sub={`${data.proCount} Pro · ${data.familyCount} Family`}
        />
        <StatCard
          icon={arrDirection === "up" ? TrendingUp : TrendingDown}
          color={arrDirection === "up"
            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"}
          label="New paying this month"
          value={String(data.newPayingThisMonth)}
          sub={`${data.newPayingLastMonth} last month`}
        />
        <StatCard
          icon={TrendingDown}
          color="bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"
          label="Churn (30 days)"
          value={String(data.recentChurn)}
          sub="Downgrades to Free"
        />
      </div>

      {/* Subscriber breakdown */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Subscriber breakdown</h2>
        <div className="space-y-3">
          {[
            { label: "Free", count: data.freeCount, color: "bg-muted", price: null },
            { label: "Pro", count: data.proCount, color: "bg-indigo-500", price: `$${data.pricing.pro}/mo` },
            { label: "Family", count: data.familyCount, color: "bg-purple-500", price: `$${data.pricing.family}/mo` },
          ].map(({ label, count, color, price }) => {
            const pct = data.totalUsers > 0 ? (count / data.totalUsers) * 100 : 0
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
                    <span className="font-medium text-foreground">{label}</span>
                    {price && <span className="text-xs text-muted-foreground">{price}</span>}
                  </div>
                  <span className="text-muted-foreground">{count} <span className="text-xs">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top-up stats */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-foreground">Scan top-ups</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Users with bonus scans</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{data.usersWithBonusScans}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pack pricing</p>
            <p className="text-sm text-foreground mt-0.5">
              Small 10 scans — ${data.pricing.topupSmall}<br />
              Large 50 scans — ${data.pricing.topupLarge}
            </p>
          </div>
        </div>
      </div>

      {/* New subscriber history */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">New paying subscribers</h2>
        <div className="space-y-2">
          {data.history.map((row) => {
            const max = Math.max(...data.history.map((r) => r.newSubscribers), 1)
            const pct = (row.newSubscribers / max) * 100
            return (
              <div key={row.label} className="flex items-center gap-3 text-sm">
                <span className="w-14 text-right text-muted-foreground shrink-0">{row.label}</span>
                <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-md transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-muted-foreground shrink-0">{row.newSubscribers}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
