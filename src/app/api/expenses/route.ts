import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushToGroup } from "@/lib/push"
import { notifyUser, sendExpenseNotificationEmail } from "@/lib/email"
import { checkAndFlag } from "@/lib/moderation"
import { z } from "zod"

const splitSchema = z.object({
  userId: z.string().optional(),
  guestMemberId: z.string().optional(),
  amount: z.number().positive(),
}).refine((d) => d.userId || d.guestMemberId, { message: "Each split must have a userId or guestMemberId" })

const expenseSchema = z.object({
  groupId: z.string(),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().default("General"),
  currency: z.string().length(3).default("USD"),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SELECTED"]).default("EQUAL"),
  visibility: z.enum(["GROUP", "PAYERS_ONLY"]).default("GROUP"),
  paidById: z.string(),
  date: z.string().optional(),
  splits: z.array(splitSchema).min(1),
  recurringExpenseId: z.string().optional(),
  guestPayeeName: z.string().max(100).optional(),
  tripDayId: z.string().optional(),
  tripId: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expenses = await (prisma.expense as any).findMany({
    where: { group: { members: { some: { userId } } } },
    include: {
      group: { select: { id: true, name: true } },
      paidBy: { select: { id: true, name: true } },
      tripDay: { select: { trip: { select: { id: true, name: true, coverEmoji: true } } } },
      trip: { select: { id: true, name: true, coverEmoji: true } },
    },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(expenses)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = expenseSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { splits, date, guestPayeeName, tripDayId, tripId, ...rest } = parsed.data

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId: rest.groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const expense = await prisma.expense.create({
    data: {
      ...rest,
      date: date ? new Date(date) : new Date(),
      ...(guestPayeeName ? { guestPayeeName } : {}),
      ...(tripDayId ? { tripDayId } : {}),
      ...(tripId ? { tripId } : {}),
      splits: { createMany: { data: splits.map((s) => ({ userId: s.userId ?? null, guestMemberId: s.guestMemberId ?? null, amount: s.amount })) } },
    },
    include: {
      paidBy: { select: { id: true, name: true, avatar: true } },
      splits: { include: { user: { select: { id: true, name: true } }, guest: ({ select: { id: true, name: true } } as any) } },
    },
  })

  await prisma.group.update({ where: { id: rest.groupId }, data: { updatedAt: new Date() } })

  // Push + email notifications — fire-and-forget
  const group = await prisma.group.findUnique({
    where: { id: rest.groupId },
    select: { name: true, members: { select: { userId: true } } },
  })
  sendPushToGroup(rest.groupId, session.user.id, {
    title: `New expense in ${group?.name ?? "your group"}`,
    body: `${expense.paidBy.name} added "${expense.description}" · $${expense.amount.toFixed(2)}`,
    url: `/groups/${rest.groupId}`,
    tag: `expense-${expense.id}`,
  }).catch(() => {})

  // Email every group member except the one who added it
  const otherMembers = (group?.members ?? []).filter((m) => m.userId !== session.user.id)
  for (const m of otherMembers) {
    notifyUser(m.userId, "expenseAdded", (to, name) =>
      sendExpenseNotificationEmail({
        to, name,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        groupName: group?.name ?? "your group",
        paidByName: expense.paidBy.name,
        dashboardUrl: `${process.env.NEXTAUTH_URL ?? ""}/groups/${rest.groupId}`,
      })
    ).catch(() => {})
  }

  // Fire-and-forget moderation check
  checkAndFlag("EXPENSE", expense.id, expense.description, session.user.id).catch(() => {})

  return NextResponse.json(expense, { status: 201 })
}
