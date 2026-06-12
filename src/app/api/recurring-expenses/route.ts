import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { addWeeks, addMonths, addQuarters } from "date-fns"

const schema = z.object({
  groupId: z.string(),
  description: z.string().min(1).max(200),
  lastAmount: z.number().positive(),
  currency: z.string().default("USD"),
  category: z.string().default("General"),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE"]).default("EQUAL"),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).default("MONTHLY"),
  nextDueDate: z.string(), // ISO date string
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get("groupId")
  if (!groupId) return NextResponse.json({ error: "groupId required" }, { status: 400 })

  // Verify membership
  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const recurring = await prisma.recurringExpense.findMany({
    where: { groupId, isActive: true },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { nextDueDate: "asc" },
  })

  return NextResponse.json(recurring)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { nextDueDate, ...rest } = parsed.data

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId: rest.groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const recurring = await prisma.recurringExpense.create({
    data: {
      ...rest,
      nextDueDate: new Date(nextDueDate),
      createdById: session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  return NextResponse.json(recurring, { status: 201 })
}

export function nextDueAfter(current: Date, frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY"): Date {
  if (frequency === "WEEKLY") return addWeeks(current, 1)
  if (frequency === "QUARTERLY") return addQuarters(current, 1)
  return addMonths(current, 1)
}
