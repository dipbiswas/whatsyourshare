import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { AuthSessionProvider } from "@/components/providers/SessionProvider"
import { ThemeProvider } from "@/components/providers/ThemeProvider"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })

export const metadata: Metadata = {
  title: "WhatsYourShare — Split expenses effortlessly",
  description: "Enterprise expense splitting for teams and groups",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WhatsYourShare",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#7c3aed",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full font-sans antialiased">
        <AuthSessionProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthSessionProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
