import { prisma } from "@/lib/prisma"

/**
 * After a user signs up or logs in, check if any GuestMember records share
 * their email. If so, reassign all splits to the real user and mark the
 * guest as linked. The guest record is kept for audit purposes.
 */
export async function mergeGuestProfiles(userId: string, email: string) {
  const guests = await (prisma as any).guestMember.findMany({
    where: { email, linkedUserId: null },
  })

  if (guests.length === 0) return

  for (const guest of guests) {
    // Reassign splits from guest to real user
    await (prisma as any).expenseSplit.updateMany({
      where: { guestMemberId: guest.id },
      data: { guestMemberId: null, userId },
    })

    // Add the user as a group member if not already
    const alreadyMember = await prisma.groupMember.findFirst({
      where: { groupId: guest.groupId, userId },
    })
    if (!alreadyMember) {
      await prisma.groupMember.create({
        data: { groupId: guest.groupId, userId, role: "MEMBER" },
      })
    }

    // Mark guest as linked
    await (prisma as any).guestMember.update({
      where: { id: guest.id },
      data: { linkedUserId: userId },
    })
  }
}
