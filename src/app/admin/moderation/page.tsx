"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { ShieldAlert, ChevronLeft, ChevronRight, RefreshCw, Trash2, AlertTriangle, X, Check } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

type FlagStatus = "PENDING" | "DISMISSED" | "ACTIONED"

interface Flag {
  id: string
  entityType: string
  entityId: string
  entitySnap: string
  entityLabel: string | null
  entityAuthorName: string | null
  groupId: string | null
  reason: string
  autoFlagged: boolean
  status: FlagStatus
  createdAt: string
  resolveNote: string | null
  resolvedAt: string | null
  resolvedBy: { name: string } | null
  reportedBy: { name: string; email: string } | null
}

const REASON_COLORS: Record<string, string> = {
  profanity:   "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  harassment:  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  spam:        "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
}

const ENTITY_LABELS: Record<string, string> = {
  EXPENSE: "Expense", GROUP: "Group", TRIP: "Event",
  ACTION_ITEM: "Action item", RECURRING_EXPENSE: "Recurring",
}

export default function ModerationPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<FlagStatus>("PENDING")
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/moderation?status=${status}&page=${page}`)
      const data = await res.json()
      setFlags(data.flags)
      setTotal(data.total)
      setPages(data.pages)
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [status])

  async function resolve(flagId: string, action: string, note?: string) {
    setActioning(flagId)
    try {
      const res = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagId, action, note }),
      })
      if (!res.ok) { toast.error("Action failed"); return }
      toast.success(action === "dismiss" ? "Dismissed" : action === "delete_content" ? "Content deleted" : "User warned")
      setNoteFor(null)
      setNoteText("")
      load()
    } finally {
      setActioning(null)
    }
  }

  const statusTabs: { value: FlagStatus; label: string }[] = [
    { value: "PENDING",   label: "Pending" },
    { value: "DISMISSED", label: "Dismissed" },
    { value: "ACTIONED",  label: "Actioned" },
  ]

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            Moderation
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} {status.toLowerCase()} flag{total !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {statusTabs.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              status === value ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Flag list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : flags.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center mb-3">
            <Check className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No {status.toLowerCase()} flags</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <div key={flag.id} className="glass rounded-2xl p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted px-2 py-0.5 rounded-md">
                    {ENTITY_LABELS[flag.entityType] ?? flag.entityType}
                  </span>
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", REASON_COLORS[flag.reason] ?? "bg-muted text-muted-foreground")}>
                    {flag.reason}
                  </span>
                  {flag.autoFlagged && (
                    <span className="text-xs text-muted-foreground">auto-flagged</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true })}
                </span>
              </div>

              {/* Content snapshot */}
              <div className="rounded-lg bg-muted/50 border border-border/60 px-3 py-2.5">
                <p className="text-sm text-foreground font-medium leading-snug">
                  &ldquo;{flag.entitySnap}&rdquo;
                </p>
                {(flag.entityAuthorName || flag.entityLabel) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {flag.entityAuthorName && <>by <span className="font-medium">{flag.entityAuthorName}</span></>}
                    {flag.entityLabel && flag.entityLabel !== flag.entitySnap && (
                      <> · in &ldquo;{flag.entityLabel}&rdquo;</>
                    )}
                  </p>
                )}
              </div>

              {/* Resolution info (for non-pending) */}
              {flag.status !== "PENDING" && (
                <p className="text-xs text-muted-foreground">
                  {flag.status === "DISMISSED" ? "Dismissed" : "Actioned"} by{" "}
                  <span className="font-medium">{flag.resolvedBy?.name ?? "admin"}</span>
                  {flag.resolveNote && <> — {flag.resolveNote}</>}
                </p>
              )}

              {/* Note input */}
              {noteFor === flag.id && (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note (optional)…"
                    className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <button onClick={() => { setNoteFor(null); setNoteText("") }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Actions (pending only) */}
              {flag.status === "PENDING" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 text-muted-foreground"
                    disabled={actioning === flag.id}
                    onClick={() => resolve(flag.id, "dismiss", noteFor === flag.id ? noteText : undefined)}
                  >
                    <Check className="h-3.5 w-3.5" /> Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                    disabled={actioning === flag.id}
                    onClick={() => resolve(flag.id, "warn_user", noteFor === flag.id ? noteText : undefined)}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Warn user
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700"
                    disabled={actioning === flag.id}
                    onClick={() => resolve(flag.id, "delete_content", noteFor === flag.id ? noteText : undefined)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete content
                  </Button>
                  <button
                    onClick={() => setNoteFor(noteFor === flag.id ? null : flag.id)}
                    className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                  >
                    {noteFor === flag.id ? "Hide note" : "Add note"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page === pages} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
