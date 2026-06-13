import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  lastAmount: z.number().positive().optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]).optional(),
  nextDueDate: z.string().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.recurringExpense.findFirst({
    where: { id },
    include: { group: { include: { members: { where: { userId: session.user.id } } } } },
  })

  if (!existing || existing.group.members.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { nextDueDate, ...rest } = parsed.data

  const updated = await prisma.recurringExpense.update({
    where: { id },
    data: {
      ...rest,
      ...(nextDueDate ? { nextDueDate: new Date(nextDueDate) } : {}),
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.recurringExpense.findFirst({
    where: { id },
    include: { group: { include: { members: { where: { userId: session.user.id } } } } },
  })

  if (!existing || existing.group.members.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.recurringExpense.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
