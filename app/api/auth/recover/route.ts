import { NextResponse } from "next/server";
import { getData } from "@/lib/google-sheets";

export async function POST(req: Request) {
    try {
        const { type, name, school, email, sheetId } = await req.json();

        // Fetch users from master sheet
        const rows = await getData('Users!A:G');
        if (!rows || rows.length <= 1) {
            return NextResponse.json({ message: "등록된 사용자가 없습니다." }, { status: 404 });
        }

        if (type === 'id') {
            // Find by Name and School
            const user = rows.find((r: any[]) =>
                r[1]?.toLowerCase() === name?.toLowerCase() &&
                r[2]?.toLowerCase() === school?.toLowerCase()
            );

            if (user) {
                return NextResponse.json({ success: true, email: user[3] });
            } else {
                return NextResponse.json({ message: "일치하는 정보를 찾을 수 없습니다." }, { status: 404 });
            }
        }

        if (type === 'pw') {
            // Find by Email and Spreadsheet ID
            const user = rows.find((r: any[]) =>
                r[3]?.toLowerCase() === email?.toLowerCase() &&
                r[5]?.trim() === sheetId?.trim()
            );

            if (user) {
                return NextResponse.json({ success: true, password: user[4] });
            } else {
                return NextResponse.json({ message: "일치하는 정보를 찾을 수 없습니다." }, { status: 404 });
            }
        }

        return NextResponse.json({ message: "Invalid request type" }, { status: 400 });
    } catch (error) {
        console.error('[Recover] Error:', error);
        return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
