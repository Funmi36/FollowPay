import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        // Demo user check:
        // Accept demo@followpay.com / followpay123
        // Or any valid email format with at least 6 character password
        if (
          (email === "demo@followpay.com" && password === "followpay123") ||
          (email.includes("@") && password.length >= 6)
        ) {
          const rawName = email.split("@")[0].replace(/[._-]/g, " ");
          const name = rawName
            .split(" ")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

          return {
            id: email,
            name: name || "Freelancer",
            email: email,
          };
        }

        return null;
      },
    }),
  ],
});

