import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getData } from "@/lib/google-sheets";
import { cookies } from "next/headers";
import { verifyUser } from "@/app/firebase-actions";

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

                // 0. Check Cookie for Firebase Login
                try {
                    const store = await Promise.resolve(cookies());
                    const cookie = store.get('edu-asset-config');
                    if (cookie?.value) {
                        const config = JSON.parse(decodeURIComponent(cookie.value));
                        if (config.dbType === 'firebase' && config.firebase) {
                            const user = await verifyUser(config.firebase, { email: credentials.email, password: credentials.password });
                            if (user) {
                                return {
                                    id: user.id || user.email,
                                    name: user.name,
                                    email: user.email,
                                    role: user.role,
                                    spreadsheetId: 'FIREBASE_MODE' // Placeholder
                                };
                            }
                            // If login fails in Firebase, fall through to Sheet/Hardcoded logic
                        }
                    }
                } catch (e) { }

                try {
                    // Fetch users from Sheet (Master Sheet)
                    // Expected: [ID, Name, Email, Password, SpreadsheetID, CreatedAt]
                    const rows = await getData('Users!A:E');
                    console.log(`[Auth] Fetched User Rows: ${rows ? rows.length : 'null'}`);

                    if (!rows) {
                        // Fallback Admin: Use environment variables instead of hardcoded credentials
                        const adminEmail = process.env.ADMIN_EMAIL || 'admin@test.com';
                        const adminPass = process.env.ADMIN_PASSWORD;
                        if (adminPass && credentials.email === adminEmail && credentials.password === adminPass) {
                            return {
                                id: 'admin',
                                name: 'Admin User',
                                email: adminEmail,
                                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
                            } as any;
                        }
                        return null;
                    }

                    // Find user (Column Index 2 is Email)
                    const userRow = rows.find((r: any[]) => r[2] === credentials.email);

                    if (userRow) {
                        console.log(`[Auth] ✅ User found: ${userRow[2]} | SheetID: ${userRow[4]}`);

                        // Check password
                        // Check password (Trim check)
                        const storedPass = String(userRow[3] || '').trim();
                        const inputPass = String(credentials.password || '').trim();

                        // Also check for raw match just in case
                        if (storedPass === inputPass || userRow[3] === credentials.password) {
                            return {
                                id: userRow[0],
                                name: userRow[1],
                                email: userRow[2],
                                spreadsheetId: userRow[4] // Important: Index 4
                            } as any;
                        } else {
                            console.log(`[Auth] ❌ Password mismatch for ${userRow[2]} (InputLen: ${inputPass.length}, StoredLen: ${storedPass.length})`);
                        }
                    } else {
                        console.log(`[Auth] ❌ User not found in sheet: ${credentials.email}`);
                    }

                    // Fallback/Legacy Admin support via env variables
                    const adminEmail = process.env.ADMIN_EMAIL || 'admin@test.com';
                    const adminPass = process.env.ADMIN_PASSWORD;
                    if (adminPass && credentials.email === adminEmail && credentials.password === adminPass) {
                        console.log('[Auth] Using Fallback Admin (from env)');
                        return {
                            id: 'admin',
                            name: 'Admin User',
                            email: adminEmail,
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
