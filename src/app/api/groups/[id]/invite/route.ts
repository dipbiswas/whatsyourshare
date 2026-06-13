/**
 * POST /api/groups/[id]/invite
 * Send an email invite to a non-member.
 * Body: { email: string }
 *
 * GET /api/groups/[id]/invite
 * List pending invites for this group.
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendInviteEmail } from "@/lib/email"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
  splitValue: z.number().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { email, splitValue } = parsed.data

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Check if already a member
  const alreadyMember = await prisma.groupMember.findFirst({
    where: { groupId, user: { email } },
  })
  if (alreadyMember) return NextResponse.json({ error: "This person is already in the group" }, { status: 409 })

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } })
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Create or refresh invite (upsert by groupId + email)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const existing = await prisma.groupInvite.findFirst({
    where: { groupId, email, acceptedAt: null },
  })

  let invite
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invite = await (prisma.groupInvite.update as any)({
      where: { id: existing.id },
      data: { expiresAt, createdById: session.user.id, ...(splitValue != null ? { splitValue } : {}) },
    })
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invite = await (prisma.groupInvite.create as any)({
      data: { groupId, email, createdById: session.user.id, expiresAt, ...(splitValue != null ? { splitValue } : {}) },
    })
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000"
  const inviteUrl = `${origin}/invite/${invite.token}`

  try {
    await sendInviteEmail({
      to: email,
      inviterName: session.user.name ?? "Someone",
      groupName: group.name,
      inviteUrl,
    })
  } catch (err) {
    console.error("Failed to send invite email:", err)
    // Don't fail the request — return the link so the inviter can share manually
    return NextResponse.json({ invite, inviteUrl, emailSent: false }, { status: 201 })
  }

  return NextResponse.json({ invite, inviteUrl, emailSent: true }, { status: 201 })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: groupId } = await params
  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId: session.user.id },
  })
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const invites = await prisma.groupInvite.findMany({
    where: { groupId, acceptedAt: null, expiresAt: { gt: new Date() } },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(invites)
}
