"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Sparkles, Plus, Trash2, RefreshCw, Calendar, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface GeneratedItem {
  title: string
  description: string | null
  suggestedDay?: number
}

interface Props {
  tripId: string
  tripName: string
  memberCount: number
  days: number
  existingTitles: string[]
  scansAvailable: number
  onSave: (items: { title: string; category: string; description?: string | null }[]) => Promise<void>
}

export function AiPlanningDialog({
  tripId,
  tripName,
  memberCount,
  days,
  existingTitles,
  scansAvailable,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preEvent, setPreEvent] = useState<GeneratedItem[]>([])
  const [dayOf, setDayOf] = useState<GeneratedItem[]>([])
  const [generated, setGenerated] = useState(false)
  const [localScans, setLocalScans] = useState(scansAvailable)

  async function generate() {
    if (localScans <= 0) {
      toast.error("No scans remaining. Top up to continue.")
      return
    }
    setGenerating(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/ai-action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, existingItems: existingTitles }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate")
        return
      }
      setPreEvent(data.preEvent)
      setDayOf(data.dayOf)
      setGenerated(true)
      setLocalScans(data.scansRemaining ?? localScans - 1)
    } catch (err) {
      console.error("[AiPlanningDialog]", err)
      toast.error("Could not reach server — please try again")
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    const allItems = [
      ...preEvent.map((i) => ({ title: i.title, category: "task", description: i.description })),
      ...dayOf.map((i) => ({ title: i.title, category: "cost", description: i.description ?? `Day ${i.suggestedDay ?? 1}` })),
    ]
    if (allItems.length === 0) { toast.error("No items to save"); return }
    setSaving(true)
    try {
      await onSave(allItems)
      toast.success(`${allItems.length} items added to plan`)
      setOpen(false)
      reset()
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setDescription("")
    setPreEvent([])
    setDayOf([])
    setGenerated(false)
  }

  function removePreEvent(i: number) { setPreEvent((p) => p.filter((_, idx) => idx !== i)) }
  function removeDayOf(i: number) { setDayOf((p) => p.filter((_, idx) => idx !== i)) }
  function editPreEvent(i: number, title: string) { setPreEvent((p) => p.map((item, idx) => idx === i ? { ...item, title } : item)) }
  function editDayOf(i: number, title: string) { setDayOf((p) => p.map((item, idx) => idx === i ? { ...item, title } : item)) }

  const totalItems = preEvent.length + dayOf.length

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-400 dark:hover:bg-indigo-500/10 h-8 text-xs"
        onClick={() => { setLocalScans(scansAvailable); setOpen(true) }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Generate with AI
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              AI Planning for {tripName}
            </DialogTitle>
          </DialogHeader>

          {/* Scan counter */}
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <span>{memberCount} people · {days} day{days !== 1 ? "s" : ""}</span>
            <span className={localScans <= 0 ? "text-rose-500 font-semibold" : ""}>
              {localScans} scan{localScans !== 1 ? "s" : ""} remaining
            </span>
          </div>

          {/* Description input */}
          <div className="space-y-1.5">
            <Label className="text-sm">Describe the event <span className="text-muted-foreground font-normal">(optional but helps)</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Beach trip with friends, we need to rent a cottage and plan meals. Some people are vegetarian."
              className="text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Generate / Regenerate button */}
          <Button
            onClick={generate}
            disabled={generating || localScans <= 0}
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            {generating ? (
              <><RefreshCw className="h-4 w-4 animate-spin" />Generating…</>
            ) : generated ? (
              <><RefreshCw className="h-4 w-4" />Regenerate · uses 1 scan</>
            ) : (
              <><Sparkles className="h-4 w-4" />Generate · uses 1 scan</>
            )}
          </Button>

          {/* Results */}
          {generated && (
            <div className="space-y-4 mt-1">
              {/* Pre-event tasks */}
              {preEvent.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Pre-event tasks</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{preEvent.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {preEvent.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-background">
                        <input
                          value={item.title}
                          onChange={(e) => editPreEvent(i, e.target.value)}
                          className="flex-1 text-sm bg-transparent outline-none min-w-0"
                        />
                        <button onClick={() => removePreEvent(i)} className="text-muted-foreground hover:text-rose-500 shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setPreEvent((p) => [...p, { title: "", description: null }])}
                      className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 px-1 py-1"
                    >
                      <Plus className="h-3.5 w-3.5" />Add task
                    </button>
                  </div>
                </div>
              )}

              {/* Day-of costs */}
              {dayOf.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Day-of costs</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{dayOf.length}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">→ Log expense when done</span>
                  </div>
                  <div className="space-y-1.5">
                    {dayOf.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 px-3 py-2 bg-amber-50/50 dark:bg-amber-500/5">
                        <input
                          value={item.title}
                          onChange={(e) => editDayOf(i, e.target.value)}
                          className="flex-1 text-sm bg-transparent outline-none min-w-0"
                        />
                        {days > 1 && (
                          <select
                            value={item.suggestedDay ?? 1}
                            onChange={(e) => setDayOf((p) => p.map((it, idx) => idx === i ? { ...it, suggestedDay: Number(e.target.value) } : it))}
                            className="text-xs border border-border rounded px-1.5 py-0.5 bg-background shrink-0"
                          >
                            {Array.from({ length: days }, (_, d) => (
                              <option key={d + 1} value={d + 1}>Day {d + 1}</option>
                            ))}
                          </select>
                        )}
                        <button onClick={() => removeDayOf(i)} className="text-muted-foreground hover:text-rose-500 shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setDayOf((p) => [...p, { title: "", description: null, suggestedDay: 1 }])}
                      className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 px-1 py-1"
                    >
                      <Plus className="h-3.5 w-3.5" />Add day-of cost
                    </button>
                  </div>
                </div>
              )}

              {/* Save */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset() }}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  disabled={saving || totalItems === 0}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : `Add ${totalItems} item${totalItems !== 1 ? "s" : ""} to plan`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
