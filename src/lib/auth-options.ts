import { type AuthOptions } from "next-auth"
import InstagramProvider from "next-auth/providers/instagram"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/db"
import { isAdminEmail } from "@/lib/admin"

const providers: AuthOptions["providers"] = []

if (process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET) {
  providers.push(
    InstagramProvider({
      clientId: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    })
  )
}

providers.push(
  CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.passwordHash || user.disabledAt) {
          return null
        }

        const isValid = await compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return { id: user.id, email: user.email, name: user.name }
      },
  })
)

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers,

  // JWT strategy is required when using credentials provider alongside OAuth
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // Registration is invite-only: Instagram sign-in only works for an
    // Instagram account already linked to a travel-ink user
    async signIn({ account }) {
      if (account?.provider === "instagram") {
        const linked = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          include: { user: { select: { disabledAt: true } } },
        })
        return linked && !linked.user.disabledAt ? true : "/login?error=InviteRequired"
      }
      return true
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.isAdmin = isAdminEmail(token.email)
      }
      return session
    },
  },
}
