"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Settings, RefreshCw, Check, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ConfigRow {
  key: string
  value: string
  label: string
  description: string | null
  group: string
  type: "number" | "boolean" | "string"
  updatedAt: string
  updatedBy: { name: string } | null
}

const GROUP_META: Record<string, { label: string; color: string }> = {
  platform: { label: "Platform",  color: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" },
  pricing:  { label: "Pricing",   color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  plans:    { label: "Plan limits",color: "bg-amber-50 dark:bg-amber-500/10 text-amberald-700 dark:text-amber-400" },
}

function formatDisplay(row: ConfigRow): string {
  if (row.type === "number") {
    const n = parseFloat(row.value)
    if (row.key.includes("fee_rate")) return `${(n * 100).toFixed(2)}%`
    if (row.key.includes("price_cents")) return `$${(n / 100).toFixed(2)}`
    if (n === 0 && row.key.includes("max_groups")) return "Unlimited"
    return String(n)
  }
  if (row.type === "boolean") return row.value === "true" ? "Yes" : "No"
  const s = row.value.replace(/^"|"$/g, "")
  return s || "(not set)"
}

function ConfigInput({ row, onSave }: { row: ConfigRow; onSave: (key: string, value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(row.key, draft)
      setEditing(false)
    } catch (e: any) {
      setError(e.message ?? "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(row.value); setEditing(true) }}
        className="text-sm font-mono font-semibold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2 py-1 rounded hover:bg-accent"
        title="Click to edit"
      >
        {formatDisplay(row)}
      </button>
    )
  }

  if (row.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <select
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="text-sm border border-border rounded-lg px-2 py-1 bg-background"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
        <button onClick={save} disabled={saving} className="text-xs text-emerald-600 hover:underline">
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        type={row.type === "number" ? "number" : "text"}
        step={row.key.includes("fee_rate") ? "0.001" : "1"}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(null) }}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
        className={cn(
          "text-sm font-mono border rounded-lg px-2 py-1 bg-background w-40 outline-none focus:ring-1 focus:ring-indigo-400",
          error ? "border-red-400" : "border-border"
        )}
      />
      <button onClick={save} disabled={saving} className="text-xs text-emerald-600 hover:underline disabled:opacity-50">
        {saving ? "…" : "Save"}
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

export default function AdminConfigPage() {
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch("/api/admin/config").then((r) => r.json())
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(key: string, value: string) {
    const res = await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? "Save failed")
    }
    const updated = await res.json()
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, ...updated } : r))
    toast.success("Config updated")
  }

  // Group rows by their group field
  const grouped = rows.reduce<Record<string, ConfigRow[]>>((acc, row) => {
    if (!acc[row.group]) acc[row.group] = []
    acc[row.group].push(row)
    return acc
  }, {})

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6 text-muted-foreground" />
            System Config
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live configuration — changes take effect within 60 seconds (cache TTL)
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/20 px-4 py-3 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Stripe price IDs and subscription prices control <strong>what is displayed</strong> in the UI.
          Actual billing amounts are always set in the Stripe dashboard — changing them here does not change what Stripe charges.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, groupRows]) => {
            const meta = GROUP_META[group] ?? { label: group, color: "bg-muted text-muted-foreground" }
            return (
              <div key={group} className="glass rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", meta.color)}>
                    {meta.label}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/20">
                      <th className="text-left px-5 py-2.5 font-medium text-muted-foreground w-1/3">Setting</th>
                      <th className="text-left px-5 py-2.5 font-medium text-muted-foreground w-1/4">Value</th>
                      <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupRows.map((row, i) => (
                      <tr key={row.key} className={cn("border-border/60 hover:bg-muted/20 transition-colors", i < groupRows.length - 1 && "border-b")}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground">{row.label}</p>
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono">{row.key}</p>
                        </td>
                        <td className="px-5 py-3">
                          <ConfigInput row={row} onSave={handleSave} />
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground leading-snug">
                          {row.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
