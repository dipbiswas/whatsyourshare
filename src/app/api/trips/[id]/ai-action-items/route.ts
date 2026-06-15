import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { checkScanQuota, deductScan } from "@/lib/scan-quota"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const trip = await prisma.trip.findFirst({
    where: { id, group: { members: { some: { userId: session.user.id } } } },
    include: {
      group: { select: { currency: true, members: { include: { user: { select: { name: true } } } } } },
    },
  })
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const quota = await checkScanQuota(session.user.id, "ai_scan")
  if (!quota.allowed) return NextResponse.json({ error: quota.message, reason: quota.reason }, { status: quota.reason === "plan_limit" ? 403 : 429 })

  const { description, existingItems } = await req.json() as {
    description: string
    existingItems: string[]
  }

  const memberNames = trip.group.members.map((m) => m.user.name)
  const startDate = new Date(trip.startDate)
  const endDate = new Date(trip.endDate)
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

  const systemPrompt = `You are a helpful event planning assistant. Generate practical action items for an event based on the details provided. Return ONLY valid JSON — no markdown, no explanation, just the JSON object.`

  const userPrompt = `Generate action items for this event:

Event name: ${trip.name}
Event type: ${trip.eventType ?? "TRIP"}
${trip.destination ? `Destination: ${trip.destination}` : ""}
Dates: ${startDate.toDateString()} to ${endDate.toDateString()} (${days} day${days !== 1 ? "s" : ""})
Number of people: ${memberNames.length} (${memberNames.join(", ")})
Currency: ${trip.group.currency}
Additional context: ${description || "None provided"}
${existingItems.length > 0 ? `Already planned (do NOT duplicate): ${existingItems.join(", ")}` : ""}

Return a JSON object with this exact shape:
{
  "preEvent": [
    { "title": "...", "description": "..." }
  ],
  "dayOf": [
    { "title": "...", "description": "...", "suggestedDay": 1 }
  ]
}

Rules:
- preEvent: 5-8 tasks to do BEFORE the event (bookings, packing, logistics, communication)
- dayOf: 4-6 items that happen ON THE DAY and likely involve spending money (meals, activities, transport, supplies)
- suggestedDay: which day number (1-${days}) the day-of item most likely falls on
- Keep titles concise (under 60 chars)
- descriptions can be null if obvious
- Tailor specifically to the event type, destination, group size, and context provided`

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    const raw = message.content[0].type === "text" ? message.content[0].text : ""
    // Strip markdown code fences if present
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
    let parsed: { preEvent?: unknown[]; dayOf?: unknown[] }
    try {
      parsed = JSON.parse(text)
    } catch (parseErr) {
      console.error("[AI action items] JSON parse error:", parseErr, "\nRaw response:", raw)
      return NextResponse.json({ error: "AI returned an unexpected response format. Please try again." }, { status: 500 })
    }

    await deductScan(session.user.id, "ai_scan", quota.useBonus)

    return NextResponse.json({
      preEvent: parsed.preEvent ?? [],
      dayOf: parsed.dayOf ?? [],
      scansRemaining: quota.useBonus
        ? quota.bonusScans - 1
        : quota.monthlyLimit - quota.monthlyUsed - 1,
    })
  } catch (err) {
    console.error("[AI action items]", err)
    return NextResponse.json({ error: "Failed to generate items" }, { status: 500 })
  }
}
