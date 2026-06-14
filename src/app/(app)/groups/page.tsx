"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Users, Receipt, Plus, Search, X, CheckCircle2, TrendingUp, TrendingDown, Crown, UserCheck, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog"
import { QuickSplitBanner } from "@/components/layout/QuickSplitBanner"
import { formatDistanceToNow } from "date-fns"

interface PlanStatus {
  plan: string
  groupCount: number
  maxGroups: number | null
}

const GROUP_ACCENTS = [
  "from-indigo-400 to-indigo-600",
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-orange-400 to-orange-600",
  "from-pink-400 to-pink-600",
  "from-teal-400 to-teal-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
]

interface Member {
  userId: string
  user: { id: string; name: string; email: string; avatar: string | null }
}

interface ActiveTrip {
  id: string
  name: string
  coverEmoji: string | null
  eventType: string
  startDate: string
  endDate: string
}

interface Group {
  id: string
  name: string
  description: string | null
  currency: string
  _count: { expenses: number }
  members: Member[]
  updatedAt: string
  myBalance: number
  activeTrips: ActiveTrip[]
  isOwner: boolean
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null)

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
    fetch("/api/plan-status")
      .then((r) => r.json())
      .then((data) => setPlanStatus(data))
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups.filter((g) =>
      g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    )
  }, [groups, search])

  const myGroups = filtered.filter((g) => g.isOwner)
  const memberGroups = filtered.filter((g) => !g.isOwner)

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-6xl mr-auto">
      <QuickSplitBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Groups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{groups.length > 0 ? `${groups.length} group${groups.length !== 1 ? "s" : ""}` : "Split expenses with anyone"}</p>
        </div>
        <CreateGroupDialog onCreated={(g) => setGroups((prev) => [g as Group, ...prev])} />
      </div>

      {planStatus?.maxGroups !== null && planStatus?.maxGroups !== undefined && planStatus.groupCount >= planStatus.maxGroups && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Group limit reached</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              You&apos;ve used {planStatus.groupCount} of {planStatus.maxGroups} groups on your {planStatus.plan} plan.{" "}
              <Link href="/settings" className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200">Upgrade to Pro</Link> for unlimited groups.
            </p>
          </div>
        </div>
      )}

      {groups.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search groups…"
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
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="text-center py-24">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground/80">No groups yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">Create your first group to start splitting expenses.</p>
        </div>
      )}

      {!loading && groups.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No groups match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch("")} className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Clear search</button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-8">
          {[
            { label: "My Groups", icon: Crown, groups: myGroups, showCreate: true },
            { label: "Member of", icon: UserCheck, groups: memberGroups, showCreate: false },
          ].filter((s) => s.groups.length > 0 || s.showCreate).map((section) => (
            <div key={section.label}>
              <div className="flex items-center gap-2 mb-3">
                <section.icon className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{section.label}</h2>
                <span className="text-xs text-muted-foreground/60">({section.groups.length})</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.groups.map((group, idx) => {
            const accent = GROUP_ACCENTS[idx % GROUP_ACCENTS.length]
            return (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <div className="glass rounded-2xl hover:bg-accent/50 transition-all duration-200 overflow-hidden hover:border-border h-full flex flex-col">
                  {/* Colored accent bar */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} />

                  <div className="p-5 flex flex-col flex-1 gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-base leading-tight">{group.name}</h3>
                        {group.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{group.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {group._count.expenses > 0 && Math.abs(group.myBalance) < 0.01 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Settled
                          </span>
                        )}
                        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                          {group.currency}
                        </span>
                      </div>
                    </div>

                    {/* Active / upcoming events */}
                    {group.activeTrips?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {group.activeTrips.slice(0, 3).map((t) => {
                          const now = new Date()
                          const isActive = new Date(t.startDate) <= now && new Date(t.endDate) >= now
                          return (
                            <span
                              key={t.id}
                              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                isActive
                                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                  : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20"
                              }`}
                            >
                              {t.coverEmoji ?? "📅"} {t.name}
                            </span>
                          )
                        })}
                        {group.activeTrips.length > 3 && (
                          <span className="text-[11px] text-muted-foreground px-1">+{group.activeTrips.length - 3} more</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Receipt className="h-3.5 w-3.5" />
                        {group._count.expenses} expense{group._count.expenses !== 1 ? "s" : ""}
                      </span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(group.updatedAt), { addSuffix: true })}</span>
                    </div>

                    {/* Balance */}
                    {group._count.expenses > 0 && Math.abs(group.myBalance) >= 0.01 && (
                      <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl w-fit ${
                        group.myBalance > 0
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}>
                        {group.myBalance > 0
                          ? <><TrendingUp className="h-3.5 w-3.5" /> You&apos;re owed {group.currency} {Math.abs(group.myBalance).toFixed(2)}</>
                          : <><TrendingDown className="h-3.5 w-3.5" /> You owe {group.currency} {Math.abs(group.myBalance).toFixed(2)}</>
                        }
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex -space-x-2">
                        {group.members.slice(0, 5).map((m, i) => (
                          <Avatar key={m.userId} className="h-8 w-8 ring-2 ring-white" style={{ zIndex: 5 - i }}>
                            <AvatarFallback className="text-xs font-bold" style={{ background: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 70%, 85%)`, color: `hsl(${(m.userId.charCodeAt(0) * 37) % 360}, 60%, 35%)` }}>
                              {m.user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {group.members.length > 5 && (
                          <div className="h-8 w-8 rounded-full ring-2 ring-border bg-muted flex items-center justify-center text-xs text-muted-foreground font-semibold">
                            +{group.members.length - 5}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {group.members.length}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}

                {/* Create new group card — only in My Groups section */}
                {section.showCreate && (
                  <CreateGroupDialog
                    onCreated={(g) => setGroups((prev) => [g as Group, ...prev])}
                    trigger={
                      <div className="glass rounded-2xl border-2 border-dashed border-border hover:border-indigo-400/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all duration-200 h-full min-h-[176px] flex flex-col items-center justify-center gap-2 cursor-pointer">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">New group</p>
                      </div>
                    }
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
