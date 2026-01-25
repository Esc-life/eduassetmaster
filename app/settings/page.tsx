'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Database } from 'lucide-react';

export default function SettingsPage() {
    const [sheetId, setSheetId] = useState('');

    // In a real multi-user app, this would come from user profile / DB
    useEffect(() => {
        // Load partial ID for demo
        setSheetId('1xA...');
    }, []);

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">환경 설정</h1>
                <p className="text-gray-500 mt-1">시스템 데이터 연동 및 개인화 설정을 관리합니다.</p>
            </div>

            {/* Data Source Configuration */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600">
                        <Database className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">데이터 저장소 (Google Sheets)</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            현재 서비스 계정과 연결된 중앙 스프레드시트를 사용 중입니다.<br />
                            추후 <strong>개인 구글 드라이브 연동</strong> 기능이 활성화되면 각자의 시트에 저장할 수 있습니다.
                        </p>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                현재 연결된 Spreadsheet ID
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={sheetId}
                                    disabled
                                    className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 font-mono text-sm"
                                />
                                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50" disabled>
                                    변경 (준비중)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reset Data */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
                        <RefreshCw className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">데이터 초기화</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            문제가 발생했을 때 시트의 데이터를 초기화할 수 있는 기능입니다.
                        </p>
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={() => alert('준비 중입니다. 구글 시트에서 직접 삭제해주세요.')}
                                className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                            >
                                Software 시트 초기화
                            </button>
                            <button
                                onClick={() => alert('준비 중입니다. 구글 시트에서 직접 삭제해주세요.')}
                                className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                            >
                                Accounts 시트 초기화
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
