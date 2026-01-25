import { NextResponse } from "next/server";
import { getData, updateData, appendData, addSheet } from "@/lib/google-sheets";

export async function POST(req: Request) {
    try {
        const { email, password, name, spreadsheetId } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json({ message: "필수 정보가 누락되었습니다." }, { status: 400 });
        }

        // 1. Check if Users sheet exists (Master Sheet)
        let rows = await getData('Users!A:E');

        if (rows === null) {
            await addSheet('Users');
            await updateData('Users!A1', [['ID', 'Name', 'Email', 'Password', 'SpreadsheetID', 'CreatedAt']]);
            rows = [];
        }

        // 2. Check duplicate
        if (rows && rows.some(r => r[2] === email)) {
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
