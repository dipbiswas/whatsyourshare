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

const COVER_EMOJIS = ["✈️", "🏖️", "🏔️", "🗺️", "🚂", "🏕️", "🌊", "🎭", "🏯", "🌴"]

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
    coverEmoji: "✈️",
    startDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    endDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Trip name is required"); return }
    if (form.endDate < form.startDate) { toast.error("End date must be after start date"); return }

    setLoading(true)
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, groupId }),
      })
      if (!res.ok) { toast.error("Failed to create trip"); return }
      const trip = await res.json()
      toast.success("Trip created!")
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
        <Button className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Trip
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a trip</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground -mt-1 space-y-1">
            <p>A trip is a time-bounded event within this group — like a weekend away, a conference, or a dinner series. Expenses added during the trip are tracked separately so you can see exactly what it cost, without mixing with the group&apos;s other spending.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Emoji picker */}
            <div className="space-y-1.5">
              <Label>Cover emoji</Label>
              <div className="flex flex-wrap gap-2">
                {COVER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, coverEmoji: emoji }))}
                    className={`text-2xl p-1.5 rounded-lg border-2 transition-colors ${
                      form.coverEmoji === emoji
                        ? "border-violet-500 bg-violet-50"
                        : "border-transparent hover:border-gray-200"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Trip name</Label>
              <Input
                placeholder="Amalfi Coast Summer, Tokyo 2026…"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Destination (optional)</Label>
              <Input
                placeholder="Italy, Japan, NYC…"
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              />
            </div>

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
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={loading}>
                {loading ? "Creating…" : "Create trip"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
