"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { UserPlus, Copy, Check, Mail, Users, Search, X } from "lucide-react"
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
import { cn } from "@/lib/utils"

interface Friend {
  id: string
  name: string
  email: string
  avatar: string | null
}

interface Props {
  groupId: string
  /** existing member userIds so we can grey them out */
  existingMemberIds?: string[]
  onAdded: (member: object) => void
  /** controlled open state — omit to use internal state */
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

type Step = "form" | "invited"

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

function avatarColor(id: string) {
  const colors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500",
    "bg-amber-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500",
  ]
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return colors[Math.abs(hash) % colors.length]
}

export function AddMemberDialog({ groupId, existingMemberIds = [], onAdded, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => { setInternalOpen(v); onOpenChange?.(v) }
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [search, setSearch] = useState("")
  const [step, setStep] = useState<Step>("form")
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  // Fetch friends when dialog opens
  useEffect(() => {
    if (!open) return
    setFriendsLoading(true)
    fetch("/api/friends")
      .then((r) => r.json())
      .then((d) => setFriends(Array.isArray(d) ? d : []))
      .finally(() => setFriendsLoading(false))
  }, [open])

  const reset = () => {
    setEmail("")
    setSearch("")
    setStep("form")
    setInviteUrl(null)
    setCopied(false)
  }

  const filteredFriends = friends.filter((f) =>
    search.trim()
      ? f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.email.toLowerCase().includes(search.toLowerCase())
      : true
  )

  // Friends already in this group
  const availableFriends = filteredFriends.filter((f) => !existingMemberIds.includes(f.id))
  const alreadyInGroup = filteredFriends.filter((f) => existingMemberIds.includes(f.id))

  async function addByEmail(emailToAdd: string) {
    setLoading(true)
    try {
      // Try direct add first
      const addRes = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToAdd }),
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

      if (addRes.status === 409) {
        toast.error(addData.error ?? "Already a member")
        return
      }

      // Not found → send invite
      if (addRes.status === 404) {
        const inviteRes = await fetch(`/api/groups/${groupId}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailToAdd }),
        })
        const inviteData = await inviteRes.json()
        if (!inviteRes.ok) {
          toast.error(inviteData.error ?? "Failed to send invite")
          return
        }
        setInviteUrl(inviteData.inviteUrl)
        setStep("invited")
        if (inviteData.emailSent) toast.success(`Invite sent to ${emailToAdd}`)
        return
      }

      toast.error(addData.error ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function addFriend(friend: Friend) {
    setLoading(true)
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: friend.email }),
      })
      if (res.ok) {
        const member = await res.json()
        toast.success(`${friend.name} added to group!`)
        onAdded(member)
        setOpen(false)
        reset()
      } else {
        const data = await res.json()
        toast.error(data.error ?? "Failed to add member")
      }
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

  const hasFriends = !friendsLoading && friends.length > 0

  return (
    <>
      {controlledOpen === undefined && (
        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add Member
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-sm">

          {/* ── Step 1: pick or type ── */}
          {step === "form" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-500" />
                  Add a member
                </DialogTitle>
                <DialogDescription>
                  {hasFriends
                    ? "Pick from people you've split with before, or enter a new email."
                    : "Enter their email. If they're already on WhatsYourShare they'll be added instantly — otherwise we'll send an invite."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-1">
                {/* Friends list */}
                {hasFriends && (
                  <div className="space-y-2">
                    {/* Search friends */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search friends…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 pr-8 h-8 text-sm"
                      />
                      {search && (
                        <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Friend rows */}
                    <div className="rounded-xl border border-border overflow-hidden max-h-52 overflow-y-auto">
                      {availableFriends.length === 0 && alreadyInGroup.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No matches</p>
                      )}

                      {availableFriends.map((f) => (
                        <button
                          key={f.id}
                          disabled={loading}
                          onClick={() => addFriend(f)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors border-b border-border/60 last:border-0 disabled:opacity-50"
                        >
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(f.id))}>
                            {initials(f.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                          </div>
                          <span className="text-xs text-violet-600 dark:text-violet-400 font-medium shrink-0">Add</span>
                        </button>
                      ))}

                      {/* Already in group */}
                      {alreadyInGroup.map((f) => (
                        <div
                          key={f.id}
                          className="w-full flex items-center gap-3 px-3 py-2.5 opacity-40 border-b border-border/60 last:border-0"
                        >
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(f.id))}>
                            {initials(f.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">In group</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                {hasFriends && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">or add by email</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {/* Email input */}
                <form
                  onSubmit={(e) => { e.preventDefault(); addByEmail(email) }}
                  className="space-y-3"
                >
                  <div className="space-y-1.5">
                    {!hasFriends && <Label htmlFor="member-email">Email address</Label>}
                    <Input
                      id="member-email"
                      ref={emailRef}
                      type="email"
                      placeholder="colleague@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus={!hasFriends}
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
                      {loading ? "Adding…" : "Add by email"}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
            </>
          )}

          {/* ── Step 2: invite sent ── */}
          {step === "invited" && (
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
                  <Input value={inviteUrl ?? ""} readOnly className="text-xs font-mono bg-muted/40" />
                  <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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
