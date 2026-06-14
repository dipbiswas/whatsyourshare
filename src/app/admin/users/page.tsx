"use client"

import { useEffect, useState, useCallback } from "react"
import { Search, X, ChevronLeft, ChevronRight, Shield, ShieldOff } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

const PLAN_COLORS: Record<string, string> = {
  FREE:   "bg-muted text-muted-foreground",
  PRO:    "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
  FAMILY: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300",
}

interface AdminUser {
  id: string
  name: string
  email: string
  plan: "FREE" | "PRO" | "FAMILY"
  isAdmin: boolean
  bonusScans: number
  scansThisMonth: number
  groupCount: number
  createdAt: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [bonusInputs, setBonusInputs] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set("search", search)
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      setUsers(data.users)
      setTotal(data.total)
      setPages(data.pages)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  // Debounce search
  useEffect(() => { setPage(1) }, [search])

  async function updateUser(id: string, patch: Record<string, unknown>) {
    setSaving(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { toast.error("Update failed"); return }
      const updated = await res.json()
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...updated } : u))
      toast.success("Updated")
    } finally {
      setSaving(null)
    }
  }

  async function addBonusScans(user: AdminUser) {
    const add = parseInt(bonusInputs[user.id] ?? "0")
    if (!add || add <= 0) return
    await updateUser(user.id, { bonusScans: user.bonusScans + add })
    setBonusInputs((prev) => ({ ...prev, [user.id]: "" }))
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total users</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name or email…"
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

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Groups</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scans (mo)</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bonus scans</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="px-4 py-3" colSpan={7}><Skeleton className="h-5 w-full" /></td>
              </tr>
            ))}
            {!loading && users.map((user) => (
              <tr key={user.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                {/* User */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {user.isAdmin && <Shield className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </td>

                {/* Plan */}
                <td className="px-4 py-3">
                  <select
                    value={user.plan}
                    disabled={saving === user.id}
                    onChange={(e) => updateUser(user.id, { plan: e.target.value })}
                    className={cn(
                      "text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer appearance-none",
                      PLAN_COLORS[user.plan]
                    )}
                  >
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                    <option value="FAMILY">FAMILY</option>
                  </select>
                </td>

                {/* Groups */}
                <td className="px-4 py-3 text-muted-foreground">{user.groupCount}</td>

                {/* Scans this month */}
                <td className="px-4 py-3 text-muted-foreground">{user.scansThisMonth}</td>

                {/* Bonus scans */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground font-medium w-6">{user.bonusScans}</span>
                    <Input
                      type="number"
                      min="0"
                      placeholder="+n"
                      value={bonusInputs[user.id] ?? ""}
                      onChange={(e) => setBonusInputs((prev) => ({ ...prev, [user.id]: e.target.value }))}
                      className="w-16 h-7 text-xs px-2"
                    />
                    <button
                      onClick={() => addBonusScans(user)}
                      disabled={!bonusInputs[user.id] || saving === user.id}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </td>

                {/* Joined */}
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => updateUser(user.id, { isAdmin: !user.isAdmin })}
                    disabled={saving === user.id}
                    title={user.isAdmin ? "Remove admin" : "Make admin"}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {user.isAdmin
                      ? <ShieldOff className="h-4 w-4 text-rose-500" />
                      : <Shield className="h-4 w-4" />
                    }
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === pages}
              className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
