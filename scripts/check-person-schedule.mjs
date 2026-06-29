import fs from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const queryName = process.argv.slice(2).join(" ").toLowerCase();
if (!queryName) throw new Error("Usage: node scripts/check-person-schedule.mjs <name>");

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
const [people, bases, quals, assignments] = await Promise.all([all("personnel"), all("bases"), all("qualifications"), all("assignments")]);
const person = people.find((p) => String(p.name || "").toLowerCase().includes(queryName));
if (!person) throw new Error("person_not_found");
const baseById = new Map(bases.map((b) => [b.id, b]));
const qualById = new Map(quals.map((q) => [q.id, q]));
const in2026 = assignments.filter((a) => a.personId === person.id && String(a.date || "").startsWith("2026-")).sort((a, b) => String(a.date).localeCompare(String(b.date)));
const counts = in2026.reduce((acc, a) => { const key = a.status + (a.baseId ? ":" + (baseById.get(a.baseId)?.code || a.baseId) : ""); acc[key] = (acc[key] || 0) + 1; return acc; }, {});
let maxStreak = 0;
let streak = 0;
let previous = "";
for (const assignment of in2026) {
  const expected = previous ? new Date(`${previous}T00:00:00Z`) : null;
  if (expected) expected.setUTCDate(expected.getUTCDate() + 1);
  streak = expected && expected.toISOString().slice(0, 10) === assignment.date ? streak + 1 : 1;
  maxStreak = Math.max(maxStreak, streak);
  previous = assignment.date;
}
console.log("person=" + person.name);
console.log("role=" + person.role);
console.log("active=" + person.active);
console.log("homeBase=" + (baseById.get(person.homeBaseId)?.code || person.homeBaseId || "none"));
console.log("qualifications=" + (person.qualificationIds || []).map((id) => qualById.get(id)?.name || id).join(","));
console.log("assignments_2026=" + in2026.length);
console.log("first=" + (in2026[0]?.date || "none"));
console.log("last=" + (in2026.at(-1)?.date || "none"));
console.log("max_consecutive_assignment_days=" + maxStreak);
console.log("counts=" + JSON.stringify(counts));
console.log("sample=" + in2026.slice(0, 10).map((a) => `${a.date}:${a.status}:${baseById.get(a.baseId)?.code || a.baseId || ""}`).join(","));
