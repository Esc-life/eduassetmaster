import { NextResponse } from "next/server";
import { getData, updateData, appendData, addSheet, initializeUserSheet } from "@/lib/google-sheets";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password, name, school, visionApiKey, serviceAccountJson } = body;
        const spreadsheetId = body.spreadsheetId?.trim();

        if (!email || !password || !name) {
            return NextResponse.json({ message: "필수 정보가 누락되었습니다." }, { status: 400 });
        }

        // 0. Verify Spreadsheet Access (if provided)
        if (spreadsheetId) {
            console.log(`[Register] Initializing spreadsheet: ${spreadsheetId}`);

            // Extract credentials if user provided their own JSON
            let userCredentials = undefined;
            if (serviceAccountJson) {
                try {
                    const parsed = JSON.parse(serviceAccountJson);
                    userCredentials = {
                        client_email: parsed.client_email,
                        private_key: parsed.private_key
                    };
                } catch (e) {
                    console.error("[Register] Invalid user service account JSON");
                }
            }

            try {
                // Try to initialize (create tabs/headers) using user's own credentials if available
                const initResult = await initializeUserSheet(spreadsheetId, userCredentials);
                if (!initResult) throw new Error('Initialization failed');

                const configRows: string[][] = [];
                if (visionApiKey) configRows.push(['GOOGLE_VISION_KEY', visionApiKey]);
                if (name) configRows.push(['ManagerName', name]);
                if (school) configRows.push(['SchoolName', school]);
                if (serviceAccountJson) configRows.push(['SERVICE_ACCOUNT_JSON', serviceAccountJson]);

                if (configRows.length > 0) {
                    console.log(`[Register] Writing config to SystemConfig!A2 on ${spreadsheetId}`);
                    // Use user's own credentials to write the config
                    const updateRes = await updateData('SystemConfig!A2', configRows, spreadsheetId, userCredentials);
                    console.log(`[Register] Update result:`, !!updateRes);
                }
            } catch (initError: any) {
                console.error("[Register] Sheet Init Error detail:", initError);
                if (initError.message === 'PERMISSION_DENIED' || initError.code === 403) {
                    return NextResponse.json({
                        message: "스프레드시트 접근 권한이 없습니다. 업로드한 서비스 계정 이메일이 시트에 '편집자'로 초대되어 있는지 확인해주세요."
                    }, { status: 403 });
                }
                return NextResponse.json({
                    message: `스프레드시트 초기화 실패: ${initError.message || '알 수 없는 오류'}`
                }, { status: 400 });
            }
        }

        // 1. Check if Users sheet exists (Master Sheet) in Admin Spreadsheet
        let rows = await getData('Users!A:E');

        if (rows === null) {
            console.log("[Register] Creating master Users sheet");
            await addSheet('Users');
            await updateData('Users!A1', [['ID', 'Name', 'School', 'Email', 'Password', 'SpreadsheetID', 'CreatedAt']]);
            rows = [];
        }

        // 2. Check duplicate
        if (rows && rows.some((r: any[]) => r[3] === email)) {
            return NextResponse.json({ message: "이미 등록된 이메일입니다." }, { status: 409 });
        }

        // 3. Create User record for Admin
        const newUser = [
            crypto.randomUUID(),
            name,
            school || '',
            email,
            password,
            spreadsheetId || '',
            new Date().toISOString()
        ];

        // 4. Save to Admin Master Spreadsheet
        console.log(`[Register] Saving user ${email} to master sheet`);
        await appendData('Users!A1', [newUser]);

        return NextResponse.json({ message: "User created" }, { status: 201 });
    } catch (error: any) {
        console.error('[Register] General Error:', error);
        return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
    }
}
