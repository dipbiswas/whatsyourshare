import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const appUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    console.log("[connect/onboard] appUrl:", appUrl, "userId:", session.user.id)

    let connectId = user.stripeConnectId

    if (!connectId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: { userId: user.id },
      })
      connectId = account.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeConnectId: connectId },
      })
      console.log("[connect/onboard] created Connect account:", connectId)
    }

    const accountLink = await stripe.accountLinks.create({
      account: connectId,
      refresh_url: `${appUrl}/settings?connect=refresh`,
      return_url: `${appUrl}/settings?connect=success`,
      type: "account_onboarding",
    })

    console.log("[connect/onboard] onboarding link created")
    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[connect/onboard] error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
