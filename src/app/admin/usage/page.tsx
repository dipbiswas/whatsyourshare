"use client"

import { useEffect, useState } from "react"
import { Sparkles, Users, Receipt, ArrowRightLeft, Plane, RefreshCw, BarChart2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const PLAN_COLORS: Record<string, string> = {
  FREE:   "bg-muted text-muted-foreground",
  PRO:    "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
  FAMILY: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300",
}

interface UsageData {
  totalUsers: number
  payingUsers: number
  scansThisMonth: number
  topScanners: { user: { id: string; name: string; email: string; plan: string }; scans: number }[]
  groups: { total: number; thisMonth: number }
  expenses: { total: number; thisMonth: number }
  settlementsThisMonth: number
  trips: { total: number }
  recurringExpenses: { total: number }
  featureAdoption: { events: number; recurring: number }
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", color)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetch("/api/admin/usage")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="p-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
    </div>
  )
  if (!data) return null

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usage</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform activity and feature adoption</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Volume stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}    color="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"  label="Total users"       value={data.totalUsers}           sub={`${data.payingUsers} paying`} />
        <StatCard icon={Receipt}  color="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"  label="Expenses"          value={data.expenses.total}       sub={`${data.expenses.thisMonth} this month`} />
        <StatCard icon={BarChart2} color="bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400"         label="Groups"            value={data.groups.total}         sub={`${data.groups.thisMonth} this month`} />
        <StatCard icon={ArrowRightLeft} color="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" label="Settlements" value={data.settlementsThisMonth} sub="this month" />
        <StatCard icon={Sparkles} color="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"      label="AI scans"          value={data.scansThisMonth}       sub="this month (all users)" />
        <StatCard icon={Plane}    color="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"          label="Events / trips"    value={data.trips.total} />
        <StatCard icon={RefreshCw} color="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400" label="Recurring expenses" value={data.recurringExpenses.total} />
      </div>

      {/* Feature adoption — Pro users only */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Feature adoption (Pro+ users)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">% of paying users who have used each Pro feature</p>
        </div>
        <div className="space-y-3">
          {[
            { label: "Events / trips", pct: data.featureAdoption.events },
            { label: "Recurring expenses", pct: data.featureAdoption.recurring },
          ].map(({ label, pct }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top AI scan consumers */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Top AI scan consumers this month</h2>
        </div>
        {data.topScanners.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">No AI scans this month yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">User</th>
                <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Plan</th>
                <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Scans</th>
              </tr>
            </thead>
            <tbody>
              {data.topScanners.map(({ user, scans }, i) => (
                <tr key={user.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", PLAN_COLORS[user.plan])}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn("font-bold tabular-nums", i === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                      {scans}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
