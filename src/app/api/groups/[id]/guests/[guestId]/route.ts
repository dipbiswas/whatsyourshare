import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
})

async function resolveGuest(groupId: string, guestId: string) {
  return (prisma as any).guestMember.findFirst({ where: { id: guestId, groupId } })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId, guestId } = await params

  const admin = await prisma.groupMember.findFirst({ where: { groupId, userId: session.user.id, role: "ADMIN" } })
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const guest = await resolveGuest(groupId, guestId)
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const email = parsed.data.email !== undefined ? (parsed.data.email || null) : undefined

  const updated = await (prisma as any).guestMember.update({
    where: { id: guestId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(email !== undefined ? { email } : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId, guestId } = await params

  const admin = await prisma.groupMember.findFirst({ where: { groupId, userId: session.user.id, role: "ADMIN" } })
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const guest = await resolveGuest(groupId, guestId)
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 })

  await (prisma as any).guestMember.delete({ where: { id: guestId } })

  return NextResponse.json({ success: true })
}
