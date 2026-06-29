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
async function all(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

const [personnel, bases, assignments, publishedAssignments] = await Promise.all([
  all("personnel"), all("bases"), all("assignments"), all("publishedAssignments"),
]);
const active = personnel.filter((p) => p.active && ["pilot", "ts"].includes(p.role));
const in2026 = assignments.filter((a) => String(a.date || "").startsWith("2026-"));
const pub2026 = publishedAssignments.filter((a) => String(a.date || "").startsWith("2026-"));
const byStatus = in2026.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {});
console.log("bases=" + bases.length);
console.log("active_pilots=" + active.filter((p) => p.role === "pilot").length);
console.log("active_ts=" + active.filter((p) => p.role === "ts").length);
console.log("draft_assignments_2026=" + in2026.length);
console.log("published_assignments_2026=" + pub2026.length);
console.log("draft_status_counts=" + JSON.stringify(byStatus));
for (const base of bases.sort((a, b) => String(a.code).localeCompare(String(b.code)))) {
  const pilots = active.filter((p) => p.role === "pilot" && p.homeBaseId === base.id).length;
  const ts = active.filter((p) => p.role === "ts" && p.homeBaseId === base.id).length;
  console.log(`base_${base.code}=minP:${base.minPilots},minTS:${base.minTs},homeP:${pilots},homeTS:${ts}`);
}
