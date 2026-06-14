import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const FROM = process.env.RESEND_FROM_EMAIL ?? "WhatsYourShare <noreply@whatsyourshare.app>"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "admin@whatsyourshare.app"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: tripId } = await params

  const trip = await prisma.trip.findFirst({
    where: { id: tripId },
    include: { fund: { include: { contributions: { where: { status: "PAID" } } } } },
  })

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  if (!trip.fund) return NextResponse.json({ error: "No fund" }, { status: 400 })

  // Only the trip creator (organizer) can request disbursement
  if (trip.createdById !== session.user.id) {
    return NextResponse.json({ error: "Only the organizer can request disbursement" }, { status: 403 })
  }

  const { method, details, totalCollected, currency } = await req.json()

  const organizer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  })

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `Disbursement Request — ${trip.name}`,
    html: `
      <h2>Fund Disbursement Request</h2>
      <p><strong>Trip:</strong> ${trip.name} (${tripId})</p>
      <p><strong>Organizer:</strong> ${organizer?.name ?? "Unknown"} (${organizer?.email ?? ""})</p>
      <p><strong>Amount to disburse:</strong> ${currency?.toUpperCase()} ${totalCollected}</p>
      <p><strong>Paid contributions:</strong> ${trip.fund.contributions.length}</p>
      <hr />
      <p><strong>Transfer method:</strong> ${method}</p>
      <p><strong>Payment details:</strong></p>
      <pre style="background:#f4f4f4;padding:12px;border-radius:6px">${details}</pre>
      <hr />
      <p style="color:#666;font-size:12px">Process this transfer within 2–3 business days and mark the fund as Disbursed in the admin panel.</p>
    `,
  })

  return NextResponse.json({ ok: true })
}
