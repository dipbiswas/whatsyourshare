import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateGroupBalances, simplifyDebts, annotateTransfers } from "@/lib/balance"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const group = await prisma.group.findFirst({
    where: { id, members: { some: { userId: session.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      expenses: {
        where: {
          OR: [
            { visibility: "GROUP" },
            { paidById: session.user.id },
            { splits: { some: { userId: session.user.id } } },
          ],
        },
        include: {
          paidBy: { select: { id: true, name: true, avatar: true } },
          splits: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { date: "desc" },
      },
      settlements: {
        include: {
          fromUser: { select: { id: true, name: true, avatar: true } },
          toUser: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      recurringExpenses: {
        where: { isActive: true },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { nextDueDate: "asc" },
      },
    },
  })

  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 })

  const nameMap: Record<string, string> = {}
  for (const m of group.members) nameMap[m.userId] = m.user.name

  const balanceMap = calculateGroupBalances(
    group.members.map((m) => ({ userId: m.userId })),
    group.expenses.map((e) => ({
      paidById: e.paidById,
      amount: e.amount,
      splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
    })),
    group.settlements.map((s) => ({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount }))
  )

  const suggestedSettlements = simplifyDebts(balanceMap, nameMap)

  const expensesForAnnotation = group.expenses.map((e) => ({
    id: e.id,
    description: e.description,
    date: e.date.toISOString(),
    paidById: e.paidById,
    splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
  }))

  const annotatedSettlements = annotateTransfers(suggestedSettlements, expensesForAnnotation, nameMap)

  return NextResponse.json({ ...group, balanceMap, suggestedSettlements: annotatedSettlements })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const member = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: session.user.id, role: "ADMIN" },
  })
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.group.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
