"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
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

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"]

interface Props {
  onCreated: (group: object) => void
  trigger?: React.ReactNode
}

export function CreateGroupDialog({ onCreated, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState("USD")
  const [form, setForm] = useState({ name: "", description: "", currency: "USD" })

  // Fetch user's default currency once
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
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        toast.error("Failed to create group")
        return
      }
      const group = await res.json()
      toast.success(`Group "${form.name}" created!`)
      onCreated(group)
      setOpen(false)
      setForm({ name: "", description: "", currency: defaultCurrency })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New Group
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a group</DialogTitle>
            <DialogDescription>Invite members and start splitting expenses together.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Group name</Label>
              <Input
                placeholder="Trip to Paris, Office lunch, etc."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input
                placeholder="A short description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v ?? "USD" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={loading}>
                {loading ? "Creating…" : "Create group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
