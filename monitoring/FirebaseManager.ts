import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

export interface MonitorConfig {
    priceLowerBound?: number;
    priceUpperBound?: number;
    poolAddress?: string;
}

export class FirebaseManager {
    private db: admin.firestore.Firestore | null = null;
    private configRef: admin.firestore.DocumentReference | null = null;

    constructor() {
        this.init();
    }

    private init() {
        try {
            // Look for serviceAccountKey.json in config folder relative to this file
            // Since we are running with ts-node in root, __dirname is where the file is.
            const serviceAccountPath = path.join(__dirname, 'config', 'serviceAccountKey.json');

            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

                if (admin.apps.length === 0) {
                    admin.initializeApp({
                        credential: admin.credential.cert(serviceAccount)
                    });
                }

                this.db = admin.firestore();
                // We assume a collection 'monitoring' and doc 'settings' for simplicity, or 'config/monitor_settings'
                this.configRef = this.db.collection('config').doc('monitor_settings');
                console.log("Firebase initialized successfully.");
            } else {
                console.warn("⚠️ Firebase serviceAccountKey.json not found in monitoring/config/. Firebase features will be disabled.");
            }
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            this.db = null;
        }
    }

    public async logAlert(alertData: any) {
        if (!this.db) return;

        try {
            await this.db.collection('alerts').add({
                ...alertData,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log("Alert logged to Firestore.");
        } catch (error) {
            console.error("Error logging alert to Firestore:", error);
        }
    }

    public listenToConfig(callback: (config: MonitorConfig) => void) {
        if (!this.db || !this.configRef) return;

        this.configRef.onSnapshot((doc) => {
            console.log(`[Firebase] Snapshot received. Exists: ${doc.exists}, ID: ${doc.id}`);
            if (doc.exists) {
                const data = doc.data() as MonitorConfig;
                console.log("Received config update from Firebase:", data);
                callback(data);
            } else {
                console.log("[Firebase] config/monitor_settings document does not exist yet.");
            }
        }, (error) => {
            console.error("Error listening to config updates:", error);
        });
    }
}
