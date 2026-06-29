import fs from "fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const year = "2026";
const dutyStatuses = new Set(["work", "project", "training", "standby", "travel"]);
const annualDutyLimit = Math.ceil(365 / 2);
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
const [people, assignments] = await Promise.all([all("personnel"), all("assignments")]);
let violations = 0;
let maxSeenStreak = 0;
let maxSeenDuty = 0;
for (const person of people.filter((p) => p.active && ["pilot", "ts"].includes(p.role))) {
  const duty = assignments
    .filter((a) => a.personId === person.id && String(a.date || "").startsWith(year + "-") && dutyStatuses.has(a.status))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let streak = 0;
  let maxStreak = 0;
  let previous = "";
  for (const assignment of duty) {
    const expected = previous ? new Date(`${previous}T00:00:00Z`) : null;
    if (expected) expected.setUTCDate(expected.getUTCDate() + 1);
    streak = expected && expected.toISOString().slice(0, 10) === assignment.date ? streak + 1 : 1;
    maxStreak = Math.max(maxStreak, streak);
    previous = assignment.date;
  }
  maxSeenStreak = Math.max(maxSeenStreak, maxStreak);
  maxSeenDuty = Math.max(maxSeenDuty, duty.length);
  const ok = duty.length <= annualDutyLimit && maxStreak <= 14;
  if (!ok) {
    violations += 1;
    console.log(`violation=${person.name},duty:${duty.length},maxStreak:${maxStreak}`);
  }
}
console.log("annual_duty_limit=" + annualDutyLimit);
console.log("max_seen_duty_days=" + maxSeenDuty);
console.log("max_seen_consecutive_days=" + maxSeenStreak);
console.log("rule_violations=" + violations);
if (violations > 0) process.exit(1);
console.log("schedule_rules_2026=ok");
