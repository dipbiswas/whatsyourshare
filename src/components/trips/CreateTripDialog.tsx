"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { format, addDays } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

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
  const [form, setForm] = useState({
    name: "",
    destination: "",
    eventType: "TRIP",
    coverEmoji: "✈️",
    startDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
  })

  function selectType(value: string) {
    const t = EVENT_TYPES.find((e) => e.value === value)!
    setForm((f) => ({ ...f, eventType: value, coverEmoji: t.emoji }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Event name is required"); return }
    if (form.endDate < form.startDate) { toast.error("End date must be after start date"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, groupId }),
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create an event</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
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

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? "Creating…" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
