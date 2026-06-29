import fs from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
for (const line of env.split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const key = line.slice(0, i).trim();
  let value = line.slice(i + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
  process.env[key] = value;
}
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") }) });
const db = getFirestore();
async function all(name) { const snap = await db.collection(name).get(); return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })); }
const [bases, people, quals] = await Promise.all([all("bases"), all("personnel"), all("qualifications")]);
const q = new Map(quals.map((item) => [item.id, item.name]));
for (const base of bases.sort((a, b) => String(a.code).localeCompare(String(b.code)))) {
  const req = base.requiredQualificationIds || [];
  const qualified = people.filter((p) => p.active && ["pilot", "ts"].includes(p.role) && req.every((id) => (p.qualificationIds || []).includes(id)));
  console.log(base.code + "=required:" + (req.map((id) => q.get(id) || id).join("+") || "none") + ",qualifiedPilots:" + qualified.filter((p) => p.role === "pilot").length + ",qualifiedTs:" + qualified.filter((p) => p.role === "ts").length);
}
