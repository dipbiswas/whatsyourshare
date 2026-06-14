"use client"

import { useEffect, useState, useMemo } from "react"
import { format, isThisMonth, isThisWeek } from "date-fns"
import Link from "next/link"
import { Receipt, Search, X, SlidersHorizontal, ArrowUpDown, ChevronDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/balance"
import { cn } from "@/lib/utils"

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  category: string
  date: string
  createdAt: string
  group: { id: string; name: string }
  paidBy: { id: string; name: string }
  tripDay: { trip: { id: string; name: string; coverEmoji: string | null } } | null
  trip: { id: string; name: string; coverEmoji: string | null } | null
}

const CATEGORY_META: Record<string, { color: string; dot: string }> = {
  Food:          { color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400", dot: "bg-orange-400" },
  Transport:     { color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",         dot: "bg-blue-400" },
  Accommodation: { color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400", dot: "bg-purple-400" },
  Entertainment: { color: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",         dot: "bg-pink-400" },
  Utilities:     { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400", dot: "bg-yellow-400" },
  General:       { color: "bg-gray-100 text-gray-600 dark:bg-white/8 dark:text-muted-foreground",     dot: "bg-gray-400" },
  Other:         { color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",         dot: "bg-teal-400" },
}

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc"
const SORT_LABELS: Record<SortKey, string> = {
  "date-desc":   "Newest first",
  "date-asc":    "Oldest first",
  "amount-desc": "Highest amount",
  "amount-asc":  "Lowest amount",
}

function groupByDate(expenses: Expense[]) {
  const groups: Record<string, Expense[]> = {}
  for (const e of expenses) {
    const key = format(new Date(e.date), "yyyy-MM-dd")
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [defaultCurrency, setDefaultCurrency] = useState<string>("USD")

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.defaultCurrency) setDefaultCurrency(d.defaultCurrency) })
  }, [])
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [activeTrip, setActiveTrip] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>("date-desc")
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showGroupMenu, setShowGroupMenu] = useState(false)
  const [showTripMenu, setShowTripMenu] = useState(false)

  useEffect(() => {
    fetch("/api/expenses")
      .then((r) => r.json())
      .then((d) => setExpenses(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  // Derived data
  const categories = useMemo(() => {
    const seen = new Set<string>()
    expenses.forEach((e) => seen.add(e.category))
    return Array.from(seen).sort()
  }, [expenses])

  const groups = useMemo(() => {
    const map = new Map<string, string>()
    expenses.forEach((e) => map.set(e.group.id, e.group.name))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [expenses])

  const trips = useMemo(() => {
    const map = new Map<string, { name: string; emoji: string | null }>()
    expenses.forEach((e) => {
      const t = e.trip ?? e.tripDay?.trip
      if (t) map.set(t.id, { name: t.name, emoji: t.coverEmoji })
    })
    return Array.from(map.entries()).map(([id, { name, emoji }]) => ({ id, name, emoji }))
  }, [expenses])

  // Summary stats — grouped by currency so mixed groups don't cross-contaminate
  function sumByCurrency(list: Expense[]) {
    const map: Record<string, number> = {}
    for (const e of list) map[e.currency] = (map[e.currency] ?? 0) + e.amount
    return map
  }
  const totalByCurrency    = useMemo(() => sumByCurrency(expenses), [expenses])
  const thisMonthByCurrency = useMemo(() => sumByCurrency(expenses.filter((e) => isThisMonth(new Date(e.date)))), [expenses])
  const thisWeekByCurrency  = useMemo(() => sumByCurrency(expenses.filter((e) => isThisWeek(new Date(e.date), { weekStartsOn: 1 }))), [expenses])

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = [...expenses]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((e) =>
        e.description.toLowerCase().includes(q) ||
        e.group.name.toLowerCase().includes(q) ||
        e.paidBy.name.toLowerCase().includes(q)
      )
    }
    if (activeCategory) list = list.filter((e) => e.category === activeCategory)
    if (activeGroup)    list = list.filter((e) => e.group.id === activeGroup)
    if (activeTrip)     list = list.filter((e) => (e.trip?.id ?? e.tripDay?.trip?.id) === activeTrip)
    list.sort((a, b) => {
      if (sort === "date-desc")   return new Date(b.date).getTime() - new Date(a.date).getTime()
      if (sort === "date-asc")    return new Date(a.date).getTime() - new Date(b.date).getTime()
      if (sort === "amount-desc") return b.amount - a.amount
      if (sort === "amount-asc")  return a.amount - b.amount
      return 0
    })
    return list
  }, [expenses, search, activeCategory, activeGroup, sort])

  const grouped = useMemo(() =>
    sort === "date-desc" || sort === "date-asc" ? groupByDate(filtered) : null,
  [filtered, sort])

  const hasFilters = search || activeCategory || activeGroup || activeTrip
  const activeGroupName = groups.find((g) => g.id === activeGroup)?.name
  const activeTripName = trips.find((t) => t.id === activeTrip)?.name

  const clearFilters = () => {
    setSearch("")
    setActiveCategory(null)
    setActiveGroup(null)
    setActiveTrip(null)
  }

  return (
    <div className="p-5 md:p-8 space-y-5 max-w-3xl mr-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All expenses across your groups</p>
      </div>

      {/* Summary stats */}
      {!loading && expenses.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "All time",   map: totalByCurrency },
            { label: "This month", map: thisMonthByCurrency },
            { label: "This week",  map: thisWeekByCurrency },
          ].map(({ label, map }) => (
            <div key={label} className="glass rounded-2xl p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
              {Object.keys(map).length === 0 ? (
                <p className="text-lg font-bold text-foreground tabular-nums">—</p>
              ) : (
                <>
                  <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
                    {formatCurrency(map[defaultCurrency] ?? 0, defaultCurrency)}
                  </p>
                  {Object.entries(map)
                    .filter(([c]) => c !== defaultCurrency && map[c] > 0)
                    .map(([currency, amount]) => (
                      <p key={currency} className="text-xs text-muted-foreground tabular-nums leading-tight mt-0.5">
                        +{formatCurrency(amount, currency)}
                      </p>
                    ))}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search + controls */}
      {!loading && expenses.length > 0 && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search expenses, groups, people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 bg-background/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category chips — scrollable row */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat]
                const active = activeCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(active ? null : cat)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border shrink-0",
                      active
                        ? `${meta?.color ?? "bg-muted text-foreground"} border-transparent shadow-sm`
                        : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", meta?.dot ?? "bg-gray-400")} />
                    {cat}
                  </button>
                )
              })}
            </div>
          )}

          {/* Group filter + Sort — separate row so dropdowns are never clipped */}
          <div className="flex items-center gap-2">
            {/* Group filter */}
            <div className="relative">
              <button
                onClick={() => { setShowGroupMenu((v) => !v); setShowSortMenu(false) }}
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
                  <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-background border border-border rounded-xl shadow-xl py-1 overflow-hidden">
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

            {/* Event filter */}
            {trips.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setShowTripMenu((v) => !v); setShowGroupMenu(false); setShowSortMenu(false) }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                    activeTrip
                      ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-transparent"
                      : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  📅 {activeTripName ?? "All events"}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showTripMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowTripMenu(false)} />
                    <div className="absolute left-0 top-full mt-1 z-20 w-52 bg-background border border-border rounded-xl shadow-xl py-1 overflow-hidden">
                      <button
                        onClick={() => { setActiveTrip(null); setShowTripMenu(false) }}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors", !activeTrip && "font-semibold text-foreground")}
                      >
                        All events
                      </button>
                      {trips.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setActiveTrip(t.id); setShowTripMenu(false) }}
                          className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors truncate flex items-center gap-2", activeTrip === t.id && "font-semibold text-foreground")}
                        >
                          <span>{t.emoji ?? "📅"}</span>
                          <span className="truncate">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => { setShowSortMenu((v) => !v); setShowGroupMenu(false); setShowTripMenu(false) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all whitespace-nowrap"
              >
                <ArrowUpDown className="h-3 w-3" />
                {SORT_LABELS[sort]}
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 w-44 bg-background border border-border rounded-xl shadow-xl py-1 overflow-hidden">
                    {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setSort(key); setShowSortMenu(false) }}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors", sort === key && "font-semibold text-foreground")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Clear all */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          {/* Result count when filtering */}
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              {filtered.length > 0 && (
                <span className="ml-1">
                  · {Object.entries(sumByCurrency(filtered)).map(([cur, amt]) => formatCurrency(amt, cur)).join(" + ")} total
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && expenses.length === 0 && (
        <div className="text-center py-24">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Receipt className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground/70">No expenses yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add expenses inside a group to see them here.</p>
        </div>
      )}

      {/* No results after filter */}
      {!loading && expenses.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Search className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground/70">No matching expenses</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters</p>
          <button onClick={clearFilters} className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
            Clear all filters
          </button>
        </div>
      )}

      {/* Grouped by date (default sort) */}
      {!loading && grouped && grouped.map(([dateKey, items]) => (
        <div key={dateKey}>
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
            {format(new Date(dateKey), "EEEE, MMMM d")}
          </p>
          <div className="glass rounded-2xl overflow-hidden">
            {items.map((e, idx) => (
              <ExpenseRow key={e.id} expense={e} showDivider={idx > 0} />
            ))}
          </div>
        </div>
      ))}

      {/* Flat list (amount sort) */}
      {!loading && !grouped && filtered.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          {filtered.map((e, idx) => (
            <ExpenseRow key={e.id} expense={e} showDivider={idx > 0} showDate />
          ))}
        </div>
      )}
    </div>
  )
}

function ExpenseRow({ expense: e, showDivider, showDate }: { expense: Expense; showDivider: boolean; showDate?: boolean }) {
  const meta = CATEGORY_META[e.category]
  return (
    <div>
      {showDivider && <div className="h-px bg-border/60 mx-4" />}
      <Link
        href={`/groups/${e.group.id}`}
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/40 transition-colors"
      >
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", meta?.dot ?? "bg-gray-400")} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{e.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {e.group.name}
            {(e.trip ?? e.tripDay?.trip) && (
              <span className="text-indigo-600 dark:text-indigo-400">
                {" "}· {(e.trip ?? e.tripDay?.trip)!.coverEmoji ?? "📅"} {(e.trip ?? e.tripDay?.trip)!.name}
              </span>
            )}
            {" "}· {e.paidBy.name}
            {showDate && ` · ${format(new Date(e.date), "MMM d")}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(e.amount, e.currency)}</p>
          <p className="text-xs text-muted-foreground">{e.category}</p>
        </div>
      </Link>
    </div>
  )
}
