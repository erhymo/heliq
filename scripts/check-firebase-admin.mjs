import fs from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const envText = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
for (const line of envText.split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) continue;
  const index = line.indexOf("=");
  const key = line.slice(0, index).trim();
  let value = line.slice(index + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
  process.env[key] = value;
}

const required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
for (const key of required) {
  if (!process.env[key]) {
    console.log(key + "=missing");
    process.exit(1);
  }
  console.log(key + "=present");
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const snap = await db.collection("bases").limit(1).get();
console.log("firestore_read=ok");
console.log("bases_sample_count=" + snap.size);
