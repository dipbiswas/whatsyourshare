import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const settlement = await prisma.settlement.findFirst({
    where: { id },
    include: { group: { include: { members: { where: { userId: session.user.id } } } } },
  })

  if (!settlement || settlement.group.members.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.settlement.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
