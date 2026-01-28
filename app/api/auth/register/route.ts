import { NextResponse } from "next/server";
import { getData, updateData, appendData, addSheet, initializeUserSheet } from "@/lib/google-sheets";

export async function POST(req: Request) {
    try {
        const { email, password, name, spreadsheetId } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json({ message: "필수 정보가 누락되었습니다." }, { status: 400 });
        }

        // 0. Verify Spreadsheet Access (if provided)
        if (spreadsheetId) {
            try {
                // Try to initialize (create tabs/headers)
                // This will throw if we don't have edit access
                await initializeUserSheet(spreadsheetId);
            } catch (initError: any) {
                console.error("Sheet Init Error:", initError);
                if (initError.message === 'PERMISSION_DENIED' || initError.code === 403) {
                    return NextResponse.json({
                        message: "스프레드시트 접근 권한이 없습니다.\n서비스 계정을 '편집자'로 초대했는지 확인해주세요."
                    }, { status: 403 });
                }
                // Other errors (e.g. invalid ID)
                return NextResponse.json({
                    message: "스프레드시트 ID가 올바르지 않거나 접근할 수 없습니다."
                }, { status: 400 });
            }
        }

        // 1. Check if Users sheet exists (Master Sheet)
        // ... (Existing logic)
        let rows = await getData('Users!A:E');

        if (rows === null) {
            await addSheet('Users');
            await updateData('Users!A1', [['ID', 'Name', 'Email', 'Password', 'SpreadsheetID', 'CreatedAt']]);
            rows = [];
        }

        // 2. Check duplicate
        if (rows && rows.some((r: any[]) => r[2] === email)) {
            return NextResponse.json({ message: "이미 등록된 이메일입니다." }, { status: 409 });
        }

        // 3. Create User
        const newUser = [
            crypto.randomUUID(),
            name,
            email,
            password,
            spreadsheetId || '',
            new Date().toISOString()
        ];

        // 4. Save
        let targetRange = 'Users!A1';
        // If empty (just header), append works fine.
        await appendData(targetRange, [newUser]);

        return NextResponse.json({ message: "User created" }, { status: 201 });
    } catch (error: any) {
        console.error('Register Error:', error);
        return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
