import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '설정되지 않음'
    });
}
