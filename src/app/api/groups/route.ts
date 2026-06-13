import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { calculateGroupBalances } from "@/lib/balance"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).default("USD"),
  defaultSplitType: z.string().default("EQUAL"),
  defaultSplitShares: z.record(z.string(), z.number()).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      _count: { select: { expenses: true } },
      expenses: {
        select: { paidById: true, amount: true, splits: { select: { userId: true, amount: true } } },
      },
      settlements: {
        select: { fromUserId: true, toUserId: true, amount: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  const result = groups.map(({ expenses, settlements, ...g }) => {
    const balanceMap = calculateGroupBalances(
      g.members.map((m) => ({ userId: m.userId })),
      expenses,
      settlements,
    )
    const myBalance = Math.round((balanceMap[userId] ?? 0) * 100) / 100
    return { ...g, myBalance }
  })

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = await (prisma.group.create as any)({
    data: {
      ...parsed.data,
      createdById: session.user.id,
      members: { create: { userId: session.user.id, role: "ADMIN" } },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      _count: { select: { expenses: true } },
    },
  })

  return NextResponse.json(group, { status: 201 })
}
