import { promises as fs } from "fs";
import path from "path";
import { createDemoData } from "@/lib/demoData";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { hashPin, newId } from "@/lib/security";
import type { AuditLog, Base, HeliqData, Personnel, Project, Qualification, ScheduleAssignment, ScheduleStatus } from "@/lib/types";

const localPath = process.env.VERCEL
  ? path.join("/tmp", "heliq.local.json")
  : path.join(process.cwd(), "data", "heliq.local.json");
const collections = ["personnel", "bases", "projects", "qualifications", "assignments", "auditLogs"] as const;
const DEFAULT_PROJECT_COLOR = "#2563eb";

function codeFromLastName(name?: string) {
  const fallback = "NY";
  const lastName = (name || "").trim().split(/\s+/).filter(Boolean).at(-1) || fallback;
  const clean = lastName.replace(/[^A-Za-zÆØÅæøå]/g, "");
  return (clean || fallback).slice(0, 3).toUpperCase();
}

function mode() {
  return getAdminDb() ? "firestore" as const : "local" as const;
}

function emptyData(): HeliqData {
  return { personnel: [], bases: [], projects: [], qualifications: [], vehicles: [], trailers: [], assignments: [], auditLogs: [], storageMode: mode() };
}

async function readLocal(): Promise<HeliqData> {
  try {
    return { ...JSON.parse(await fs.readFile(localPath, "utf8")), storageMode: "local" };
  } catch {
    const data = createDemoData("local");
    try {
      await writeLocal(data);
    } catch (error) {
      console.warn("Kunne ikke skrive lokal Heliq-demo-lagring", error);
    }
    return data;
  }
}

async function writeLocal(data: HeliqData) {
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, JSON.stringify({ ...data, storageMode: "local" }, null, 2));
}

async function readFirestore(): Promise<HeliqData> {
  const db = getAdminDb();
  if (!db) return readLocal();
  const data = emptyData();
  data.storageMode = "firestore";
  await Promise.all(collections.map(async (name) => {
    const snap = await db.collection(name).get();
    (data[name] as unknown[]) = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }));
  const settings = await db.collection("settings").doc("lists").get();
  data.vehicles = settings.data()?.vehicles ?? [];
  data.trailers = settings.data()?.trailers ?? [];
  return data;
}

async function writeCollectionDoc<T extends { id: string }>(collection: string, item: T) {
  const db = getAdminDb();
  if (db) await db.collection(collection).doc(item.id).set(item, { merge: true });
}

export async function getHeliqData() {
  return getAdminDb() ? readFirestore() : readLocal();
}

export function publicData(data: HeliqData): HeliqData {
  return { ...data, personnel: data.personnel.map(({ pinHash: _pinHash, ...person }) => person) };
}

async function audit(data: HeliqData, actor: string, action: string, target: string, summary: string) {
  const entry: AuditLog = { id: newId("audit"), at: new Date().toISOString(), actor, action, target, summary };
  data.auditLogs = [entry, ...data.auditLogs].slice(0, 200);
  await writeCollectionDoc("auditLogs", entry);
}

export async function seedDemo(actor = "admin") {
  const data = createDemoData(mode());
  await audit(data, actor, "seed", "demo", "Demo-data lastet inn på nytt");
  if (getAdminDb()) {
    const db = getAdminDb()!;
    await Promise.all(collections.flatMap((name) => data[name].map((item) => db.collection(name).doc(item.id).set(item))));
    await db.collection("settings").doc("lists").set({ vehicles: data.vehicles, trailers: data.trailers }, { merge: true });
  } else {
    await writeLocal(data);
  }
  return publicData(data);
}

export async function upsertPersonnel(input: Partial<Personnel> & { pin?: string }, actor: string) {
  const data = await getHeliqData();
  const id = input.id || newId("person");
  const existing = data.personnel.find((person) => person.id === id);
  const pinHash = input.pin ? hashPin(input.pin) : existing?.pinHash;
  if (pinHash && data.personnel.some((person) => person.id !== id && person.pinHash === pinHash)) throw new Error("PIN-koden er allerede i bruk");
  const name = input.name || "Ny ansatt";
  const item: Personnel = { id, name, code: codeFromLastName(name), role: input.role || "pilot", active: input.active ?? true, homeBaseId: input.homeBaseId, phone: input.phone || "", email: input.email || "", qualificationIds: input.qualificationIds || [], adr: input.adr || false, vehicleIds: input.vehicleIds || [], trailerIds: input.trailerIds || [], note: input.note || "", pinHash };
  data.personnel = [item, ...data.personnel.filter((person) => person.id !== id)];
  await audit(data, actor, existing ? "update" : "create", id, `${item.code} ${existing ? "oppdatert" : "opprettet"}`);
  if (getAdminDb()) await writeCollectionDoc("personnel", item); else await writeLocal(data);
  return publicData(data);
}

export async function upsertBase(input: Partial<Base>, actor: string) {
  const data = await getHeliqData();
  const id = input.id || newId("base");
  const item: Base = { id, name: input.name || "Ny base", code: (input.code || "BAS").toUpperCase().slice(0, 4), color: input.color || "#2563eb", minPilots: Number(input.minPilots ?? 1), minTs: Number(input.minTs ?? 1), requiredQualificationIds: input.requiredQualificationIds || [], note: input.note || "" };
  data.bases = [item, ...data.bases.filter((base) => base.id !== id)];
  await audit(data, actor, "upsert", id, `Base ${item.code} lagret`);
  if (getAdminDb()) await writeCollectionDoc("bases", item); else await writeLocal(data);
  return publicData(data);
}

