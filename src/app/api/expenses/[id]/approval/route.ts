import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(200).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: expenseId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      group: {
        include: {
          members: { where: { userId: session.user.id } },
        },
      },
    },
  })

  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!expense.group.members.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const newStatus = parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED"

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      approvalStatus: newStatus,
      approvedById: session.user.id,
      approvedAt: new Date(),
    },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  return NextResponse.json(updated)
}
