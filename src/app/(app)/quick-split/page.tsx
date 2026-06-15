"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Users, Receipt, Scale, ArrowLeftRight, Plus, X,
  Check, Settings, ArrowRight, LayoutDashboard, Info, Clock,
  Pencil, Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/balance"
import { AddSettlementDialog } from "@/components/settlements/AddSettlementDialog"
import { InteracHelperDialog } from "@/components/settlements/InteracHelperDialog"

interface Group {
  id: string
  name: string
  currency: string
  members: Member[]
  guests: Guest[]
}

interface Member {
  userId: string
  user: { id: string; name: string; email: string; avatar: string | null }
}

interface Guest {
  id: string
  name: string
  email?: string | null
}

type Participant = { type: "member"; userId: string; name: string } | { type: "guest"; guestId: string; name: string }

interface Balance {
  key: string
  name: string
  amount: number
  isGuest: boolean
}

interface Settlement {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

interface RecordedSettlement {
  id: string
  fromName: string
  toName: string
  amount: number
  date: string
  currency: string
  paymentMethod: string
}

interface SuggestedSettlement {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

interface Friend {
  id: string
  name: string
  email: string
  avatar: string | null
}

interface Expense {
  id: string
  description: string
  amount: number
  date: string
  paidBy: { id: string; name: string }
  splits: { userId: string | null; guestMemberId: string | null; amount: number }[]
}

export default function QuickSplitPage() {
  const router = useRouter()

  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [recordedSettlements, setRecordedSettlements] = useState<RecordedSettlement[]>([])
  const [hasNonEqualSplits, setHasNonEqualSplits] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadingBalances, setLoadingBalances] = useState(false)

  const [showGroupPopup, setShowGroupPopup] = useState(false)
  const [showMemberPopup, setShowMemberPopup] = useState(false)
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [addingGuest, setAddingGuest] = useState(false)
  const [addMemberEmail, setAddMemberEmail] = useState("")
  const [addingMember, setAddingMember] = useState(false)

