export type DeviceStatus = 'Available' | 'In Use' | 'Maintenance' | 'Lost' | 'Broken';

export interface Device {
    id: string;          // Columns: ID
    category: string;    // Columns: Category (물품분류명)
    model: string;       // Columns: Model (물품목록번호)
    ip: string;          // Columns: IP
    status: DeviceStatus | string;// Columns: Status
    purchaseDate: string;// Columns: PurchaseDate (YYYY-MM-DD)
    groupId: string;     // Columns: GroupID (Location/운용부서)
    name?: string;       // Columns: Name (품명/규격)
    acquisitionDivision?: string; // 취득구분
    quantity?: number | string;   // 수량
    unitPrice?: number | string;  // 단가
    totalAmount?: number | string;// 취득금액
    usefulLife?: string;          // 내용연수(변경)
    installationLocation?: string;// 설치장소 (e.g. 교무실, 전산실)
    // IT Specific Fields
    osVersion?: string;
    password?: string;
    deviceUser?: string;
}

export interface Location {
    id: string;          // Columns: LocationID
    name: string;        // Columns: LocationName
    type: 'Classroom' | 'Office' | 'Lab' | 'Other' | 'Corridor'; // Columns: Type
    description?: string; // Columns: Description
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Software {
    name: string;        // Columns: Name
    licenseKey: string;  // Columns: LicenseKey
    quantity: number;    // Columns: Quantity
    expiryDate: string;  // Columns: ExpiryDate
}

export interface Credential {
    serviceName: string; // Columns: ServiceName
    adminId: string;     // Columns: AdminID
    contact: string;     // Columns: Contact
    note: string;        // Columns: Note
}

export interface AdminLog {
    logId: string;       // Columns: LogID
    user: string;        // Columns: User
    timestamp: string;   // Columns: Timestamp
    action: string;      // Inferred: Created, Updated, Deleted
    targetId: string;    // Target Device/SW ID
    beforeData: string;  // Columns: BeforeData (JSON)
    afterData: string;   // Columns: AfterData (JSON)
    undoId?: string;     // Columns: UndoID
}
