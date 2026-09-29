import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MAX_INTENTOS_LOGIN = 5;
const BLOQUEO_LOGIN_MINUTOS = 30;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Render (a diferencia de Vercel) no se detecta automáticamente, así que
  // sin esto Auth.js rechaza cada request en producción con "UntrustedHost".
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user || !user.active) return null;

        // Mismo mensaje genérico (Auth.js siempre devuelve el mismo error
        // de "credenciales inválidas" cuando authorize da null) para no
        // revelar si el usuario está bloqueado o si directamente no existe.
        if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) {
          const intentos = user.failedLoginAttempts + 1;
          if (intentos >= MAX_INTENTOS_LOGIN) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                loginLockedUntil: new Date(Date.now() + BLOQUEO_LOGIN_MINUTOS * 60 * 1000),
              },
            });
          } else {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginAttempts: intentos },
            });
          }
          return null;
        }

        if (user.failedLoginAttempts !== 0 || user.loginLockedUntil !== null) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, loginLockedUntil: null },
          });
        }

        return { id: user.id, name: user.username, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as "ADMIN" | "USER";
      }
      return session;
    },
  },
});
