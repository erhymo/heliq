import fs from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadEnv() {
  const text = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    process.env[key] = value;
  }
}
function addDays(iso, days) { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
loadEnv();
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") }) });
const db = getFirestore();
async function all(name) { const snap = await db.collection(name).get(); return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })); }
const [personnel, bases, assignments] = await Promise.all([all("personnel"), all("bases"), all("assignments")]);
const people = new Map(personnel.map((p) => [p.id, p]));
const days = [];
for (let d = "2026-01-01"; d <= "2026-12-31"; d = addDays(d, 1)) days.push(d);
const assignmentsByDateBase = new Map();
for (const a of assignments.filter((item) => String(item.date || "").startsWith("2026-") && item.baseId)) {
  const key = `${a.date}_${a.baseId}`;
  assignmentsByDateBase.set(key, [...(assignmentsByDateBase.get(key) || []), a]);
}
let totalGapDays = 0;
for (const base of bases.sort((a, b) => String(a.code).localeCompare(String(b.code)))) {
  let pilotGap = 0, tsGap = 0, covered = 0;
  for (const date of days) {
    const items = assignmentsByDateBase.get(`${date}_${base.id}`) || [];
    const pilots = items.map((a) => people.get(a.personId)).filter((p) => p?.role === "pilot").length;
    const ts = items.map((a) => people.get(a.personId)).filter((p) => p?.role === "ts").length;
    if (pilots < Number(base.minPilots || 0)) pilotGap += 1;
    if (ts < Number(base.minTs || 0)) tsGap += 1;
    if (pilots >= Number(base.minPilots || 0) && ts >= Number(base.minTs || 0)) covered += 1;
  }
  totalGapDays += pilotGap + tsGap;
  console.log(`${base.code}=covered_days:${covered}/365,pilot_gap_days:${pilotGap},ts_gap_days:${tsGap}`);
}
console.log("coverage_gap_role_days=" + totalGapDays);
