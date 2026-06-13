import type { NextAuthConfig } from "next-auth"

/**
 * Edge-compatible auth config — NO Prisma, NO bcrypt.
 * Used by middleware only. Callbacks run on the Edge Runtime.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/register")
      const isPublic =
        isAuthPage ||
        pathname === "/" ||
        pathname.startsWith("/invite/") ||
        pathname.startsWith("/api/")

      if (isPublic) {
        // Redirect logged-in users away from auth pages
        if (isLoggedIn && isAuthPage) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
        return true
      }

      // Protected route — must be logged in
      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl))
      }

      return true
    },
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
}
