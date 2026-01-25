import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getData } from "@/lib/google-sheets";

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

                try {
                    // Fetch users from Sheet (Master Sheet)
                    // Expected: [ID, Name, Email, Password, SpreadsheetID, CreatedAt]
                    const rows = await getData('Users!A:E');

                    if (!rows) {
                        // Fallback for initial Admin
                        if (credentials.email === 'admin@test.com' && credentials.password === '1234') {
                            return {
                                id: 'admin',
                                name: 'Admin User',
                                email: 'admin@test.com',
                                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
                            } as any;
                        }
                        return null;
                    }

                    // Find user (Column Index 2 is Email)
                    const userRow = rows.find(r => r[2] === credentials.email);

                    if (userRow) {
                        console.log(`[Auth] ✅ User found: ${userRow[2]} | SheetID: ${userRow[4]}`);

                        // Check password
                        if (userRow[3] === credentials.password) {
                            return {
                                id: userRow[0],
                                name: userRow[1],
                                email: userRow[2],
                                spreadsheetId: userRow[4] // Important: Index 4
                            } as any;
                        } else {
                            console.log(`[Auth] ❌ Password mismatch for ${userRow[2]}`);
                        }
                    } else {
                        console.log(`[Auth] ❌ User not found in sheet: ${credentials.email}`);
                    }

                    // Fallback/Legacy Admin support
                    if (credentials.email === 'admin@test.com' && credentials.password === '1234') {
                        console.log('[Auth] Using Fallback Admin');
                        return {
                            id: 'admin',
                            name: 'Admin User',
                            email: 'admin@test.com',
                            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
                        } as any;
                    }

                } catch (e) {
                    console.error('Auth Error:', e);
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
    // Ensure we use the strong secret from env
    secret: process.env.NEXTAUTH_SECRET,
};
