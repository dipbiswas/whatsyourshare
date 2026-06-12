/**
 * GET /api/push/vapid-key
 * Returns the VAPID public key for client-side subscription creation.
 * Safe to expose — VAPID public key is not secret.
 */
import { NextResponse } from "next/server"
import { VAPID_PUBLIC_KEY } from "@/lib/push"

export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY })
}
