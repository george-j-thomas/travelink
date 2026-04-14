import { type AuthOptions } from "next-auth"
import InstagramProvider from "next-auth/providers/instagram"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/db"

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    InstagramProvider({
      clientId: process.env.INSTAGRAM_CLIENT_ID!,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET!,
    }),

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

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],

  // JWT strategy is required when using credentials provider alongside OAuth
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // Instagram API doesn't return an email — allow sign-in without one
    async signIn({ account }) {
      if (account?.provider === "instagram") {
        return true
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
      }
      return session
    },
  },
}
