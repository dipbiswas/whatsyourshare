"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Mail, Copy, Check, UserPlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  groupId: string
}

export function InviteMemberDialog({ groupId }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleInvite = async () => {
    if (!email.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send invite")
        return
      }
      setInviteUrl(data.inviteUrl)
      if (data.emailSent) {
        toast.success(`Invite sent to ${email}`)
      } else {
        toast.info("Email delivery skipped — copy the link below to share manually")
      }
    } catch {
      toast.error("Failed to send invite")
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

  const reset = () => {
    setEmail("")
    setInviteUrl(null)
    setCopied(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          Invite by Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-violet-600" />
            Invite to Group
          </DialogTitle>
        </DialogHeader>

        {!inviteUrl ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                autoFocus
              />
              <p className="text-xs text-gray-400">
                They&apos;ll get an email with a link to join. If they&apos;re not registered yet, they can sign up first.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleInvite}
                disabled={loading || !email.trim()}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
              >
                {loading ? "Sending…" : "Send Invite"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <Check className="h-4 w-4 shrink-0" />
              Invite created for {email}
            </div>

            <div className="space-y-1.5">
              <Label>Share this link</Label>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="text-xs font-mono" />
                <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-400">Link expires in 7 days</p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={reset}
                variant="outline"
                className="flex-1"
              >
                Invite another
              </Button>
              <Button onClick={() => setOpen(false)} className="flex-1 bg-violet-600 hover:bg-violet-700">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
