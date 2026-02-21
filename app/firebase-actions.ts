'use server';

import { collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, addDoc, deleteDoc, writeBatch } from "firebase/firestore/lite";
import { getFirebaseStore } from "@/lib/firebase";
import { createHash } from 'crypto';

// Simple SHA-256 hash helper (no external deps needed)
function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

// --- Authentication ---
export async function registerUser(config: any, userData: { email: string, password: string, name: string }, systemConfig?: { visionApiKey: string }) {
    const db = getFirebaseStore(config);
    try {
        const docRef = doc(db, "Users", userData.email);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return { success: false, error: '이미 등록된 이메일입니다.' };
        }

        await setDoc(docRef, {
            email: userData.email,
            password: hashPassword(userData.password),
            name: userData.name,
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        // Save System Config immediately
        if (systemConfig) {
            await saveSystemConfig(config, {
                'GOOGLE_VISION_KEY': systemConfig.visionApiKey,
                'ManagerName': userData.name
            });
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function verifyUser(config: any, creds: { email: string, password: string }) {
    const db = getFirebaseStore(config);
    try {
        const docRef = doc(db, "Users", creds.email);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const u = snap.data();
            // Support hashed password (new) and plaintext fallback (legacy)
            const hashedInput = hashPassword(creds.password);
            if (u.password === hashedInput || u.password === creds.password) {
                return { id: u.email, name: u.name, email: u.email, role: u.role };
            }
        }
        return null;
    } catch (e) {
        console.error("verifyUser Error", e);
        return null;
    }
}


// --- System Config ---
export async function fetchSystemConfig(config: any) {
    const db = getFirebaseStore(config);
    try {
        const snapshot = await getDocs(collection(db, "SystemConfig"));
        const result: any = {};
        snapshot.forEach(d => {
            result[d.id] = d.data().value;
        });
        return result;
    } catch (e) {
        console.error("Firebase Config Error:", e);
        return {};
    }
}

export async function saveSystemConfig(config: any, data: any) {
    const db = getFirebaseStore(config);
    try {
        const batchPromises = Object.entries(data).map(([key, value]) =>
            setDoc(doc(db, "SystemConfig", key), { value })
        );
        await Promise.all(batchPromises);
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Asset Data ---
export async function fetchAssetData(config: any) {
    const db = getFirebaseStore(config);
    try {
        const [devSnap, instSnap, locSnap] = await Promise.all([
            getDocs(collection(db, "Devices")),
            getDocs(collection(db, "DeviceInstances")),
            getDocs(collection(db, "Locations"))
        ]);

        const instances = instSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const zones = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const devices = devSnap.docs.map(d => {
            const data = d.data();
            const id = d.id;
            const myInsts = instances.filter((i: any) => i.deviceId === id);
            let installLocation = data.installLocation || '';

            if (myInsts.length > 0) {
                installLocation = myInsts.map((i: any) => {
                    const qty = Number(i.quantity || 1);
                    return qty > 0 ? `${i.locationName}(${qty})` : i.locationName;
                }).join(', ');
            }

            return { id, ...data, installLocation };
        });

        return {
            ok: true,
            devices,
            instances,
            zones,
            pins: []
        };
    } catch (e) {
        console.error("Firebase Fetch Error:", e);
        return { ok: false, error: String(e) };
    }
}

// --- Device Management ---
export async function updateDevice(config: any, deviceId: string, data: any) {
    const db = getFirebaseStore(config);
    try {
        await updateDoc(doc(db, "Devices", deviceId), data);

        // Sync DeviceInstance when installLocation changes (same as Google Sheets behavior)
        if (data.installLocation !== undefined) {
            try {
                // 1. Remove old instances for this device
                const instQ = query(collection(db, "DeviceInstances"), where("deviceId", "==", deviceId));
                const instSnap = await getDocs(instQ);
                const deletePromises = instSnap.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);

                // 2. Create new instance if location is set
                if (data.installLocation && data.installLocation.trim() !== '') {
                    // Find matching zone by name
                    const locSnap = await getDocs(collection(db, "Locations"));
                    let locationId = 'TEXT_ONLY';
                    locSnap.docs.forEach(d => {
                        const locData = d.data();
                        if ((locData.name || '').trim() === data.installLocation.trim()) {
                            locationId = d.id;
                        }
                    });

                    // Get device quantity
                    const devDoc = await getDoc(doc(db, "Devices", deviceId));
                    const qty = devDoc.exists() ? Number(devDoc.data().quantity || 1) : 1;

                    await addDoc(collection(db, "DeviceInstances"), {
                        deviceId,
                        locationId,
                        locationName: data.installLocation,
                        quantity: qty,
                        notes: 'Moved via Scan/Edit'
                    });
                }
            } catch (syncErr) {
                console.warn('Firebase DeviceInstance sync error:', syncErr);
            }
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function createDeviceInstance(config: any, data: any) {
    const db = getFirebaseStore(config);
    try {
        const ref = await addDoc(collection(db, "DeviceInstances"), data);
        return { success: true, id: ref.id };
    } catch (e) {
    }
}

export async function updateDeviceInstance(config: any, instanceId: string, updates: any) {
    const db = getFirebaseStore(config);
    try {
        await updateDoc(doc(db, "DeviceInstances", instanceId), updates);
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function deleteDeviceInstance(config: any, instanceId: string) {
    const db = getFirebaseStore(config);
    try {
        await deleteDoc(doc(db, "DeviceInstances", instanceId));
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function updateZoneName(config: any, zoneId: string, oldName: string, newName: string) {
    const db = getFirebaseStore(config);
    try {
        // 1. Update Locations collection
        await updateDoc(doc(db, "Locations", zoneId), { name: newName });

        // 2. Update DeviceInstances locationName
        const instQ = query(collection(db, "DeviceInstances"), where("locationId", "==", zoneId));
        const instSnap = await getDocs(instQ);
        const updates = instSnap.docs.map(d => updateDoc(doc(db, "DeviceInstances", d.id), { locationName: newName }));
        await Promise.all(updates);

        // 3. Update MapZones JSON in SystemConfig
        try {
            const zoneDoc = await getDoc(doc(db, "SystemConfig", "MapZones"));
            if (zoneDoc.exists() && zoneDoc.data().json) {
                const zones = JSON.parse(zoneDoc.data().json);
                const updatedZones = zones.map((z: any) => {
                    if (z.id === zoneId) return { ...z, name: newName };
                    return z;
                });
                await setDoc(doc(db, "SystemConfig", "MapZones"), {
                    json: JSON.stringify(updatedZones),
                    updatedAt: new Date().toISOString()
                });
            }
        } catch (e) { console.log('MapZones JSON update skipped', e); }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Distribution Management (For Modal) ---
export async function getDeviceInstances(config: any, deviceId: string) {
    const db = getFirebaseStore(config);
    try {
        const q = query(collection(db, "DeviceInstances"), where("deviceId", "==", deviceId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        return [];
    }
}

export async function updateDeviceWithDistribution(config: any, deviceId: string, updates: any, distributions: any[]) {
    const db = getFirebaseStore(config);
    try {
        const batch = writeBatch(db);

        // 1. Update Device
        if (Object.keys(updates).length > 0) {
            const devRef = doc(db, "Devices", deviceId);
            // Check if exists (might be create)
            // If create, deviceId might be generated ID.
            // But updateDevice expects existing ID.
            // If new device, handle create?
            // Assuming device exists or setDoc with merge
            await setDoc(devRef, updates, { merge: true });
        }

        // 2. Clear old instances
        const q = query(collection(db, "DeviceInstances"), where("deviceId", "==", deviceId));
        const snap = await getDocs(q);
        snap.forEach(d => batch.delete(d.ref));

        // 3. Create new instances
        const locSnap = await getDocs(collection(db, "Locations"));
        const zones = locSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        distributions.forEach(dist => {
            let zone = null;
            if (dist.locationId && dist.locationId !== 'TEXT_ONLY') {
                zone = zones.find(z => z.id === dist.locationId);
            }
            if (!zone) {
                zone = zones.find(z => (z.name || '').trim() === (dist.locationName || '').trim());
            }
            const newRef = doc(collection(db, "DeviceInstances"));
            batch.set(newRef, {
                deviceId,
                locationId: zone ? zone.id : 'TEXT_ONLY',
                locationName: dist.locationName,
                quantity: dist.quantity,
                notes: 'Distributed'
            });
        });

        await batch.commit();
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Map Config & Sync ---
export async function saveMapConfiguration(config: any, mapImage: string | null, zones: any[]) {
    const db = getFirebaseStore(config);
    try {
        const batch = writeBatch(db);

        // 1. Save Zones JSON (Frontend State)
        const zoneRef = doc(db, "SystemConfig", "MapZones");
        batch.set(zoneRef, {
            json: JSON.stringify(zones),
            updatedAt: new Date().toISOString()
        });

        // 2. Save Image (Chunking) if provided
        if (mapImage) {
            const CHUNK_SIZE = 800000; // 800KB
            const totalChunks = Math.ceil(mapImage.length / CHUNK_SIZE);

            const metaRef = doc(db, "SystemConfig", "MapImageMeta");
            batch.set(metaRef, { totalChunks, updatedAt: new Date().toISOString() });

            for (let i = 0; i < totalChunks; i++) {
                const chunk = mapImage.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                batch.set(doc(db, "SystemConfig", `MapImage_${i}`), { data: chunk });
            }
        }

        await batch.commit();
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function fetchMapConfiguration(config: any) {
    const db = getFirebaseStore(config);
    try {
        const zoneDoc = await getDoc(doc(db, "SystemConfig", "MapZones"));
        let zones: any[] = [];
        if (zoneDoc.exists() && zoneDoc.data().json) {
            try { zones = JSON.parse(zoneDoc.data().json); } catch (e) { }
        }

        // Merge with Locations collection (source of truth for names)
        try {
            const locSnap = await getDocs(collection(db, "Locations"));
            if (!locSnap.empty) {
                const nameMap = new Map<string, string>();
                locSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.name) nameMap.set(d.id, data.name);
                });
                if (nameMap.size > 0) {
                    zones = zones.map(z => ({
                        ...z,
                        name: nameMap.get(z.id) || z.name
                    }));
                }
            }
        } catch (e) { }

        const metaDoc = await getDoc(doc(db, "SystemConfig", "MapImageMeta"));
        let mapImage = null;

        if (metaDoc.exists()) {
            const total = metaDoc.data().totalChunks || 0;
            if (total > 0) {
                const promises = [];
                for (let i = 0; i < total; i++) {
                    promises.push(getDoc(doc(db, "SystemConfig", `MapImage_${i}`)));
                }
                const chunks = await Promise.all(promises);
                mapImage = chunks.map(c => c.exists() ? c.data().data : '').join('');
            }
        }

        return { mapImage, zones };
    } catch (e) {
        console.error("Firebase Map Config Error", e);
        return { mapImage: null, zones: [] };
    }
}

export async function syncZonesToDB(config: any, zones: any[]) {
    const db = getFirebaseStore(config);
    try {
        const batch = writeBatch(db);

        // Naive sync: Upsert based on ID
        for (const zone of zones) {
            const ref = doc(db, "Locations", zone.id);
            batch.set(ref, {
                id: zone.id,
                name: zone.name,
                type: zone.type || 'Classroom',
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }

        await batch.commit();
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function registerBulkDevicesToDB(config: any, devices: any[]) {
    const db = getFirebaseStore(config);
    try {
        const batch = writeBatch(db);
        let opCount = 0;

        // Firestore batch limit is 500. If more, need to split.
        // For simplicity, handle chunks of 400.
        const chunks = [];
        for (let i = 0; i < devices.length; i += 400) {
            chunks.push(devices.slice(i, i + 400));
        }

        for (const chunk of chunks) {
            const newBatch = writeBatch(db);
            chunk.forEach((d: any) => {
                const id = d.id || crypto.randomUUID(); // Ensure ID
                const ref = doc(db, "Devices", id);
                newBatch.set(ref, {
                    ...d,
                    id: id,
                    status: d.status || '사용 가능',
                    quantity: d.quantity ? Number(d.quantity) : 1,
                    unitPrice: d.unitPrice ? Number(d.unitPrice) : 0,
                    totalAmount: d.totalAmount ? Number(d.totalAmount) : 0,
                    createdAt: new Date().toISOString()
                }, { merge: true });
            });
            await newBatch.commit();
            opCount += chunk.length;
        }

        return { success: true, count: opCount };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function deleteAllDevicesFromDB(config: any) {
    const db = getFirebaseStore(config);
    try {
        // Delete Devices
        const devSnap = await getDocs(collection(db, "Devices"));
        const devChunks = [];
        for (let i = 0; i < devSnap.docs.length; i += 400) {
            devChunks.push(devSnap.docs.slice(i, i + 400));
        }

        for (const chunk of devChunks) {
            const batch = writeBatch(db);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }

        // Delete Instances
        const instSnap = await getDocs(collection(db, "DeviceInstances"));
        const instChunks = [];
        for (let i = 0; i < instSnap.docs.length; i += 400) {
            instChunks.push(instSnap.docs.slice(i, i + 400));
        }

        for (const chunk of instChunks) {
            const batch = writeBatch(db);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Software Management ---
export async function fetchSoftwareList(config: any) {
    const db = getFirebaseStore(config);
    try {
        const snap = await getDocs(collection(db, "Software"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}
export async function registerSoftware(config: any, item: any) {
    const db = getFirebaseStore(config);
    try {
        const id = item.id || crypto.randomUUID();
        const ref = doc(db, "Software", id);
        await setDoc(ref, { ...item, id, updatedAt: new Date().toISOString() }, { merge: true });
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
}
export async function deleteSoftwareFromDB(config: any, id: string) {
    const db = getFirebaseStore(config);
    try {
        await deleteDoc(doc(db, "Software", id));
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
}

// --- Account Management ---
export async function fetchAccountList(config: any) {
    const db = getFirebaseStore(config);
    try {
        const snap = await getDocs(collection(db, "Accounts"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}
export async function saveAccountToDB(config: any, item: any) {
    const db = getFirebaseStore(config);
    try {
        const id = item.id || crypto.randomUUID();
        const ref = doc(db, "Accounts", id);
        await setDoc(ref, { ...item, id, updatedAt: new Date().toISOString() }, { merge: true });
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
}
export async function deleteAccountFromDB(config: any, id: string) {
    const db = getFirebaseStore(config);
    try {
        await deleteDoc(doc(db, "Accounts", id));
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
}

// --- Loan Management ---
export async function fetchLoans(config: any) {
    const db = getFirebaseStore(config);
    try {
        const snap = await getDocs(collection(db, "Loans"));
        const today = new Date().toISOString().split('T')[0];
        return snap.docs.map(d => {
            const data = d.data();
            let status = data.status || 'Active';
            // Auto-detect overdue loans
            if (status === 'Active' && data.dueDate && data.dueDate < today) {
                status = 'Overdue';
            }
            return { id: d.id, ...data, status };
        });
    } catch (e) { return []; }
}

export async function createLoanToDB(config: any, deviceId: string, userId: string, userName: string, dueDate: string, notes: string) {
    const db = getFirebaseStore(config);
    try {
        const devRef = doc(db, "Devices", deviceId);
        const devSnap = await getDoc(devRef);
        if (!devSnap.exists()) return { success: false, error: "Device not found" };

        const device = devSnap.data();
        if (device.status === '고장/폐기' || device.status === '분실' || device.status === '대여중') {
            return { success: false, error: `기기가 대여 가능한 상태가 아닙니다. (현재 상태: ${device.status})` };
        }

        const loanRef = doc(collection(db, "Loans"));
        const loanData = {
            id: loanRef.id,
            deviceId,
            deviceName: device.name || '',
            userId,
            userName,
            loanDate: new Date().toISOString().split('T')[0],
            dueDate,
            returnDate: '',
            status: 'Active',
            notes
        };

        const batch = writeBatch(db);
        batch.set(loanRef, loanData);
        batch.update(devRef, { status: '대여중', userName: userName });

        await batch.commit();
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
}

export async function returnLoanInDB(config: any, loanId: string, returnCondition: string) {
    const db = getFirebaseStore(config);
    try {
        const loanRef = doc(db, "Loans", loanId);
        const loanSnap = await getDoc(loanRef);
        if (!loanSnap.exists()) return { success: false, error: "Loan record not found" };

        const loan = loanSnap.data();
        const devRef = doc(db, "Devices", loan.deviceId);

        const batch = writeBatch(db);
        batch.update(loanRef, {
            returnDate: new Date().toISOString().split('T')[0],
            status: 'Returned'
        });

        const newStatus = returnCondition === 'Broken' ? '수리/점검' : '사용 가능';
        batch.update(devRef, { status: newStatus, userName: '' });

        await batch.commit();
        return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
}

// --- Delete Single Device (with Instance cleanup) ---
export async function deleteDeviceFromDB(config: any, deviceId: string) {
    const db = getFirebaseStore(config);
    try {
        // 1. Delete related DeviceInstances
        const instQ = query(collection(db, "DeviceInstances"), where("deviceId", "==", deviceId));
        const instSnap = await getDocs(instQ);
        const deletions = instSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletions);

        // 2. Delete the device itself
        await deleteDoc(doc(db, "Devices", deviceId));
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Delete Bulk Devices (with Instance cleanup) ---
export async function deleteBulkDevicesFromDB(config: any, deviceIds: string[]) {
    const db = getFirebaseStore(config);
    try {
        for (const deviceId of deviceIds) {
            // Delete related instances
            const instQ = query(collection(db, "DeviceInstances"), where("deviceId", "==", deviceId));
            const instSnap = await getDocs(instQ);
            const deletions = instSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletions);
            // Delete device
            await deleteDoc(doc(db, "Devices", deviceId));
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Clear All Data (for import/restore, keeps User record) ---
export async function clearAllCollectionData(config: any) {
    const db = getFirebaseStore(config);
    try {
        const collectionsToDelete = ['Devices', 'DeviceInstances', 'Software', 'Accounts', 'Loans', 'Locations', 'SystemConfig'];
        for (const collName of collectionsToDelete) {
            const snap = await getDocs(collection(db, collName));
            const chunks = [];
            for (let i = 0; i < snap.docs.length; i += 400) {
                chunks.push(snap.docs.slice(i, i + 400));
            }
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Account Deletion (Full Wipe including User record) ---
export async function deleteEntireUserData(config: any, userEmail: string) {
    const db = getFirebaseStore(config);
    try {
        // Clear all collection data first
        await clearAllCollectionData(config);

        // Delete user record
        if (userEmail) {
            await deleteDoc(doc(db, "Users", userEmail));
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

// --- Bulk Data Import (for backup restore / handover) ---
export async function importBulkData(config: any, data: {
    devices: any[], deviceInstances: any[], software: any[], credentials: any[],
    loans: any[], locations: any[], systemConfig: Record<string, string>
}) {
    const db = getFirebaseStore(config);
    try {
        // Write Devices
        for (const device of (data.devices || [])) {
            const id = device.id || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const { id: _, ...deviceData } = device;
            await setDoc(doc(db, "Devices", id), deviceData);
        }

        // Write DeviceInstances
        for (const inst of (data.deviceInstances || [])) {
            const id = inst.id || `inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const { id: _, ...instData } = inst;
            await setDoc(doc(db, "DeviceInstances", id), instData);
        }

        // Write Software
        for (const sw of (data.software || [])) {
            await addDoc(collection(db, "Software"), sw);
        }

        // Write Credentials (Accounts)
        for (const cred of (data.credentials || [])) {
            await addDoc(collection(db, "Accounts"), cred);
        }

        // Write Loans
        for (const loan of (data.loans || [])) {
            const id = loan.id || `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const { id: _, ...loanData } = loan;
            await setDoc(doc(db, "Loans", id), loanData);
        }

        // Write Locations
        for (const loc of (data.locations || [])) {
            const id = loc.id || `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const { id: _, ...locData } = loc;
            await setDoc(doc(db, "Locations", id), locData);
        }

        // Write SystemConfig
        if (data.systemConfig) {
            for (const [key, value] of Object.entries(data.systemConfig)) {
                if (key && !key.startsWith('MapImage')) {
                    await setDoc(doc(db, "SystemConfig", key), { value });
                }
            }
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

