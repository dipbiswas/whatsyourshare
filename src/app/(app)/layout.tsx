import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { PushProvider } from "@/components/providers/PushProvider"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-full">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <PushProvider />
    </div>
  )
}
