"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "SGD", "AED", "CHF"]

const SPLIT_TYPES = [
  { value: "EQUAL",      label: "Equal",       desc: "Split evenly between all members" },
  { value: "SHARES",     label: "Shares",      desc: "Proportional headcount (e.g. family of 4 vs 2)" },
  { value: "PERCENTAGE", label: "Percentage",  desc: "Each member pays a fixed %" },
  { value: "EXACT",      label: "Exact",       desc: "Enter exact amounts each time" },
]

interface Member {
  userId: string
  role?: string
  user: { id: string; name: string }
}

interface Group {
  id: string
  name: string
  description: string | null
  currency: string
  defaultSplitType: string
  defaultSplitShares: Record<string, number> | null
  members: Member[]
}

interface Props {
  group: Group
  onUpdated: (updates: Partial<Group>) => void
}

export function EditGroupDialog({ group, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? "")
  const [currency, setCurrency] = useState(group.currency)
  const [splitType, setSplitType] = useState(group.defaultSplitType || "EQUAL")
  const [shares, setShares] = useState<Record<string, string>>(
    Object.fromEntries(group.members.map((m) => [m.userId, String(group.defaultSplitShares?.[m.userId] ?? "")]))
  )

  function reset() {
    setName(group.name)
    setDescription(group.description ?? "")
    setCurrency(group.currency)
    setSplitType(group.defaultSplitType || "EQUAL")
    setShares(Object.fromEntries(group.members.map((m) => [m.userId, String(group.defaultSplitShares?.[m.userId] ?? "")])))
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Group name is required"); return }

    const splitShares = splitType === "SHARES"
      ? Object.fromEntries(
          group.members
            .map((m) => [m.userId, parseFloat(shares[m.userId]) || 0])
            .filter(([, v]) => (v as number) > 0)
        )
      : null

    setSaving(true)
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          currency,
          defaultSplitType: splitType,
          defaultSplitShares: splitShares,
        }),
      })
      if (!res.ok) { toast.error("Failed to update group"); return }
      toast.success("Group updated")
      onUpdated({
        name: name.trim(),
        description: description.trim() || null,
        currency,
        defaultSplitType: splitType,
        defaultSplitShares: splitShares,
      })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => { reset(); setOpen(true) }}
        title="Edit group"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Group name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family, Apartment, Trip to Bali" required />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group for?" />
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v ?? currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Default split type */}
            <div className="space-y-2">
              <Label>Default split for new expenses</Label>
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
            </div>

            {/* Shares per member (only for SHARES type) */}
            {splitType === "SHARES" && group.members.length > 0 && (
              <div className="space-y-1.5">
                <Label>Shares per member</Label>
                <div className="rounded-xl border border-border overflow-hidden">
                  {group.members.map((m, i) => (
                    <div key={m.userId} className={cn("flex items-center gap-3 px-3 py-2.5", i > 0 && "border-t border-border/50")}>
                      <span className="text-sm text-foreground flex-1">{m.user.name}</span>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={shares[m.userId] ?? ""}
                        onChange={(e) => setShares((s) => ({ ...s, [m.userId]: e.target.value }))}
                        className="w-20 h-7 text-xs text-right"
                      />
                      <span className="text-xs text-muted-foreground w-10">shares</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter headcount for each member — e.g. 4 for a family of four, 1 for a solo member.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