  const [expenseDesc, setExpenseDesc] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expensePaidBy, setExpensePaidBy] = useState("")
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0])
  const [selectedForSplit, setSelectedForSplit] = useState<Set<string>>(new Set())
  const [addingExpense, setAddingExpense] = useState(false)

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editDesc, setEditDesc] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editPaidBy, setEditPaidBy] = useState("")
  const [editDate, setEditDate] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  const [switching, setSwitching] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState("USD")
  const [currentUserId, setCurrentUserId] = useState("")
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendSearch, setFriendSearch] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch("/api/account").then((r) => r.ok ? r.json() : null),
      fetch("/api/friends").then((r) => r.ok ? r.json() : []),
    ]).then(([groupData, accountData, friendsData]) => {
      if (accountData?.defaultCurrency) setDefaultCurrency(accountData.defaultCurrency)
      if (accountData?.id) setCurrentUserId(accountData.id)
      setFriends(friendsData)
      setGroups(groupData)
      if (groupData.length > 0) selectGroup(groupData[0])
    })
  }, [])

  function selectGroup(g: Group) {
    setHasNonEqualSplits(false)
    setExpenses([])
    setBalances([])
    setSettlements([])
    setRecordedSettlements([])
    setSelectedGroup(g)
    const allParticipants: Participant[] = [
      ...g.members.map((m) => ({ type: "member" as const, userId: m.userId, name: m.user.name })),
      ...(g.guests ?? []).map((guest) => ({ type: "guest" as const, guestId: guest.id, name: guest.name })),
    ]
    setParticipants(allParticipants)
    const keys = new Set(allParticipants.map((p) => p.type === "member" ? p.userId : `guest_${p.guestId}`))
    setSelectedForSplit(keys)
    setExpensePaidBy(g.members[0]?.userId ?? "")
    loadBalances(g.id)
    setShowGroupPopup(false)
  }

  const loadBalances = useCallback(async (groupId: string) => {
    setLoadingBalances(true)
    const res = await fetch(`/api/groups/${groupId}?allExpenses=true`)
    if (!res.ok) { setLoadingBalances(false); return }
    const data = await res.json()

    // Use the pre-computed balanceMap from the API
    const balanceMap: Record<string, number> = data.balanceMap ?? {}

    const memberMap: Record<string, string> = {}
    data.members.forEach((m: Member) => { memberMap[m.userId] = m.user.name })
    const guestMap: Record<string, string> = {}
    ;(data.guests ?? []).forEach((g: Guest) => { guestMap[`guest_${g.id}`] = `${g.name} (guest)` })

    const allKeys = new Set([...Object.keys(memberMap), ...Object.keys(guestMap)])
    const bals: Balance[] = Array.from(allKeys).map((key) => ({
      key,
      name: memberMap[key] ?? guestMap[key] ?? key,
      amount: Math.round((balanceMap[key] ?? 0) * 100) / 100,
      isGuest: key.startsWith("guest_"),
    }))
    setBalances(bals)

    // Use pre-computed suggested settlements from the API
    const settles: Settlement[] = (data.suggestedSettlements ?? []).map((s: SuggestedSettlement) => ({
      from: s.from,
      fromName: s.fromName,
      to: s.to,
      toName: s.toName,
      amount: Math.round(s.amount * 100) / 100,
    }))
    setSettlements(settles)

    // Recorded settlement history
    const recorded: RecordedSettlement[] = (data.settlements ?? []).map((s: any) => ({
      id: s.id,
      fromName: s.fromUser?.name ?? "Unknown",
      toName: s.toUser?.name ?? "Unknown",
      amount: s.amount,
      date: s.date ?? s.createdAt,
      currency: s.currency,
      paymentMethod: s.paymentMethod,
    }))
    setRecordedSettlements(recorded)

    // Detect any expenses with non-EQUAL split types
    const nonEqual = (data.expenses ?? []).some((e: any) => e.splitType && e.splitType !== "EQUAL")
    setHasNonEqualSplits(nonEqual)

    // Store expenses for the list (most recent first, already sorted by API)
    setExpenses((data.expenses ?? []).slice(0, 10))
    setLoadingBalances(false)
  }, [])

  async function createGroup() {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim(), currency: defaultCurrency }),
      })
      if (!res.ok) { toast.error("Failed to create group"); return }
      const g = await res.json()
      const fullGroup: Group = { ...g, guests: [] }
      setGroups((prev) => [fullGroup, ...prev])
      selectGroup(fullGroup)
      setNewGroupName("")
    } finally {
      setCreatingGroup(false)
    }
  }

  async function addGuest() {
    if (!guestName.trim() || !selectedGroup) return
    setAddingGuest(true)
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: guestName.trim(), email: guestEmail.trim() || undefined }),
      })
      if (!res.ok) { toast.error("Failed to add guest"); return }
      const guest = await res.json()
      const newGuest: Guest = { id: guest.id, name: guest.name, email: guest.email }
      const updated = { ...selectedGroup, guests: [...(selectedGroup.guests ?? []), newGuest] }
      setSelectedGroup(updated)
      setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g))
      const newP: Participant = { type: "guest", guestId: newGuest.id, name: newGuest.name }
      setParticipants((prev) => [...prev, newP])
      setSelectedForSplit((prev) => new Set([...prev, `guest_${newGuest.id}`]))
      setGuestName("")
      setGuestEmail("")
      setShowGuestForm(false)
      toast.success(`${newGuest.name} added as guest`)
    } finally {
      setAddingGuest(false)
    }
  }

  async function addMember() {
    if (!addMemberEmail.trim() || !selectedGroup) return
    setAddingMember(true)
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addMemberEmail.trim() }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to add member"); return }
      const member = await res.json()
      const updated = { ...selectedGroup, members: [...selectedGroup.members, member] }
      setSelectedGroup(updated)
      setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g))
      const newP: Participant = { type: "member", userId: member.userId, name: member.user.name }
      setParticipants((prev) => [...prev, newP])
      setSelectedForSplit((prev) => new Set([...prev, member.userId]))
      setAddMemberEmail("")
      toast.success(`${member.user.name} added`)
    } finally {
      setAddingMember(false)
    }
  }

  function toggleSplit(key: string) {
    setSelectedForSplit((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const splitParticipants = participants.filter((p) => {
    const key = p.type === "member" ? p.userId : `guest_${p.guestId}`
    return selectedForSplit.has(key)
  })
  const splitAmount = parseFloat(expenseAmount) || 0
  const perPerson = splitParticipants.length > 0 ? Math.round((splitAmount / splitParticipants.length) * 100) / 100 : 0

  async function addExpense() {
    if (!selectedGroup) { toast.error("Select a group first"); return }
    if (!expenseDesc.trim()) { toast.error("Enter a description"); return }
    if (!splitAmount || splitAmount <= 0) { toast.error("Enter a valid amount"); return }
    if (!expensePaidBy) { toast.error("Select who paid"); return }
    if (splitParticipants.length === 0) { toast.error("Select at least one person to split with"); return }

    setAddingExpense(true)
    try {
      const splits = splitParticipants.map((p) => {
        if (p.type === "member") return { userId: p.userId, amount: perPerson }
        return { guestMemberId: p.guestId, amount: perPerson }
      })

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          description: expenseDesc.trim(),
          amount: splitAmount,
          paidById: expensePaidBy,
          category: "General",
          date: expenseDate,
          splitType: "EQUAL",
          splits,
        }),
      })
      if (!res.ok) { toast.error("Failed to add expense"); return }
      toast.success("Expense added!")
      setExpenseDesc("")
      setExpenseAmount("")
      await loadBalances(selectedGroup.id)
    } finally {
      setAddingExpense(false)
    }
  }

  function openEditExpense(e: Expense) {
    setEditingExpense(e)
    setEditDesc(e.description)
    setEditAmount(String(e.amount))
    setEditPaidBy(e.paidBy?.id ?? "")
    setEditDate(e.date ? e.date.split("T")[0] : new Date().toISOString().split("T")[0])
  }

  async function saveEditExpense() {
    if (!editingExpense || !selectedGroup) return
    const amount = parseFloat(editAmount)
    if (!editDesc.trim() || !amount || amount <= 0) return
    setSavingEdit(true)
    try {
      const perPerson = Math.round((amount / editingExpense.splits.length) * 100) / 100
      const splits = editingExpense.splits.map((s) =>
        s.userId
          ? { userId: s.userId, amount: perPerson }
          : { guestMemberId: s.guestMemberId, amount: perPerson }
      )
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDesc.trim(), amount, paidById: editPaidBy, date: editDate, splitType: "EQUAL", splits }),
      })
      if (!res.ok) { toast.error("Failed to update expense"); return }
      toast.success("Expense updated!")
      setEditingExpense(null)
      await loadBalances(selectedGroup.id)
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteExpense(expenseId: string) {
    if (!selectedGroup) return
    if (!confirm("Delete this expense?")) return
    const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to delete expense"); return }
    toast.success("Expense deleted")
    await loadBalances(selectedGroup.id)
  }

  async function removeMember(userId: string, name: string) {
    if (!selectedGroup) return
    if (!confirm(`Remove ${name} from this group?`)) return
    setRemovingMemberId(userId)
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to remove member"); return }
      const updated = { ...selectedGroup, members: selectedGroup.members.filter((m) => m.userId !== userId) }
      setSelectedGroup(updated)
      setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g))
      setParticipants((prev) => prev.filter((p) => !(p.type === "member" && p.userId === userId)))
      setSelectedForSplit((prev) => { const next = new Set(prev); next.delete(userId); return next })
      toast.success(`${name} removed`)
    } finally {
      setRemovingMemberId(null)
    }
  }

  async function switchToFull() {
    setSwitching(true)
    await fetch("/api/user/ui-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiMode: "FULL" }),
    })
    router.push("/dashboard")
  }

  const allParticipants = selectedGroup ? participants : []

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Mode banner */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Quick Split</span> — fast and simple.{" "}
              <button
                onClick={switchToFull}
                disabled={switching}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Switch to Full View
              </button>{" "}
              for trips, recurring expenses, AI insights, and more.
            </p>
          </div>
          <LayoutDashboard className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        {/* Non-equal splits warning */}
        {hasNonEqualSplits && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">This group has custom splits</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Some expenses in this group use percentage, exact, or custom splits. Quick Split only supports equal splits — balances shown are accurate, but new expenses added here will always be split equally.{" "}
                <button onClick={switchToFull} className="underline font-medium">Switch to Full View</button> to add expenses with custom splits.
              </p>
            </div>
          </div>
        )}

        {/* Top row: Group + Members */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Group card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" /> Group
            </div>
            {selectedGroup ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">{selectedGroup.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedGroup.members.length} member{selectedGroup.members.length !== 1 ? "s" : ""}
                    {(selectedGroup.guests?.length ?? 0) > 0 && ` · ${selectedGroup.guests.length} guest${selectedGroup.guests.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => setShowGroupPopup(true)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowGroupPopup(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-4 text-sm text-muted-foreground hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                <Plus className="h-4 w-4" /> Select or create a group
              </button>
            )}
          </div>

          {/* Members card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Users className="h-4 w-4 text-muted-foreground" /> Members
              </div>
              {selectedGroup && (
                <button
                  onClick={() => setShowMemberPopup(true)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors flex items-center gap-1"
                >
                  <Settings className="h-3 w-3" /> Manage
                </button>
              )}
            </div>
            {allParticipants.length === 0 ? (
              <p className="text-xs text-muted-foreground">Select a group to see members.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {allParticipants.map((p) => {
                    const key = p.type === "member" ? p.userId : `guest_${p.guestId}`
                    const selected = selectedForSplit.has(key)
                    return (
                      <span
                        key={key}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          p.type === "guest"
                            ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                            : selected
                            ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30"
                            : "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {p.name}
                        {p.type === "guest" && <span className="text-[9px] opacity-70">guest</span>}
                      </span>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selectedForSplit.size} of {allParticipants.length} selected for next expense
                </p>
              </>
            )}
          </div>
        </div>

        {/* Bottom row: Expense form + Balances/Settlements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Left column: add expense + recent expenses */}
          <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 mb-4 text-sm font-medium text-foreground">
              <Receipt className="h-4 w-4 text-muted-foreground" /> Add expense
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Amount ({selectedGroup?.currency ?? "USD"})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Dinner, cab, groceries…"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Paid by</label>
                  <select
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {selectedGroup?.members.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">Split equally — tap to include/exclude</p>
                </div>
                <div className="space-y-1.5">
                  {allParticipants.map((p) => {
                    const key = p.type === "member" ? p.userId : `guest_${p.guestId}`
                    const included = selectedForSplit.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleSplit(key)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors",
                          included
                            ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10"
                            : "border-border bg-muted/30 opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-4 w-4 rounded flex items-center justify-center flex-shrink-0",
                            included ? "bg-indigo-600" : "border border-border"
                          )}>
                            {included && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className={included ? "text-foreground" : "text-muted-foreground"}>{p.name}</span>
                          {p.type === "guest" && (
                            <span className="text-[9px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full px-1.5 py-0.5">guest</span>
                          )}
                        </div>
                        <span className={included ? "text-sm text-muted-foreground tabular-nums" : "text-sm text-muted-foreground/40 tabular-nums"}>
                          {included && splitAmount > 0 ? formatCurrency(perPerson, selectedGroup?.currency ?? "USD") : "—"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={addExpense}
                disabled={addingExpense}
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 transition-colors mt-1"
              >
                {addingExpense ? "Adding…" : "Add expense"}
              </button>
            </div>
          </div>

          {/* Recent expenses */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" /> Recent expenses
            </div>
            {loadingBalances ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : expenses.length === 0 ? (
              <p className="text-xs text-muted-foreground">No expenses yet. Add one above.</p>
            ) : (
              <div className="space-y-1.5">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm text-foreground truncate">{e.description}</span>
                      <span className="text-[11px] text-muted-foreground">paid by {e.paidBy?.name ?? "—"}{e.date ? ` · ${new Date(e.date).toLocaleDateString()}` : ""}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                      {formatCurrency(e.amount, selectedGroup?.currency ?? "USD")}
                    </span>
                    <button
                      onClick={() => openEditExpense(e)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteExpense(e.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div> {/* end left column */}

          {/* Balances + Settlements */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-foreground">
                <Scale className="h-4 w-4 text-muted-foreground" /> Balances
              </div>
              {balances.length === 0 ? (
                <p className="text-xs text-muted-foreground">No balances yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {balances.map((b) => (
                    <div key={b.key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <div className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0",
                          b.isGuest
                            ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                            : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
                        )}>
                          {b.name[0].toUpperCase()}
                        </div>
                        {b.name}
                        {b.isGuest && <span className="text-[9px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full px-1.5 py-0.5">guest</span>}
                      </div>
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        b.amount > 0.01 ? "text-emerald-600 dark:text-emerald-400"
                        : b.amount < -0.01 ? "text-rose-500 dark:text-rose-400"
                        : "text-muted-foreground/50"
                      )}>
                        {b.amount > 0.01 ? "+" : ""}{formatCurrency(b.amount, selectedGroup?.currency ?? "USD")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-foreground">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" /> Settlements
              </div>

              {/* Pending */}
              {settlements.length === 0 ? (
                <p className="text-xs text-muted-foreground mb-3">All settled up!</p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  {settlements.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 text-sm">
                      <span className="text-foreground font-medium">{s.fromName}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground font-medium">{s.toName}</span>
                      <span className="ml-auto text-indigo-600 dark:text-indigo-400 font-semibold tabular-nums">
                        {formatCurrency(s.amount, selectedGroup?.currency ?? "USD")}
                      </span>
                      {selectedGroup && (
                        <div className="flex items-center gap-1 shrink-0">
                          {selectedGroup.currency.toUpperCase() === "CAD" && (
                            <InteracHelperDialog
                              amount={s.amount}
                              currency={selectedGroup.currency}
                              toName={s.toName}
                              toEmail={selectedGroup.members.find((m) => m.userId === s.to)?.user.email ?? ""}
                              groupName={selectedGroup.name}
                              onSent={async () => {
                                await fetch("/api/settlements", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ groupId: selectedGroup.id, toUserId: s.to, amount: s.amount, note: "Interac e-Transfer" }),
                                })
                                loadBalances(selectedGroup.id)
                              }}
                            />
                          )}
                          <AddSettlementDialog
                            groupId={selectedGroup.id}
                            currency={selectedGroup.currency}
                            members={selectedGroup.members}
                            currentUserId={currentUserId}
                            suggestedTo={s.to}
                            suggestedAmount={s.amount}
                            onCreated={() => loadBalances(selectedGroup.id)}
                            compact
                            trigger={
                              <button className="text-[11px] border border-border rounded-md px-2 py-0.5 text-muted-foreground hover:bg-muted transition-colors ml-1">
                                Settle
                              </button>
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* History */}
              {recordedSettlements.length > 0 && (
                <>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">History</p>
                  <div className="space-y-1.5">
                    {recordedSettlements.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 text-sm">
                        <span className="text-foreground font-medium">{s.fromName}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-foreground font-medium">{s.toName}</span>
                        <div className="ml-auto text-right">
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                            {formatCurrency(s.amount, s.currency)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(s.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Group popup */}
      {showGroupPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGroupPopup(false)}>
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Select or create a group</h2>
              <button onClick={() => setShowGroupPopup(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectGroup(g)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors",
                    selectedGroup?.id === g.id
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30"
                      : "bg-muted/40 text-foreground hover:bg-muted border border-transparent"
                  )}
                >
                  {g.name}
                  {selectedGroup?.id === g.id && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-2">Create new group</p>
              <input
                type="text"
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGroup()}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <div className="flex gap-2">
                <button onClick={createGroup} disabled={creatingGroup || !newGroupName.trim()} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm py-2 transition-colors">
                  {creatingGroup ? "Creating…" : "Create"}
                </button>
                <button onClick={() => setShowGroupPopup(false)} className="px-4 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members popup */}
      {showMemberPopup && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setShowMemberPopup(false); setShowGuestForm(false) }}>
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Manage members</h2>
              <button onClick={() => { setShowMemberPopup(false); setShowGuestForm(false) }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-1.5 mb-3">
              {allParticipants.map((p) => {
                const key = p.type === "member" ? p.userId : `guest_${p.guestId}`
                const included = selectedForSplit.has(key)
                return (
                  <div key={key} className="flex items-center gap-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors pr-1">
                    <button
                      onClick={() => toggleSplit(key)}
                      className="flex items-center gap-2.5 px-3 py-2 flex-1 min-w-0"
                    >
                      <div className={cn(
                        "h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border",
                        included ? "bg-indigo-600 border-indigo-600" : "border-border"
                      )}>
                        {included && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="text-sm text-foreground flex-1 text-left truncate">{p.name}</span>
                      {p.type === "guest" && <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full px-1.5 py-0.5">guest</span>}
                    </button>
                    {p.type === "member" && (
                      <button
                        onClick={() => removeMember(p.userId, p.name)}
                        disabled={removingMemberId === p.userId}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
                        title="Remove from group"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {!showGuestForm ? (
              <button
                onClick={() => setShowGuestForm(true)}
                className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-indigo-300 hover:text-indigo-600 transition-colors mb-3"
              >
                <Plus className="h-3.5 w-3.5" /> Add a guest (no account needed)
              </button>
            ) : (
              <div className="border border-border rounded-lg p-3 mb-3 space-y-2">
                <input
                  type="text"
                  placeholder="Guest name *"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <input
                  type="email"
                  placeholder="Email (optional — links account later)"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <div className="flex gap-2">
                  <button onClick={addGuest} disabled={addingGuest || !guestName.trim()} className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs py-1.5 transition-colors">
                    {addingGuest ? "Adding…" : "Add guest"}
                  </button>
                  <button onClick={() => setShowGuestForm(false)} className="px-3 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2">Add a member</p>
              {/* Friends picker */}
              {(() => {
                const currentIds = new Set(selectedGroup?.members.map((m) => m.userId) ?? [])
                const available = friends.filter((f) => !currentIds.has(f.id))
                const filtered = friendSearch.trim()
                  ? available.filter((f) =>
                      f.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
                      f.email.toLowerCase().includes(friendSearch.toLowerCase())
                    )
                  : available
                return available.length > 0 ? (
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Search friends…"
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {filtered.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-1">No friends match.</p>
                      ) : filtered.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => { setAddMemberEmail(f.email); setFriendSearch("") }}
                          disabled={addMemberEmail === f.email}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                            addMemberEmail === f.email
                              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                              : "bg-muted/40 hover:bg-muted text-foreground"
                          )}
                        >
                          <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-[10px] font-semibold shrink-0">
                            {f.name[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{f.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{f.email}</p>
                          </div>
                          {addMemberEmail === f.email && <Check className="h-3.5 w-3.5 ml-auto shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
              {/* Email fallback */}
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Or add by email…"
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMember()}
                  className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <button onClick={addMember} disabled={addingMember || !addMemberEmail.trim()} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-3 transition-colors">
                  {addingMember ? "…" : "Add"}
                </button>
              </div>
            </div>

            <button
              onClick={() => { setShowMemberPopup(false); setShowGuestForm(false) }}
              className="w-full mt-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Edit expense popup */}
      {editingExpense && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingExpense(null)}>
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Edit expense</h2>
              <button onClick={() => setEditingExpense(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Amount ({selectedGroup.currency})</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Paid by</label>
                  <select
                    value={editPaidBy}
                    onChange={(e) => setEditPaidBy(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {selectedGroup.members.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Split will be recalculated equally among the same members.</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={saveEditExpense}
                disabled={savingEdit || !editDesc.trim() || !parseFloat(editAmount)}
                className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm py-2 transition-colors"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
              <button onClick={() => setEditingExpense(null)} className="px-4 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
