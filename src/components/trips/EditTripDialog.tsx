"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { format } from "date-fns"
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
import { EVENT_TYPES } from "./CreateTripDialog"

interface TripEditData {
  id: string
  name: string
  destination: string | null
  eventType: string
  coverEmoji: string | null
  startDate: string
  endDate: string
}

interface Props {
  trip: TripEditData
  onUpdated: (updates: Partial<TripEditData>) => void
}

export function EditTripDialog({ trip, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: trip.name,
    destination: trip.destination ?? "",
    eventType: (trip as any).eventType ?? "TRIP",
    coverEmoji: trip.coverEmoji ?? "✈️",
    startDate: format(new Date(trip.startDate), "yyyy-MM-dd"),
    endDate: format(new Date(trip.endDate), "yyyy-MM-dd"),
  })

  function openDialog() {
    setForm({
      name: trip.name,
      destination: trip.destination ?? "",
      eventType: (trip as any).eventType ?? "TRIP",
      coverEmoji: trip.coverEmoji ?? "✈️",
      startDate: format(new Date(trip.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(trip.endDate), "yyyy-MM-dd"),
    })
    setOpen(true)
  }

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
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          destination: form.destination.trim() || null,
          eventType: form.eventType,
          coverEmoji: form.coverEmoji,
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      })
      if (!res.ok) { toast.error("Failed to update event"); return }
      const updated = await res.json()
      onUpdated(updated)
      toast.success("Event updated")
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost" size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 shrink-0"
        onClick={openDialog}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
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
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Event name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label>Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="Italy, NYC…"
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              />
            </div>

            {/* Dates */}
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
                {loading ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
