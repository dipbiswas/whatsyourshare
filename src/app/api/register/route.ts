import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  timezone: z.string().max(60).optional(),
  defaultCurrency: z.string().length(3).optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, email, password, timezone, defaultCurrency } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user.create as any)({
    data: {
      name, email, password: hashed,
      ...(timezone ? { timezone } : {}),
      ...(defaultCurrency ? { defaultCurrency } : {}),
    },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json(user, { status: 201 })
}
