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

loadEnv();
if (!getApps().length) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }) });
}

const db = getFirestore();
const snap = await db.collection("personnel").get();
const people = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const target = 10;
const names = {
  pilot: ["Atlas", "Boreal", "Comet", "Delta", "Echo", "Fjord", "Glimt", "Hav", "Is", "Juno"],
  ts: ["Linje", "Motor", "Nord", "Oskar", "Polaris", "Radar", "Saga", "Tango", "Utsikt", "Vega"],
};
const labels = { pilot: "Pilot", ts: "TS" };
let added = 0;

for (const role of ["pilot", "ts"]) {
  let existing = people.filter((person) => person.active && person.role === role).length;
  for (let index = existing + 1; index <= target; index += 1) {
    const suffix = names[role][index - 1] || String(index).padStart(2, "0");
    const id = `person_auto_${role}_${String(index).padStart(2, "0")}`;
    const doc = await db.collection("personnel").doc(id).get();
    if (doc.exists) continue;
    await db.collection("personnel").doc(id).set({
      id,
      name: `${labels[role]} ${suffix}`,
      code: `${role === "pilot" ? "P" : "T"}${String(index).padStart(2, "0")}`,
      role,
      active: true,
      phone: "",
      email: "",
      qualificationIds: [],
      adr: false,
      vehicleIds: [],
      trailerIds: [],
      note: "Placeholder opprettet automatisk. Sett base/kvalifikasjoner manuelt.",
    });
    existing += 1;
    added += 1;
  }
}

await db.collection("auditLogs").doc(`audit_fill_personnel_${Date.now()}`).set({
  id: `audit_fill_personnel_${Date.now()}`,
  at: new Date().toISOString(),
  actor: "script",
  action: "fillPersonnel10x10",
  target: "personnel",
  summary: `${added} placeholder-personer lagt til for 10 piloter / 10 TS`,
});

const after = (await db.collection("personnel").get()).docs.map((doc) => doc.data());
console.log("fill_personnel_10_10=ok");
console.log("added=" + added);
console.log("active_pilots=" + after.filter((p) => p.active && p.role === "pilot").length);
console.log("active_ts=" + after.filter((p) => p.active && p.role === "ts").length);