export async function upsertBaseWithMembership(input: Partial<Base> & { pilotIds?: string[]; tsIds?: string[] }, actor: string) {
  const data = await getHeliqData();
  const id = input.id || newId("base");
  const item: Base = { id, name: input.name || "Ny base", code: (input.code || "BAS").toUpperCase().slice(0, 4), color: input.color || "#2563eb", minPilots: Number(input.minPilots ?? 1), minTs: Number(input.minTs ?? 1), requiredQualificationIds: input.requiredQualificationIds || [], note: input.note || "" };
  const selected = new Set([...(input.pilotIds || []), ...(input.tsIds || [])]);
  const changedPersonnel: Personnel[] = [];

  data.bases = [item, ...data.bases.filter((base) => base.id !== id)];
  data.personnel = data.personnel.map((person) => {
    if (person.role !== "pilot" && person.role !== "ts") return person;
    const nextHomeBaseId = selected.has(person.id) ? id : person.homeBaseId === id ? undefined : person.homeBaseId;
    if (nextHomeBaseId === person.homeBaseId) return person;
    const next = { ...person, homeBaseId: nextHomeBaseId };
    changedPersonnel.push(next);
    return next;
  });

  await audit(data, actor, "upsert", id, `Base ${item.code} lagret med ${selected.size} tilknyttede personer`);
  if (getAdminDb()) {
    await writeCollectionDoc("bases", item);
    await Promise.all(changedPersonnel.map((person) => writeCollectionDoc("personnel", person)));
  } else {
    await writeLocal(data);
  }
  return publicData(data);
}

export async function upsertProject(input: Partial<Project>, actor: string) {
  const data = await getHeliqData();
  const id = input.id || newId("project");
  const item: Project = { id, name: input.name || "Nytt prosjekt", customer: input.customer || "", location: input.location || "Egen lokasjon", color: DEFAULT_PROJECT_COLOR, startDate: input.startDate || new Date().toISOString().slice(0, 10), endDate: input.endDate || new Date().toISOString().slice(0, 10), minPilots: Number(input.minPilots ?? 1), minTs: Number(input.minTs ?? 1), requiredPilotQualificationIds: input.requiredPilotQualificationIds || [], requiredTsQualificationIds: input.requiredTsQualificationIds || [], note: input.note || "" };
  data.projects = [item, ...data.projects.filter((project) => project.id !== id)];
  await audit(data, actor, "upsert", id, `Prosjekt ${item.name} lagret`);
  if (getAdminDb()) await writeCollectionDoc("projects", item); else await writeLocal(data);
  return publicData(data);
}

export async function upsertQualification(input: Partial<Qualification>, actor: string) {
  const data = await getHeliqData();
  const item: Qualification = { id: input.id || newId("qual"), name: input.name || "Ny kvalifikasjon", kind: input.kind || "both" };
  data.qualifications = [item, ...data.qualifications.filter((q) => q.id !== item.id)];
  await audit(data, actor, "upsert", item.id, `Kvalifikasjon ${item.name} lagret`);
  if (getAdminDb()) await writeCollectionDoc("qualifications", item); else await writeLocal(data);
  return publicData(data);
}

export async function toggleAssignment(input: { personId: string; date: string; status: ScheduleStatus; baseId?: string; projectId?: string; note?: string }, actor: string) {
  const data = await getHeliqData();
  const id = `${input.personId}_${input.date}`;
  const existing = data.assignments.find((a) => a.id === id);
  const same = existing && existing.status === input.status && existing.baseId === input.baseId && existing.projectId === input.projectId;
  if (same) data.assignments = data.assignments.filter((a) => a.id !== id);
  else data.assignments = [{ id, ...input, updatedAt: new Date().toISOString() }, ...data.assignments.filter((a) => a.id !== id)];
  await audit(data, actor, same ? "removeAssignment" : "setAssignment", id, `${same ? "Fjernet" : "Satt"} ${input.personId} ${input.date}`);
  const db = getAdminDb();
  if (db) same ? await db.collection("assignments").doc(id).delete() : await writeCollectionDoc("assignments", data.assignments[0]);
  else await writeLocal(data);
  return publicData(data);
}

export async function applyCoverageAssignments(input: { assignments: Array<{ personId: string; date: string; baseId: string; note?: string }> }, actor: string) {
  const data = await getHeliqData();
  const nextAssignments = input.assignments.map((assignment) => ({
    id: `${assignment.personId}_${assignment.date}`,
    personId: assignment.personId,
    date: assignment.date,
    status: "work" as ScheduleStatus,
    baseId: assignment.baseId,
    note: assignment.note || "Dekningsforslag godkjent",
    updatedAt: new Date().toISOString(),
  }));
  const nextIds = new Set(nextAssignments.map((assignment) => assignment.id));
  data.assignments = [...nextAssignments, ...data.assignments.filter((assignment) => !nextIds.has(assignment.id))];
  await audit(data, actor, "applyCoverageSuggestion", "coverage", `${nextAssignments.length} dekningsforslag godkjent`);
  const db = getAdminDb();
  if (db) await Promise.all(nextAssignments.map((assignment) => writeCollectionDoc("assignments", assignment)));
  else await writeLocal(data);
  return publicData(data);
}
