import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Simple hardcoded user for demo
// Phase 2: Fetch from Google Sheets "Users" tab
const USERS = [
    {
        id: "1",
        name: "Admin User",
        email: "admin@test.com",
        password: "1234",
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
    },
    {
        id: "2",
        name: "Teacher B",
        email: "teacher@test.com",
        password: "1234",
        spreadsheetId: "" // User with no sheet yet
    }
];

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = USERS.find(u => u.email === credentials.email);

                if (user && user.password === credentials.password) {
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        spreadsheetId: user.spreadsheetId
                    } as any;
                }
                return null;
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.spreadsheetId = (user as any).spreadsheetId;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).spreadsheetId = token.spreadsheetId;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET || 'secret', // Fallback for dev
};
