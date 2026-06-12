import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder")

/** Platform fee rate — 1.5% of the contribution */
export const PLATFORM_FEE_RATE = 0.015
