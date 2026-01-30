// Quick script to create Firebase config document
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, 'config', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createMonitorConfig() {
    try {
        const configRef = db.collection('config').doc('monitor_settings');

        await configRef.set({
            priceLowerBound: 180,
            priceUpperBound: 200,
            poolAddress: "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ"
        }, { merge: true });

        console.log("✅ Successfully created config/monitor_settings document!");
        console.log("   priceLowerBound: 180");
        console.log("   priceUpperBound: 200");
        console.log("   poolAddress: HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error creating document:", error);
        process.exit(1);
    }
}

createMonitorConfig();
