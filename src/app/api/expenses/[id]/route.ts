import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  tripDayId: z.string().nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { group: { include: { members: true } } },
  })
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isMember = expense.group.members.some((m: { userId: string }) => m.userId === session.user.id)
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const updated = await prisma.expense.update({
    where: { id },
    data: { tripDayId: parsed.data.tripDayId ?? null },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { group: { include: { members: true } } },
  })
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isMember = expense.group.members.some((m: { userId: string }) => m.userId === session.user.id)
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
