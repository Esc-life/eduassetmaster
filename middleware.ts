
import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: "/login",
    },
});

export const config = {
    matcher: [
        // Protect all routes except login, register, recover, and static assets
        '/((?!login|register|recover|scan|api|_next/static|_next/image|favicon.ico).*)',
    ],
};
