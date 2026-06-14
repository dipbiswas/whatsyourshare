import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
  dueDate: z.string().nullable().optional(),
  expenseId: z.string().nullable().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, itemId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (prisma as any).actionItem.findFirst({
    where: { id: itemId, tripId: id, trip: { group: { members: { some: { userId: session.user.id } } } } },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { dueDate, ...rest } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma as any).actionItem.update({
    where: { id: itemId },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
      expense: { select: { id: true, description: true, amount: true, currency: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, itemId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (prisma as any).actionItem.findFirst({
    where: { id: itemId, tripId: id, trip: { group: { members: { some: { userId: session.user.id } } } } },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).actionItem.delete({ where: { id: itemId } })
  return NextResponse.json({ success: true })
}
