// Central NextAuth (auth.js) configuration for the guest-facing site. Defines
// the three ways a customer can sign in — Google OAuth, email/password, and
// phone number + SMS one-time-code — plus how session data gets shaped.
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter' // saves users/sessions/accounts to the database automatically
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs' // library for safely hashing/comparing passwords

export const authOptions: NextAuthOptions = {
  // PrismaAdapter wires NextAuth up to store User/Account/Session rows via Prisma,
  // so OAuth sign-ins (Google) automatically create/link User records in our DB.
  adapter: PrismaAdapter(prisma),
  providers: [
    // "Sign in with Google" — clientId/secret come from environment variables
    // (the `!` tells TypeScript we're certain they're set, since these must
    // exist for Google login to work at all).
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Lets a Google sign-in link to an existing account that has the same
      // email but was created via email/password, instead of erroring out.
      allowDangerousEmailAccountLinking: true,
    }),
    // Classic email + password login.
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // `authorize` runs on every sign-in attempt with this provider. Returning
      // null means "invalid credentials"; returning a user object means success.
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user?.password) return null // no account, or account has no password set (e.g. Google-only user)
        // bcrypt.compare hashes the submitted password the same way and checks
        // it matches the stored hash — the plain password is never stored or compared directly.
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null
        return { id: user.id, email: user.email, name: user.name, role: user.role } as any
      },
    }),
    // Phone number sign-in via a one-time SMS code (OTP), for guests who
    // prefer not to use email/Google.
    CredentialsProvider({
      id: 'phone-otp',
      name: 'Phone OTP',
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
        otp: { label: 'OTP Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) return null
        // Look up a matching, unused, still-valid OTP code that was previously
        // sent to this phone number.
        const record = await prisma.otpCode.findFirst({
          where: {
            phone: credentials.phone,
            code: credentials.otp,
            used: false,
            expiresAt: { gt: new Date() }, // must not have expired yet
          },
        })
        if (!record) return null
        // Mark the code as used so it can't be replayed for a second login.
        await prisma.otpCode.update({
          where: { id: record.id },
          data: { used: true },
        })
        // First-time phone sign-in: no User exists yet for this phone number,
        // so create one automatically (with a small welcome bonus of loyalty points).
        let user = await prisma.user.findUnique({ where: { phone: credentials.phone } })
        if (!user) {
          user = await prisma.user.create({
            data: {
              phone: credentials.phone,
              phoneVerified: true,
              loyaltyPoints: 100,
            },
          })
        }
        return { id: user.id, email: user.email, name: user.name, role: user.role } as any
      },
    }),
  ],
  // 'jwt' strategy: session data is encoded into a signed JWT cookie rather than
  // stored server-side in a Session table, so no DB lookup is needed on every request.
  session: { strategy: 'jwt' },
  pages: { signIn: '/' }, // custom sign-in page is the homepage, not NextAuth's default page
  callbacks: {
    // Runs whenever a JWT is created or updated. `user` is only present right
    // after a successful sign-in — this is where we copy fields from the
    // freshly-authenticated user into the token so they persist across requests.
    async jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role ?? 'GUEST' // default every new session to the GUEST role
        token.name = user.name ?? token.name
        token.email = user.email ?? token.email
        // Profile picture: prefer our own stored image, fall back to Google's
        // profile photo (from `profile`), then whatever was already on the token.
        token.picture = (user as any).image ?? (profile as any)?.picture ?? token.picture
      }
      return token
    },
    // Runs whenever the session is read (e.g. via useSession()/getServerSession).
    // Copies the extra fields we stored on the JWT (id, role, picture) onto the
    // session object so client/server code can access session.user.id/.role.
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
        session.user.image = (token.picture as string) ?? session.user.image ?? null;
      }
      return session
    },
  },
}
