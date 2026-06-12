import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const policySchema = z.object({
  maxAmountNoReceipt: z.number().min(0).default(25),
  requiresApprovalAbove: z.number().min(0).default(100),
  allowedCategories: z.array(z.string()).default([]),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params
  const isMember = await prisma.groupMember.findFirst({ where: { groupId, userId: session.user.id } })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const policy = await prisma.expensePolicy.findUnique({ where: { groupId } })
  return NextResponse.json(policy)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params
  const isMember = await prisma.groupMember.findFirst({ where: { groupId, userId: session.user.id } })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = policySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { allowedCategories, ...rest } = parsed.data

  const policy = await prisma.expensePolicy.upsert({
    where: { groupId },
    create: { groupId, ...rest, allowedCategories: allowedCategories.join(",") },
    update: { ...rest, allowedCategories: allowedCategories.join(",") },
  })

  return NextResponse.json(policy)
}
