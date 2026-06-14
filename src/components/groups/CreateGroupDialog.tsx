"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Plus, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface PlanStatus {
  plan: string
  groupCount: number
  maxGroups: number | null
}

function UpgradePrompt({ used, max }: { used: number; max: number }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Group limit reached</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            You&apos;ve used {used} of {max} groups on the Free plan. Upgrade to Pro for unlimited groups.
          </p>
        </div>
      </div>
      <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2">
        <Zap className="h-3.5 w-3.5" />
        Upgrade to Pro — $4/month
      </Button>
    </div>
  )
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "SGD", "AED", "CHF"]

const SPLIT_TYPES = [
  { value: "EQUAL",      label: "Equal",      desc: "Split evenly between all members" },
  { value: "SHARES",     label: "Shares",     desc: "Proportional headcount — e.g. family of 4 vs 2" },
  { value: "PERCENTAGE", label: "Percentage", desc: "Each member pays a fixed %" },
  { value: "EXACT",      label: "Exact",      desc: "Enter exact amounts each time" },
]

interface Props {
  onCreated: (group: object) => void
  trigger?: React.ReactNode
}

export function CreateGroupDialog({ onCreated, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState("USD")
  const [form, setForm] = useState({ name: "", description: "", currency: "USD" })
  const [splitType, setSplitType] = useState("EQUAL")
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null)

  // Fetch user's default currency + plan status once
  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.defaultCurrency) {
          setDefaultCurrency(data.defaultCurrency)
          setForm((f) => ({ ...f, currency: data.defaultCurrency }))
        }
      })
      .catch(() => {})
    fetch("/api/plan-status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setPlanStatus(data) })
      .catch(() => {})
  }, [])

  const atGroupLimit = planStatus !== null && planStatus.maxGroups !== null && planStatus.groupCount >= planStatus.maxGroups

  function reset() {
    setForm({ name: "", description: "", currency: defaultCurrency })
    setSplitType("EQUAL")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          defaultSplitType: splitType,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.message ?? data.error ?? "Failed to create group")
        return
      }
      const group = await res.json()
      toast.success(`Group "${form.name}" created!`)
      onCreated(group)
      setOpen(false)
      reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New Group
        </Button>
      )}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a group</DialogTitle>
            <DialogDescription>Invite members and start splitting expenses together.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {atGroupLimit && planStatus && (
              <UpgradePrompt used={planStatus.groupCount} max={planStatus.maxGroups!} />
            )}

            <div className="space-y-1.5">
              <Label>Group name</Label>
              <Input
                placeholder="Swimming, Office lunch, Trip to Bali…"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="A short description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v ?? form.currency }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Default split type */}
            <div className="space-y-2">
              <Label>Default split for expenses</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {SPLIT_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSplitType(opt.value)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium transition-colors text-center",
                      splitType === opt.value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {SPLIT_TYPES.find((o) => o.value === splitType)?.desc}
              </p>
              {splitType === "SHARES" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  You can set per-member share counts after adding members to the group.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setOpen(false); reset() }}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || atGroupLimit}>
                {loading ? "Creating…" : "Create group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
