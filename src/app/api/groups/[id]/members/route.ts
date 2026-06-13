import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notifyUser, sendAddedToGroupEmail } from "@/lib/email"
import { z } from "zod"

const addMemberSchema = z.object({ email: z.string().email() })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = addMemberSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const existing = await prisma.groupMember.findFirst({ where: { groupId: id, userId: user.id } })
  if (existing) return NextResponse.json({ error: "User already in group" }, { status: 409 })

  const member = await prisma.groupMember.create({
    data: { groupId: id, userId: user.id },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  })

  // Notify the added user — fire and forget
  const group = await prisma.group.findUnique({ where: { id }, select: { name: true } })
  const adder = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
  notifyUser(user.id, "addedToGroup", (to, name) =>
    sendAddedToGroupEmail({
      to, name,
      inviterName: adder?.name ?? "Someone",
      groupName: group?.name ?? "a group",
      groupId: id,
    })
  ).catch(() => {})

  return NextResponse.json(member, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { userId } = await req.json()

  const admin = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: session.user.id, role: "ADMIN" },
  })
  if (!admin && session.user.id !== userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.groupMember.deleteMany({ where: { groupId: id, userId } })
  return NextResponse.json({ success: true })
}
