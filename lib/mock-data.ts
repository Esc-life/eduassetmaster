import { Device, Software, Credential } from '@/types';

// 임시 Mock 데이터 - 구글 시트 연결 전 UI 개발용
export const MOCK_DEVICES: Device[] = [
    {
        id: 'D-2024-001',
        category: 'Laptop',
        model: 'Galaxy Book 3',
        ip: '192.168.1.101',
        status: 'Available',
        purchaseDate: '2023-03-01',
        groupId: 'ROOM-301',
        name: '3-1반 선생님용'
    },
    {
        id: 'D-2024-002',
        category: 'Tablet',
        model: 'iPad 9th Gen',
        ip: '192.168.1.201',
        status: 'In Use',
        purchaseDate: '2023-03-15',
        groupId: 'CART-A',
        name: '학생용 태블릿 #1'
    },
    {
        id: 'D-2024-003',
        category: 'Tablet',
        model: 'iPad 9th Gen',
        ip: '192.168.1.202',
        status: 'Maintenance',
        purchaseDate: '2023-03-15',
        groupId: 'CART-A',
        name: '학생용 태블릿 #2 (액정 파손)'
    },
    {
        id: 'D-2024-004',
        category: 'PC',
        model: 'Dell OptiPlex',
        ip: '192.168.0.50',
        status: 'Available',
        purchaseDate: '2022-01-10',
        groupId: 'ADMIN-OFFICE',
        name: '행정실 공용 PC'
    },
];

export const MOCK_SOFTWARE: Software[] = [
    {
        name: 'Microsoft Office 365',
        licenseKey: 'XXXX-XXXX-XXXX-XXXX',
        quantity: 150,
        expiryDate: '2025-12-31'
    },
    {
        name: 'Adobe Creative Cloud',
        licenseKey: 'ADBE-1234-5678',
        quantity: 5,
        expiryDate: '2024-02-15'
    },
    {
        name: '한글 2022',
        licenseKey: 'HWP-9999-8888',
        quantity: 60,
        expiryDate: '2024-03-01'
    },
    {
        name: 'V3 Internet Security',
        licenseKey: 'AHN-1111-2222',
        quantity: 200,
        expiryDate: '2026-05-20'
    }
];

export const MOCK_CREDENTIALS: Credential[] = [
    {
        serviceName: 'Google Workspace Admin',
        adminId: 'admin@edu.school.kr',
        contact: '010-1234-5678 (정보부장)',
        note: '2단계 인증 설정됨. 로그인 시 승인 필요.'
    },
    {
        serviceName: 'MS Volume Licensing',
        adminId: 'ms_admin@edu.school.kr',
        contact: '02-123-4567 (행정실)',
        note: '계약 번호: 12345678'
    },
    {
        serviceName: 'NEIS (나이스)',
        adminId: 'T12345678',
        contact: '교육청 전산실',
        note: '인증서 갱신 매년 12월 필요'
    }
];
