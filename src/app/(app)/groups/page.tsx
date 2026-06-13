"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Receipt, Plus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog"
import { formatDistanceToNow } from "date-fns"

const GROUP_ACCENTS = [
  "from-violet-400 to-violet-600",
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

interface Group {
  id: string
  name: string
  description: string | null
  currency: string
  _count: { expenses: number }
  members: Member[]
  updatedAt: string
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Groups</h1>
          <p className="text-sm text-white/50 mt-0.5">{groups.length > 0 ? `${groups.length} group${groups.length !== 1 ? "s" : ""}` : "Split expenses with anyone"}</p>
        </div>
        <CreateGroupDialog onCreated={(g) => setGroups((prev) => [g as Group, ...prev])} />
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="text-center py-24">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-violet-500/15 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-white/80">No groups yet</h3>
          <p className="text-white/50 mt-1 text-sm">Create your first group to start splitting expenses.</p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, idx) => {
            const accent = GROUP_ACCENTS[idx % GROUP_ACCENTS.length]
            return (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <div className="glass rounded-2xl hover:bg-white/10 transition-all duration-200 overflow-hidden hover:border-white/20 h-full flex flex-col">
                  {/* Colored accent bar */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} />

                  <div className="p-5 flex flex-col flex-1 gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-base leading-tight">{group.name}</h3>
                        {group.description && (
                          <p className="text-xs text-white/50 mt-1 line-clamp-1">{group.description}</p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-white/60 bg-white/10 px-2 py-1 rounded-lg shrink-0">
                        {group.currency}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <Receipt className="h-3.5 w-3.5" />
                        {group._count.expenses} expense{group._count.expenses !== 1 ? "s" : ""}
                      </span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(group.updatedAt), { addSuffix: true })}</span>
                    </div>

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
                          <div className="h-8 w-8 rounded-full ring-2 ring-white/20 bg-white/10 flex items-center justify-center text-xs text-white/50 font-semibold">
                            +{group.members.length - 5}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-white/50">
                        <Users className="h-3.5 w-3.5" />
                        {group.members.length}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}

          {/* Create new group card */}
          <CreateGroupDialog
            onCreated={(g) => setGroups((prev) => [g as Group, ...prev])}
            trigger={
              <div className="glass rounded-2xl border-2 border-dashed border-white/15 hover:border-violet-400/50 hover:bg-violet-500/10 transition-all duration-200 h-full min-h-[176px] flex flex-col items-center justify-center gap-2 cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-white/40" />
                </div>
                <p className="text-sm font-medium text-white/40">New group</p>
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}
