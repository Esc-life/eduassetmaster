export type DeviceStatus = 'Available' | 'In Use' | 'Maintenance' | 'Lost' | 'Broken';

export interface Device {
    id: string;          // Columns: ID
    category: string;    // Columns: Category
    model: string;       // Columns: Model
    ip: string;          // Columns: IP
    status: DeviceStatus;// Columns: Status
    purchaseDate: string;// Columns: PurchaseDate (YYYY-MM-DD)
    groupId: string;     // Columns: GroupID (LocationID or CartID)
    name?: string;       // Managed internally or aliases
}

export interface Location {
    id: string;          // Columns: LocationID
    name: string;        // Columns: Name
    mapImageUrl?: string;// Columns: MapImageURL
    pinX: number;        // Columns: PinX (%)
    pinY: number;        // Columns: PinY (%)
    width?: number;      // Width in % (for Zones)
    height?: number;     // Height in % (for Zones)
    type: 'Classroom' | 'Cart' | 'Office'; // Implicit type for filtering
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
