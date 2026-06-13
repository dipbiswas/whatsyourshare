import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const updateProfileSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  email: z.string().email().optional(),
})

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

  const { name, email } = parsed.data

  // Check email uniqueness if changing email
  if (email && email !== session.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { ...(name && { name }), ...(email && { email }) },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json(updated)
}
