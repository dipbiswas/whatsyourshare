"use client"

import { useState } from "react"
import { toast } from "sonner"
import { UserPlus, Copy, Check, Mail, Users } from "lucide-react"
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

interface Props {
  groupId: string
  onAdded: (member: object) => void
}

type Step = "form" | "invited"

export function AddMemberDialog({ groupId, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [step, setStep] = useState<Step>("form")
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setEmail("")
    setStep("form")
    setInviteUrl(null)
    setCopied(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // First: try to add directly (works if they already have an account)
      const addRes = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (addRes.ok) {
        const member = await addRes.json()
        toast.success(`${member.user.name} added to group!`)
        onAdded(member)
        setOpen(false)
        reset()
        return
      }

      const addData = await addRes.json()

      // Already a member
      if (addRes.status === 409) {
        toast.error(addData.error ?? "Already a member")
        return
      }

      // User not found → fall through to invite flow
      if (addRes.status === 404) {
        const inviteRes = await fetch(`/api/groups/${groupId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })

        const inviteData = await inviteRes.json()

        if (!inviteRes.ok) {
          toast.error(inviteData.error ?? "Failed to send invite")
          return
        }

        setInviteUrl(inviteData.inviteUrl)
        setStep("invited")

        if (inviteData.emailSent) {
          toast.success(`Invite sent to ${email}`)
        }
        return
      }

      // Any other error
      toast.error(addData.error ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Add Member
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-sm">
          {step === "form" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-500" />
                  Add a member
                </DialogTitle>
                <DialogDescription>
                  Enter their email. If they&apos;re already on WhatsYourShare they&apos;ll be added
                  instantly — otherwise we&apos;ll send them an invite link.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="member-email">Email address</Label>
                  <Input
                    id="member-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-violet-600 hover:bg-violet-700"
                    disabled={loading || !email.trim()}
                  >
                    {loading ? "Adding…" : "Add member"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-violet-500" />
                  Invite sent!
                </DialogTitle>
                <DialogDescription>
                  <strong>{email}</strong> doesn&apos;t have an account yet. We&apos;ve sent them an
                  invite — or share the link below manually.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <div className="flex gap-2">
                  <Input
                    value={inviteUrl ?? ""}
                    readOnly
                    className="text-xs font-mono bg-muted/40"
                  />
                  <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0">
                    {copied
                      ? <Check className="h-4 w-4 text-green-500" />
                      : <Copy className="h-4 w-4" />
                    }
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Link expires in 7 days.</p>
              </div>

              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={reset}>Invite another</Button>
                <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => { setOpen(false); reset() }}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
