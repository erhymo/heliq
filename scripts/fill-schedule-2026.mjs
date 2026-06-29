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

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysInYear(year) {
  const days = [];
  for (let date = `${year}-01-01`; date <= `${year}-12-31`; date = addDays(date, 1)) days.push(date);
  return days;
}

function mondayOnOrBefore(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}

function personCode(person) {
  const last = String(person.name || person.code || "---").trim().split(/\s+/).at(-1) || "---";
  return last.replace(/[^A-Za-zÆØÅæøå]/g, "").slice(0, 3).toUpperCase() || person.code || "---";
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

const year = 2026;
const [personnel, bases, existingAssignments] = await Promise.all([all("personnel"), all("bases"), all("assignments")]);
const activePeople = personnel.filter((p) => p.active && ["pilot", "ts"].includes(p.role));
if (bases.length === 0) throw new Error("no_bases");
if (activePeople.length === 0) throw new Error("no_active_people");

const yearDays = new Set(daysInYear(year));
const annualDutyLimit = Math.ceil(yearDays.size / 2);
const hardConflictStatuses = new Set(["work", "project", "vacation", "sick", "training", "standby", "sold_day", "travel", "off"]);
const dutyStatuses = new Set(["work", "project", "training", "standby", "travel"]);
const oldGeneratedIds = new Set(existingAssignments
  .filter((a) => String(a.date || "").startsWith(`${year}-`) && a.note?.includes("14/14"))
  .map((a) => a.id || `${a.personId}_${a.date}`));
const ruleAssignments = existingAssignments.filter((a) => !oldGeneratedIds.has(a.id || `${a.personId}_${a.date}`));
const existingByKey = new Map(ruleAssignments.map((a) => [a.id || `${a.personId}_${a.date}`, a]));
const dutyDatesByPerson = new Map();
const annualDutyCount = new Map();
for (const assignment of ruleAssignments) {
  if (!dutyStatuses.has(assignment.status)) continue;
  const date = String(assignment.date || "");
  const dates = dutyDatesByPerson.get(assignment.personId) || new Set();
  dates.add(date);
  dutyDatesByPerson.set(assignment.personId, dates);
  if (date.startsWith(`${year}-`)) annualDutyCount.set(assignment.personId, (annualDutyCount.get(assignment.personId) || 0) + 1);
}
const generated = [];
const warnings = [];

function qualifiedCount(base, role) {
  return activePeople.filter((p) => p.role === role && qualifiedForBase(p, base)).length;
}

const basesByConstraint = bases.slice().sort((a, b) => {
  const aSurplus = (qualifiedCount(a, "pilot") - Number(a.minPilots || 0)) + (qualifiedCount(a, "ts") - Number(a.minTs || 0));
  const bSurplus = (qualifiedCount(b, "pilot") - Number(b.minPilots || 0)) + (qualifiedCount(b, "ts") - Number(b.minTs || 0));
  return aSurplus - bSurplus || String(a.code).localeCompare(String(b.code));
});

function qualifiedForBase(person, base) {
  return (base.requiredQualificationIds || []).every((id) => (person.qualificationIds || []).includes(id));
}

function hasHardConflict(personId, date) {
  const existing = existingByKey.get(`${personId}_${date}`);
  return existing && hardConflictStatuses.has(existing.status);
}

function hasDutyBetween(personId, startDate, endDate) {
  const dates = dutyDatesByPerson.get(personId) || new Set();
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) if (dates.has(date)) return true;
  return false;
}

function canWorkBlock(person, blockDays) {
  if (blockDays.some((date) => hasHardConflict(person.id, date))) return false;
  if ((annualDutyCount.get(person.id) || 0) + blockDays.length > annualDutyLimit) return false;
  const first = blockDays[0];
  const last = blockDays.at(-1);
  if (!first || !last) return false;
  return !hasDutyBetween(person.id, addDays(first, -14), addDays(first, -1)) && !hasDutyBetween(person.id, addDays(last, 1), addDays(last, 14));
}

function candidatePool(base, role, blockDays, crewIndex, required, usedInBlock) {
  const home = activePeople.filter((p) => p.role === role && p.homeBaseId === base.id && qualifiedForBase(p, base));
  const borrowed = activePeople.filter((p) => p.role === role && p.homeBaseId !== base.id && qualifiedForBase(p, base));
  const sorted = [...home, ...borrowed]
    .filter((person) => !usedInBlock.has(person.id))
    .filter((person) => canWorkBlock(person, blockDays))
    .sort((a, b) => personCode(a).localeCompare(personCode(b)));
  const neededForRotation = Math.max(required * 2, required);
  const slotCount = Math.max(sorted.length, neededForRotation, 1);
  const selected = [];
  for (let index = 0; index < required; index += 1) {
    const slot = required === 0 ? 0 : (crewIndex * required + index) % slotCount;
    if (slot < sorted.length) selected.push(sorted[slot]);
  }
  selected.forEach((person) => usedInBlock.add(person.id));
  if (selected.length < required) warnings.push(`${base.code}_${role}=missing_${required - selected.length}`);
  return selected;
}

const firstBlockStart = mondayOnOrBefore(`${year}-01-01`);
for (let blockStart = firstBlockStart, blockIndex = 0; blockStart <= `${year}-12-31`; blockStart = addDays(blockStart, 14), blockIndex += 1) {
  const blockDays = Array.from({ length: 14 }, (_, i) => addDays(blockStart, i)).filter((d) => yearDays.has(d));
  if (blockDays.length === 0) continue;
  const usedInBlock = new Set();
  for (const base of basesByConstraint) {
    const pilots = candidatePool(base, "pilot", blockDays, blockIndex, Number(base.minPilots || 0), usedInBlock);
    const ts = candidatePool(base, "ts", blockDays, blockIndex, Number(base.minTs || 0), usedInBlock);
    for (const date of blockDays) {
      for (const person of [...pilots, ...ts]) {
        if (hasHardConflict(person.id, date)) continue;
        const id = `${person.id}_${date}`;
        generated.push({ id, personId: person.id, date, status: "work", baseId: base.id, note: `14/14 ${base.code} 2026`, updatedAt: new Date().toISOString() });
        const dates = dutyDatesByPerson.get(person.id) || new Set();
        dates.add(date);
        dutyDatesByPerson.set(person.id, dates);
        annualDutyCount.set(person.id, (annualDutyCount.get(person.id) || 0) + 1);
      }
    }
  }
}

const generatedIds = new Set(generated.map((a) => a.id));
const oldGenerated2026 = existingAssignments.filter((a) => oldGeneratedIds.has(a.id || `${a.personId}_${a.date}`) && !generatedIds.has(a.id || `${a.personId}_${a.date}`));
for (const item of oldGenerated2026) await db.collection("assignments").doc(item.id).delete();
for (const item of generated) await db.collection("assignments").doc(item.id).set(item, { merge: true });
await db.collection("auditLogs").doc(`audit_fill_2026_${Date.now()}`).set({
  id: `audit_fill_2026_${Date.now()}`,
  at: new Date().toISOString(),
  actor: "script",
  action: "fillSchedule2026",
  target: "schedule",
  summary: `${generated.length} draft schedulelinjer fylt for 2026`,
});
console.log("fill_schedule_2026=ok");
console.log("generated_assignments=" + generated.length);
console.log("deleted_old_generated=" + oldGenerated2026.length);
console.log("warnings=" + warnings.length);
