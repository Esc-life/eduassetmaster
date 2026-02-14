import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Singleton-like initialization for dynamic config
// We use the projectId as the App Name to support multiple configs
export function getFirebaseStore(config: any) {
    if (!config || !config.apiKey) throw new Error("Firebase Config Missing or Invalid");

    const appName = config.projectId || "DEFAULT";
    const apps = getApps();
    const existingApp = apps.find(app => app.name === appName);

    if (existingApp) {
        return getFirestore(existingApp);
    }

    const app = initializeApp(config, appName);
    return getFirestore(app);
}
