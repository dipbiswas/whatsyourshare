/**
 * POST /api/billing/topup
 * Creates a Stripe Checkout Session for a one-time scan top-up.
 * Body: { pack: "small" | "large" }
 *
 * small → 10 scans, $1.99
 * large → 50 scans, $6.99
 */
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { config } from "@/lib/config"
import { z } from "zod"

const schema = z.object({ pack: z.enum(["small", "large"]) })

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeCustomerId: true },
  })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const origin = req.headers.get("origin") ?? "http://localhost:3000"

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: session.user.id },
    })
    customerId = customer.id
    await prisma.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } })
  }

  const packCfg = parsed.data.pack === "small"
    ? await config.pricing.topupSmall()
    : await config.pricing.topupLarge()

  const stripeId = packCfg.stripeId
    || (parsed.data.pack === "small" ? process.env.STRIPE_PRICE_TOPUP_SMALL : process.env.STRIPE_PRICE_TOPUP_LARGE)
    || ""

  if (!stripeId) return NextResponse.json({ error: "Stripe price ID not configured for this pack. Please set it in Admin → Config." }, { status: 503 })

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: stripeId, quantity: 1 }],
    success_url: `${origin}/settings?topup=success`,
    cancel_url:  `${origin}/settings?topup=cancelled`,
    metadata: { userId: session.user.id, type: "scan_topup", pack: parsed.data.pack, scans: String(packCfg.scans) },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
