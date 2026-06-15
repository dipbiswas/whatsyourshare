import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkScanQuota, deductScan } from "@/lib/scan-quota"
import { config } from "@/lib/config"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a receipt data extractor. Given an image of a receipt or bill, extract structured information and respond ONLY with a valid JSON object — no markdown, no explanation.

JSON shape:
{
  "description": "Short merchant name or what was purchased (max 60 chars)",
  "amount": 12.50,
  "date": "2024-01-15",
  "category": "one of: Food | Transport | Accommodation | Entertainment | Utilities | General",
  "lineItems": [
    { "description": "Item name", "amount": 5.00 }
  ],
  "confidence": 0.95
}

Rules:
- amount is the TOTAL (including tax/tip if visible)
- date in ISO format YYYY-MM-DD; use today if not visible
- category: pick the single best fit
- lineItems: include if the receipt has individual items; empty array if not
- confidence: 0-1 how confident you are in the extraction`

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI receipt scanning not configured" }, { status: 503 })
  }

  const userId = session.user.id
  const quota = await checkScanQuota(userId, "ai_scan")
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, message: quota.message },
      { status: quota.reason === "plan_limit" ? 403 : 429 },
    )
  }

  let imageBase64: string
  let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"

  try {
    const body = await req.json()
    imageBase64 = body.imageBase64
    mediaType = body.mediaType ?? "image/jpeg"
    if (!imageBase64) return NextResponse.json({ error: "imageBase64 required" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  try {
    const [aiModel, aiMaxTokens] = await Promise.all([
      config.platform.aiModel(),
      config.platform.aiMaxTokens(),
    ])
    const response = await client.messages.create({
      model: aiModel,
      max_tokens: aiMaxTokens,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: "Extract receipt data from this image." },
          ],
        },
      ],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()
    const parsed = JSON.parse(clean)

    await deductScan(userId, "ai_scan", quota.useBonus)

    const monthlyRemaining = Math.max(0, quota.monthlyLimit - quota.monthlyUsed - (quota.useBonus ? 0 : 1))
    const bonusAfter = quota.useBonus ? quota.bonusScans - 1 : quota.bonusScans

    return NextResponse.json({
      description: String(parsed.description ?? "").slice(0, 200),
      amount: Number(parsed.amount) || 0,
      date: String(parsed.date ?? new Date().toISOString().split("T")[0]),
      category: String(parsed.category ?? "General"),
      lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
      confidence: Number(parsed.confidence ?? 0.5),
      monthlyRemaining,
      bonusScans: bonusAfter,
    })
  } catch (err) {
    console.error("Receipt scan error:", err)
    return NextResponse.json({ error: "Failed to parse receipt" }, { status: 500 })
  }
}
