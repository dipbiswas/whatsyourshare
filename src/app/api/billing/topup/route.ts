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
import { z } from "zod"

export const TOPUP_PACKS = {
  small: { scans: 10, label: "10 AI scans",  priceId: process.env.STRIPE_PRICE_TOPUP_SMALL ?? "price_topup_small_placeholder", amount: 249  },
  large: { scans: 50, label: "50 AI scans",  priceId: process.env.STRIPE_PRICE_TOPUP_LARGE ?? "price_topup_large_placeholder", amount: 699  },
} as const

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

  const pack = TOPUP_PACKS[parsed.data.pack]

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: pack.priceId, quantity: 1 }],
    success_url: `${origin}/settings?topup=success`,
    cancel_url:  `${origin}/settings?topup=cancelled`,
    metadata: { userId: session.user.id, type: "scan_topup", pack: parsed.data.pack, scans: String(pack.scans) },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
