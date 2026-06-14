import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params

  const isMember = await prisma.groupMember.findFirst({ where: { groupId, userId: session.user.id } })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const email = parsed.data.email || null

  // If email given and matches an existing user, add them as a real member instead
  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const alreadyMember = await prisma.groupMember.findFirst({ where: { groupId, userId: existingUser.id } })
      if (alreadyMember) return NextResponse.json({ error: "This person already has an account and is in the group" }, { status: 409 })
      const member = await prisma.groupMember.create({
        data: { groupId, userId: existingUser.id },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      })
      return NextResponse.json({ type: "member", member }, { status: 201 })
    }
  }

  const guest = await (prisma as any).guestMember.create({
    data: { groupId, name: parsed.data.name, email, createdById: session.user.id },
  })

  return NextResponse.json({ type: "guest", guest }, { status: 201 })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params

  const isMember = await prisma.groupMember.findFirst({ where: { groupId, userId: session.user.id } })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const guests = await (prisma as any).guestMember.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(guests)
}
