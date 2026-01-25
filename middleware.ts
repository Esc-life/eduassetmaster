export { default } from "next-auth/middleware";

export const config = {
    matcher: [
        // Protect all routes except login and static assets
        '/((?!login|api|_next/static|_next/image|favicon.ico).*)',
    ],
};
