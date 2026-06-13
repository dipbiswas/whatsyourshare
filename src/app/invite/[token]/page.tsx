/**
 * /invite/[token]
 *
 * Invite acceptance page.
 * - If user is logged in: auto-adds them to the group, redirects to group page.
 * - If not logged in: shows login/register prompt with token preserved.
 */
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, Users, XCircle } from "lucide-react"

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const session = await auth()

  const invite = await prisma.groupInvite.findUnique({
    where: { token },
    include: {
      group: { select: { id: true, name: true, description: true } },
      createdBy: { select: { name: true } },
    },
  })

  // Invalid token
  if (!invite) {
    return (
      <InviteLayout>
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Invalid invite</h1>
        <p className="text-gray-500 mt-2">This invite link is invalid or has already been used.</p>
        <Link href="/dashboard">
          <Button className="mt-6 bg-indigo-600 hover:bg-indigo-700">Go to Dashboard</Button>
        </Link>
      </InviteLayout>
    )
  }

  // Expired
  if (invite.expiresAt < new Date() || invite.acceptedAt) {
    return (
      <InviteLayout>
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900">Invite expired</h1>
        <p className="text-gray-500 mt-2">
          This invite has expired. Ask {invite.createdBy.name} to send a new one.
        </p>
      </InviteLayout>
    )
  }

  // Not logged in — check if the invited email has an existing account
  if (!session?.user.id) {
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    })

    return (
      <InviteLayout>
        <Users className="h-12 w-12 text-indigo-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900">
          Join &ldquo;{invite.group.name}&rdquo;
        </h1>
        <p className="text-gray-500 mt-2">
          {invite.createdBy.name} invited you to split expenses in{" "}
          <strong>{invite.group.name}</strong>.
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {existingUser ? "Sign in to accept this invitation." : "Create a free account to accept this invitation."}
        </p>
        <div className="flex gap-3 mt-6 justify-center">
          {existingUser ? (
            <Link href={`/login?callbackUrl=/invite/${token}`}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">Sign in</Button>
            </Link>
          ) : (
            <Link href={`/register?callbackUrl=/invite/${token}&email=${encodeURIComponent(invite.email)}`}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">Create account</Button>
            </Link>
          )}
        </div>
      </InviteLayout>
    )
  }

  // Logged in — process acceptance
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } })

  // Check email matches (optional enforcement)
  // if (user?.email !== invite.email) { ... show mismatch warning }

  // Already a member?
  const existing = await prisma.groupMember.findFirst({
    where: { groupId: invite.group.id, userId: session.user.id },
  })

  if (!existing) {
    await prisma.groupMember.create({
      data: { groupId: invite.group.id, userId: session.user.id, role: "MEMBER" },
    })
  }

  // Apply stored split value to group's defaultSplitShares if present
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inviteWithSplit = invite as any
  if (inviteWithSplit.splitValue != null && inviteWithSplit.splitValue > 0) {
    const group = await prisma.group.findUnique({
      where: { id: invite.group.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: { defaultSplitShares: true } as any,
    })
    const existing_shares = ((group as any)?.defaultSplitShares ?? {}) as Record<string, number>
    const updated_shares = { ...existing_shares, [session.user.id]: inviteWithSplit.splitValue }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.group.update as any)({
      where: { id: invite.group.id },
      data: { defaultSplitShares: updated_shares },
    })
  }

  await prisma.groupInvite.update({
    where: { token },
    data: { acceptedAt: new Date() },
  })

  redirect(`/groups/${invite.group.id}`)
}

function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-0 shadow-lg text-center">
        <CardHeader>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <span className="text-white font-bold text-sm">$</span>
            </div>
            <span className="font-semibold text-gray-900">WhatsYourShare</span>
          </div>
        </CardHeader>
        <CardContent className="pb-8">{children}</CardContent>
      </Card>
    </div>
  )
}
