export interface BalanceTransfer {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}

export interface DebtReason {
  expenseId: string
  description: string
  date: string
  paidByName: string
  shareAmount: number
}

export interface AnnotatedTransfer extends BalanceTransfer {
  reasons: DebtReason[]
  hasRerouting: boolean // true when simplified debt crosses people who never shared an expense
}

// Guest keys use "guest_<id>" prefix to avoid collision with user IDs
export function guestKey(guestId: string) { return `guest_${guestId}` }
export function isGuestKey(key: string) { return key.startsWith("guest_") }

export function calculateGroupBalances(
  members: { userId: string }[],
  expenses: { paidById: string; amount: number; splits: { userId?: string | null; guestMemberId?: string | null; amount: number }[] }[],
  settlements: { fromUserId: string; toUserId: string; amount: number }[],
  guests?: { id: string }[]
): Record<string, number> {
  const balance: Record<string, number> = {}
  for (const m of members) balance[m.userId] = 0
  for (const g of guests ?? []) balance[guestKey(g.id)] = 0

  for (const e of expenses) {
    balance[e.paidById] = (balance[e.paidById] ?? 0) + e.amount
    for (const s of e.splits) {
      const key = s.userId ?? (s.guestMemberId ? guestKey(s.guestMemberId) : null)
      if (key) balance[key] = (balance[key] ?? 0) - s.amount
    }
  }

  for (const s of settlements) {
    balance[s.fromUserId] = (balance[s.fromUserId] ?? 0) + s.amount
    balance[s.toUserId] = (balance[s.toUserId] ?? 0) - s.amount
  }

  return balance
}

export function simplifyDebts(
  balanceMap: Record<string, number>,
  nameMap: Record<string, string>
): BalanceTransfer[] {
  const creditors: { userId: string; amount: number }[] = []
  const debtors: { userId: string; amount: number }[] = []

  for (const [userId, balance] of Object.entries(balanceMap)) {
    if (balance > 0.01) creditors.push({ userId, amount: balance })
    else if (balance < -0.01) debtors.push({ userId, amount: -balance })
  }

  const transfers: BalanceTransfer[] = []
  let i = 0
  let j = 0

  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amount, debtors[j].amount)
    transfers.push({
      from: debtors[j].userId,
      fromName: nameMap[debtors[j].userId] ?? "Unknown",
      to: creditors[i].userId,
      toName: nameMap[creditors[i].userId] ?? "Unknown",
      amount: Math.round(amount * 100) / 100,
    })
    creditors[i].amount -= amount
    debtors[j].amount -= amount
    if (creditors[i].amount < 0.01) i++
    if (debtors[j].amount < 0.01) j++
  }

  return transfers
}

/**
 * For each simplified-debt transfer (from → to), attach the real expenses
 * that explain *why* the debtor owes money. We look for expenses where
 * `to` paid and `from` was a split participant, which covers the direct case.
 * When the simplification reroutes debt across people who never shared an
 * expense directly we flag `hasRerouting = true` so the UI can explain it.
 */
export function annotateTransfers(
  transfers: BalanceTransfer[],
  expenses: {
    id: string
    description: string
    date: string
    paidById: string
    splits: { userId?: string | null; guestMemberId?: string | null; amount: number }[]
  }[],
  nameMap: Record<string, string>
): AnnotatedTransfer[] {
  return transfers.map((t) => {
    const reasons: DebtReason[] = []
    for (const e of expenses) {
      if (e.paidById !== t.to) continue
      const split = e.splits.find((s) => (s.userId ?? (s.guestMemberId ? guestKey(s.guestMemberId) : null)) === t.from)
      if (split) {
        reasons.push({
          expenseId: e.id,
          description: e.description,
          date: e.date,
          paidByName: nameMap[t.to] ?? "Unknown",
          shareAmount: split.amount,
        })
      }
    }
    const directTotal = reasons.reduce((s, r) => s + r.shareAmount, 0)
    return {
      ...t,
      reasons,
      hasRerouting: Math.abs(directTotal - t.amount) > 0.02,
    }
  })
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}
