/**
 * GET /api/friends/balances
 *
 * Aggregates debts between the current user and each other person
 * across ALL groups they share. Returns an array sorted by absolute amount desc.
 *
 * Response shape:
 * [{ userId, name, avatar, netBalance, currency, groups: [{id, name, balance}] }]
 *
 * Positive netBalance = they owe you. Negative = you owe them.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateGroupBalances } from "@/lib/balance"

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
      },
      expenses: {
        where: {
          OR: [
            { visibility: "GROUP" },
            { paidById: userId },
            { splits: { some: { userId } } },
          ],
        },
        select: {
          paidById: true,
          amount: true,
          splits: { select: { userId: true, amount: true } },
        },
      },
      settlements: {
        select: { fromUserId: true, toUserId: true, amount: true, status: true },
      },
    },
  })

  // Map: otherId → { user info, netBalance, groups[] }
  const friendMap = new Map<
    string,
    {
      userId: string
      name: string
      avatar: string | null
      netBalance: number
      currency: string
      groups: { id: string; name: string; balance: number }[]
    }
  >()

  for (const group of groups) {
    const completedSettlements = group.settlements.filter((s) => s.status === "COMPLETED")
    const balanceMap = calculateGroupBalances(
      group.members,
      group.expenses,
      completedSettlements
    )

    const myBalance = balanceMap[userId] ?? 0
    if (Math.abs(myBalance) < 0.01) continue

    // Figure out who composes my balance in this group (simplified: proportional to their balance)
    for (const member of group.members) {
      if (member.userId === userId) continue

      const theirBalance = balanceMap[member.userId] ?? 0

      // If I'm owed (myBalance > 0) then people with negative balances owe me
      // If I owe (myBalance < 0) then I owe people with positive balances
      // Simple cross-group aggregation: attribute proportionally
      let contribution = 0
      if (myBalance > 0.01 && theirBalance < -0.01) {
        // They owe (part of) my credit
        const totalNegative = Object.values(balanceMap)
          .filter((b) => b < -0.01)
          .reduce((s, b) => s + Math.abs(b), 0)
        contribution = totalNegative > 0 ? myBalance * (Math.abs(theirBalance) / totalNegative) : 0
      } else if (myBalance < -0.01 && theirBalance > 0.01) {
        // I owe (part of) their credit
        const totalPositive = Object.values(balanceMap)
          .filter((b) => b > 0.01)
          .reduce((s, b) => s + b, 0)
        contribution = totalPositive > 0 ? myBalance * (theirBalance / totalPositive) : 0
      }

      if (Math.abs(contribution) < 0.01) continue

      const existing = friendMap.get(member.userId)
      if (existing) {
        existing.netBalance += contribution
        existing.groups.push({ id: group.id, name: group.name, balance: contribution })
      } else {
        friendMap.set(member.userId, {
          userId: member.userId,
          name: member.user.name,
          avatar: member.user.avatar,
          netBalance: contribution,
          currency: group.currency,
          groups: [{ id: group.id, name: group.name, balance: contribution }],
        })
      }
    }
  }

  const result = Array.from(friendMap.values())
    .filter((f) => Math.abs(f.netBalance) > 0.01)
    .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
    .map((f) => ({ ...f, netBalance: Math.round(f.netBalance * 100) / 100 }))

  return NextResponse.json(result)
}
