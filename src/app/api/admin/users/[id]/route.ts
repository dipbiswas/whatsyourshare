import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-auth"
import { z } from "zod"

const patchSchema = z.object({
  plan: z.enum(["FREE", "PRO", "FAMILY"]).optional(),
  bonusScans: z.number().int().min(0).optional(),
  isAdmin: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const check = await requireAdmin()
  if (check instanceof NextResponse) return check

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await (prisma.user.update as any)({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, email: true, plan: true, isAdmin: true, bonusScans: true },
  })

  return NextResponse.json(user)
}
