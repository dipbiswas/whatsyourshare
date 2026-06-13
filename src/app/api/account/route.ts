import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const updateProfileSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional().nullable(),
  defaultCurrency: z.string().length(3).optional(),
  timezone: z.string().max(60).optional(),
  notificationPrefs: z.record(z.string(), z.boolean()).optional(),
  avatar: z.string().max(200000).optional().nullable(), // base64 data URL, ~150KB max
})

// GET /api/account — return full profile
export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user.findUnique as any)({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, defaultCurrency: true, timezone: true, notificationPrefs: true, avatar: true },
  })
  return NextResponse.json(user)
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

// PATCH /api/account — update profile (name / email)
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Detect which operation: password change vs profile update
  if ("currentPassword" in body || "newPassword" in body) {
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })

    const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
    await prisma.user.update({ where: { id: session.user.id }, data: { password: hashed } })

    return NextResponse.json({ ok: true })
  }

  // Profile update
  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const { name, email, phone, defaultCurrency, timezone, notificationPrefs, avatar } = parsed.data

  // Check email uniqueness if changing email
  if (email && email !== session.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.user.update as any)({
    where: { id: session.user.id },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(phone !== undefined ? { phone } : {}),
      ...(defaultCurrency ? { defaultCurrency } : {}),
      ...(timezone ? { timezone } : {}),
      ...(notificationPrefs !== undefined ? { notificationPrefs } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
    },
    select: { id: true, name: true, email: true, phone: true, defaultCurrency: true, timezone: true, notificationPrefs: true, avatar: true },
  })

  return NextResponse.json(updated)
}

// DELETE /api/account — permanently delete the account
export async function DELETE() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = session.user.id

  // Delete in dependency order to avoid FK violations
  await prisma.expenseSplit.deleteMany({ where: { userId: id } })
  await prisma.settlement.deleteMany({ where: { OR: [{ fromUserId: id }, { toUserId: id }] } })
  await prisma.expense.deleteMany({ where: { paidById: id } })
  await prisma.groupMember.deleteMany({ where: { userId: id } })
  await prisma.pushSubscription.deleteMany({ where: { userId: id } })
  await prisma.session.deleteMany({ where: { userId: id } })
  await prisma.account.deleteMany({ where: { userId: id } })
  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
