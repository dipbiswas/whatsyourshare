import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({ uiMode: z.enum(["QUICK_SPLIT", "FULL"]) })

export async function GET() {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { uiMode: true } })
  return NextResponse.json({ uiMode: (user as any)?.uiMode ?? "FULL" })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid mode" }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { uiMode: parsed.data.uiMode },
  })

  return NextResponse.json({ uiMode: parsed.data.uiMode })
}
