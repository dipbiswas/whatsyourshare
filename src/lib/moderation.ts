import { prisma } from "@/lib/prisma"

// Basic keyword lists — extend as needed
const PROFANITY = [
  "fuck", "shit", "ass", "bitch", "cunt", "dick", "cock", "pussy", "bastard",
  "asshole", "motherfucker", "faggot", "nigger", "nigga", "whore", "slut",
]

const SPAM_PATTERNS = [
  /https?:\/\/\S+/i,        // URLs in expense descriptions
  /\b(buy|click|free|win|prize|crypto|bitcoin|nft|invest)\b.*\b(now|here|click|link)\b/i,
  /(.)\1{6,}/,              // repeated characters: "aaaaaaaaa"
]

const HARASSMENT = [
  "kill yourself", "kys", "go die", "i hate you", "you suck", "loser", "idiot",
]

export interface ModerationResult {
  flagged: boolean
  reason: string | null
}

export function moderateText(text: string): ModerationResult {
  const lower = text.toLowerCase()

  for (const word of PROFANITY) {
    // Word-boundary check to avoid false positives (e.g. "bass", "classic")
    const re = new RegExp(`\\b${word}\\b`, "i")
    if (re.test(lower)) return { flagged: true, reason: "profanity" }
  }

  for (const phrase of HARASSMENT) {
    if (lower.includes(phrase)) return { flagged: true, reason: "harassment" }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) return { flagged: true, reason: "spam" }
  }

  return { flagged: false, reason: null }
}

type EntityType = "EXPENSE" | "GROUP" | "TRIP" | "ACTION_ITEM" | "RECURRING_EXPENSE"

export async function checkAndFlag(
  entityType: EntityType,
  entityId: string,
  text: string,
  reportedById?: string,
): Promise<void> {
  const result = moderateText(text)
  if (!result.flagged) return

  // Avoid duplicate flags for the same entity
  const existing = await (prisma.contentFlag as any).findFirst({
    where: { entityType, entityId, status: "PENDING" },
  })
  if (existing) return

  await (prisma.contentFlag as any).create({
    data: {
      entityType,
      entityId,
      entitySnap: text.slice(0, 500),
      reason: result.reason!,
      autoFlagged: !reportedById,
      reportedById: reportedById ?? null,
    },
  })
}
