'use server';

import { collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, addDoc, deleteDoc, writeBatch } from "firebase/firestore/lite";
import { getFirebaseStore } from "@/lib/firebase";

// --- Authentication ---
export async function registerUser(config: any, userData: { email: string, password: string, name: string }) {
    const db = getFirebaseStore(config);
    try {
        const docRef = doc(db, "Users", userData.email);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return { success: false, error: '이미 등록된 이메일입니다.' };
        }

        await setDoc(docRef, {
            email: userData.email,
            password: userData.password, // Plain text for demo
            name: userData.name,
            role: 'admin',
            createdAt: new Date().toISOString()
        });
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
            if (u.password === creds.password) {
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

        const devices = devSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const instances = instSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const zones = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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
        await updateDoc(doc(db, "Locations", zoneId), { name: newName });

        const instQ = query(collection(db, "DeviceInstances"), where("locationId", "==", zoneId));
        const instSnap = await getDocs(instQ);

        const updates = instSnap.docs.map(d => updateDoc(doc(db, "DeviceInstances", d.id), { locationName: newName }));
        await Promise.all(updates);

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
            const zone = zones.find(z => z.name === dist.locationName);
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
