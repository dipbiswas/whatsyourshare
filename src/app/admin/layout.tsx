import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user.id) redirect("/login")

  const user = await (prisma.user.findUnique as any)({
    where: { id: session.user.id },
    select: { isAdmin: true, name: true, email: true },
  })
  if (!user?.isAdmin) redirect("/")

  return (
    <div className="flex h-full">
      <AdminSidebar user={{ name: user.name, email: user.email }} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
