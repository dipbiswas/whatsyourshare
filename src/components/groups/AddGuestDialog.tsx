"use client"

import { useState } from "react"
import { toast } from "sonner"
import { UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface GuestMember {
  id: string
  name: string
  email: string | null
  groupId: string
  linkedUserId: string | null
}

interface Props {
  groupId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded: (guest: GuestMember) => void
}

export function AddGuestDialog({ groupId, open, onOpenChange, onAdded }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  function reset() {
    setName("")
    setEmail("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Failed to add guest"); return }

      if (data.type === "member") {
        toast.success(`${data.member.user.name} already has an account — added as a regular member!`)
        onAdded(data.member)
      } else {
        toast.success(`${data.guest.name} added as guest`)
        onAdded(data.guest)
      }
      onOpenChange(false)
      reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-indigo-500" />
            Add a guest
          </DialogTitle>
          <DialogDescription>
            Guests don&apos;t need an account. You manage their splits on their behalf. If they sign up later with the same email, their history merges automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="guest-name"
              placeholder="e.g. Sarah, Dad, Little Jake"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-email">
              Email <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Input
              id="guest-email"
              type="email"
              placeholder="For future account linking"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              You can add or change this later. Leave blank for kids or anyone without email.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading || !name.trim()}>
              {loading ? "Adding…" : "Add guest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
