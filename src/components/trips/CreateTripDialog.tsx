"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Check, Zap } from "lucide-react"
import { format, addDays } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface GroupMember {
  userId: string
  user: { id: string; name: string; avatar: string | null }
}

export const EVENT_TYPES = [
  { value: "TRIP",        label: "Trip",        emoji: "✈️",  desc: "Vacation, road trip, getaway" },
  { value: "CELEBRATION", label: "Celebration", emoji: "🎉",  desc: "Birthday, anniversary, graduation" },
  { value: "DINING",      label: "Dining",      emoji: "🍽️", desc: "Group dinner, brunch, food crawl" },
  { value: "EVENT",       label: "Event",       emoji: "🎟️", desc: "Concert, sports game, festival" },
  { value: "PROJECT",     label: "Project",     emoji: "🏠",  desc: "Home reno, moving, group purchase" },
  { value: "OTHER",       label: "Other",       emoji: "📦",  desc: "Anything else" },
]

interface Props {
  groupId: string
  onCreated?: (trip: object) => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

export function CreateTripDialog({ groupId, onCreated, open: controlledOpen, onOpenChange }: Props) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => { setInternalOpen(v); onOpenChange?.(v) }
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [canCreateEvents, setCanCreateEvents] = useState<boolean | null>(null)
  const [form, setForm] = useState({
    name: "",
    destination: "",
    eventType: "TRIP",
    coverEmoji: "✈️",
    startDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
  })

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch(`/api/groups/${groupId}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/plan-status").then((r) => r.ok ? r.json() : null),
    ]).then(([groupData, planData]) => {
      if (groupData?.members) {
        setMembers(groupData.members)
        setSelectedIds(new Set(groupData.members.map((m: GroupMember) => m.userId)))
      }
      if (planData) setCanCreateEvents(planData.canCreateEvents)
    })
  }, [open, groupId])

  function toggleMember(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        if (next.size === 1) return prev
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  function selectType(value: string) {
    const t = EVENT_TYPES.find((e) => e.value === value)!
    setForm((f) => ({ ...f, eventType: value, coverEmoji: t.emoji }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Event name is required"); return }
    if (form.endDate < form.startDate) { toast.error("End date must be after start date"); return }

    const allSelected = selectedIds.size === members.length
    const memberIds = allSelected ? undefined : Array.from(selectedIds)

    setLoading(true)
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, groupId, ...(memberIds ? { memberIds } : {}) }),
      })
      if (!res.ok) { toast.error("Failed to create event"); return }
      const trip = await res.json()
      toast.success("Event created!")
      setOpen(false)
      onCreated?.(trip)
      router.push(`/trips/${trip.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {controlledOpen === undefined && (
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Event
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create an event</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            {canCreateEvents === false && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Pro feature</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Events, trips, itineraries, and trip funds are available on the Pro plan.
                    </p>
                  </div>
                </div>
                <button type="button" className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 transition-colors">
                  <Zap className="h-3.5 w-3.5" />
                  Upgrade to Pro — $4/month
                </button>
              </div>
            )}
            {/* Type picker */}
            <div className="space-y-1.5">
              <Label>Event type</Label>
              <div className="grid grid-cols-3 gap-2">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => selectType(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-center transition-colors",
                      form.eventType === t.value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15"
                        : "border-border hover:border-indigo-300 hover:bg-accent"
                    )}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    <span className="text-xs font-medium text-foreground">{t.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {EVENT_TYPES.find((t) => t.value === form.eventType)?.desc}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Event name</Label>
              <Input
                placeholder={
                  form.eventType === "TRIP" ? "Amalfi Coast Summer, Tokyo 2026…" :
                  form.eventType === "CELEBRATION" ? "Sarah's 30th, Graduation party…" :
                  form.eventType === "DINING" ? "Friday night dinner, Food crawl…" :
                  form.eventType === "EVENT" ? "Taylor Swift concert, Super Bowl…" :
                  form.eventType === "PROJECT" ? "Kitchen reno, Moving weekend…" :
                  "Name this event…"
                }
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            {(form.eventType === "TRIP" || form.eventType === "OTHER") && (
              <div className="space-y-1.5">
                <Label>Location (optional)</Label>
                <Input
                  placeholder="Italy, NYC, Home…"
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Member picker */}
            {members.length > 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Who&apos;s joining?</Label>
                  <button
                    type="button"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    onClick={() =>
                      selectedIds.size === members.length
                        ? setSelectedIds(new Set([members[0].userId]))
                        : setSelectedIds(new Set(members.map((m) => m.userId)))
                    }
                  >
                    {selectedIds.size === members.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {members.map((m) => {
                    const selected = selectedIds.has(m.userId)
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => toggleMember(m.userId)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors text-left",
                          selected
                            ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/30"
                            : "border-border hover:bg-accent"
                        )}
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          {m.user.avatar && <AvatarImage src={m.user.avatar} />}
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                            {m.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium text-foreground">{m.user.name}</span>
                        <div className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          selected ? "bg-indigo-600 border-indigo-600" : "border-border"
                        )}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedIds.size} of {members.length} members joining
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || canCreateEvents === false}>
                {loading ? "Creating…" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
