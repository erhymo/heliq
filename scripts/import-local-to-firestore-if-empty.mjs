import fs from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadEnv() {
  const text = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    process.env[key] = value;
  }
}

loadEnv();
if (!getApps().length) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }) });
}

const db = getFirestore();
const localFile = "data/heliq.local.json";
if (!fs.existsSync(localFile)) throw new Error("local_data=missing");
const data = JSON.parse(fs.readFileSync(localFile, "utf8"));
const collections = ["personnel", "bases", "projects", "qualifications", "assignments", "publishedAssignments", "auditLogs"];

const existing = await Promise.all(collections.map(async (name) => [name, (await db.collection(name).limit(1).get()).size]));
const nonEmpty = existing.filter(([, size]) => size > 0).map(([name]) => name);
if (nonEmpty.length > 0) {
  console.log("firestore_import=skipped_non_empty");
  console.log("non_empty_collections=" + nonEmpty.join(","));
  process.exit(0);
}

let written = 0;
for (const name of collections) {
  const items = Array.isArray(data[name]) ? data[name] : [];
  for (const item of items) {
    if (!item?.id) continue;
    await db.collection(name).doc(item.id).set(item);
    written += 1;
  }
}
await db.collection("settings").doc("lists").set({ vehicles: data.vehicles || [], trailers: data.trailers || [] }, { merge: true });
console.log("firestore_import=ok");
console.log("documents_written=" + written);
console.log("bases=" + (data.bases || []).length);
console.log("personnel=" + (data.personnel || []).length);
