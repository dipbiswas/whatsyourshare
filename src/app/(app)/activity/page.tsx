"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns"
import { Activity, Receipt, DollarSign, UserPlus, Search, X, SlidersHorizontal, ChevronDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/balance"
import { cn } from "@/lib/utils"

type ActivityType = "expense" | "settlement" | "member_join"

interface ActivityItem {
  id: string
  type: ActivityType
  groupId: string
  groupName: string
  actorId: string
  actorName: string
  description: string
  amount?: number
  currency?: string
  involvedMe: boolean
  timestamp: string
}

const TYPE_META: Record<ActivityType, { icon: React.ElementType; color: string; label: string }> = {
  expense:     { icon: Receipt,    color: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400", label: "Expense" },
  settlement:  { icon: DollarSign, color: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400", label: "Settlement" },
  member_join: { icon: UserPlus,   color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400", label: "Member" },
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "EEEE, MMMM d")
}

function groupByDay(items: ActivityItem[]) {
  const groups: Record<string, ActivityItem[]> = {}
  for (const item of items) {
    const key = format(new Date(item.timestamp), "yyyy-MM-dd")
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeType, setActiveType] = useState<ActivityType | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [showGroupMenu, setShowGroupMenu] = useState(false)

  useEffect(() => {
    fetch("/api/activity?limit=100")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((i) => map.set(i.groupId, i.groupName))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [items])

  const filtered = useMemo(() => {
    let list = [...items]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((i) =>
        i.description.toLowerCase().includes(q) ||
        i.actorName.toLowerCase().includes(q) ||
        i.groupName.toLowerCase().includes(q)
      )
    }
    if (activeType) list = list.filter((i) => i.type === activeType)
    if (activeGroup) list = list.filter((i) => i.groupId === activeGroup)
    return list
  }, [items, search, activeType, activeGroup])

  const grouped = groupByDay(filtered)
  const hasFilters = search || activeType || activeGroup
  const activeGroupName = groups.find((g) => g.id === activeGroup)?.name

  return (
    <div className="p-5 md:p-8 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recent Activity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Everything happening across your groups</p>
      </div>

      {/* Controls */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search activity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {(Object.entries(TYPE_META) as [ActivityType, typeof TYPE_META[ActivityType]][]).map(([type, meta]) => {
              const active = activeType === type
              const Icon = meta.icon
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(active ? null : type)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap shrink-0",
                    active
                      ? `${meta.color} border-transparent shadow-sm`
                      : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}s
                </button>
              )
            })}
          </div>

          {/* Group filter + clear */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowGroupMenu((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                  activeGroup
                    ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-transparent"
                    : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <SlidersHorizontal className="h-3 w-3" />
                {activeGroupName ?? "All groups"}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showGroupMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowGroupMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 w-52 bg-background border border-border rounded-xl shadow-xl py-1 overflow-hidden">
                    <button
                      onClick={() => { setActiveGroup(null); setShowGroupMenu(false) }}
                      className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors", !activeGroup && "font-semibold text-foreground")}
                    >
                      All groups
                    </button>
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setActiveGroup(g.id); setShowGroupMenu(false) }}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors truncate", activeGroup === g.id && "font-semibold text-foreground")}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setActiveType(null); setActiveGroup(null) }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}

            {hasFilters && (
              <span className="text-xs text-muted-foreground ml-auto">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-24">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Activity className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground/70">No activity yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add expenses or settle up in a group to see activity here.</p>
        </div>
      )}

      {/* No results after filter */}
      {!loading && items.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm font-medium text-foreground/70">No matching activity</p>
          <button
            onClick={() => { setSearch(""); setActiveType(null); setActiveGroup(null) }}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Activity feed */}
      {!loading && grouped.map(([dateKey, dayItems]) => (
        <div key={dateKey}>
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
            {dayLabel(dateKey)}
          </p>
          <div className="glass rounded-2xl overflow-hidden">
            {dayItems.map((item, idx) => {
              const meta = TYPE_META[item.type]
              const Icon = meta.icon
              return (
                <div key={item.id}>
                  {idx > 0 && <div className="h-px bg-border/60 mx-4" />}
                  <Link
                    href={`/groups/${item.groupId}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/40 transition-colors"
                  >
                    {/* Icon bubble */}
                    <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", meta.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        <span className={item.actorName === "You" ? "text-indigo-600 dark:text-indigo-400" : ""}>
                          {item.actorName}
                        </span>
                        {" "}
                        {item.type === "expense" ? "added " : ""}{item.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.groupName} · {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Amount */}
                    {item.amount != null && (
                      <div className="text-right shrink-0">
                        <p className={cn(
                          "text-sm font-bold tabular-nums",
                          item.type === "settlement" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                        )}>
                          {item.type === "settlement" ? "+" : ""}{formatCurrency(item.amount, item.currency)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{meta.label}</p>
                      </div>
                    )}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
