export type Role = "pilot" | "ts" | "admin";

export type ScheduleStatus =
  | "work"
  | "off"
  | "vacation"
  | "sick"
  | "training"
  | "standby"
  | "project"
  | "travel";

export type QualificationKind = "pilot" | "ts" | "both";

export type Qualification = {
  id: string;
  name: string;
  kind: QualificationKind;
};

export type Base = {
  id: string;
  name: string;
  code: string;
  color: string;
  minPilots: number;
  minTs: number;
  requiredQualificationIds: string[];
  note?: string;
};

export type Project = {
  id: string;
  name: string;
  customer?: string;
  location: string;
  color: string;
  startDate: string;
  endDate: string;
  minPilots: number;
  minTs: number;
  requiredPilotQualificationIds: string[];
  requiredTsQualificationIds: string[];
  note?: string;
};

export type Personnel = {
  id: string;
  name: string;
  code: string;
  role: Role;
  active: boolean;
  homeBaseId?: string;
  phone?: string;
  email?: string;
  qualificationIds: string[];
  adr?: boolean;
  vehicleIds: string[];
  trailerIds: string[];
  note?: string;
  pinHash?: string;
};

export type ScheduleAssignment = {
  id: string;
  personId: string;
  date: string;
  status: ScheduleStatus;
  baseId?: string;
  projectId?: string;
  note?: string;
  updatedAt?: string;
};

export type AuditLog = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  summary: string;
};

export type HeliqData = {
  personnel: Personnel[];
  bases: Base[];
  projects: Project[];
  qualifications: Qualification[];
  vehicles: string[];
  trailers: string[];
  assignments: ScheduleAssignment[];
  auditLogs: AuditLog[];
  storageMode: "firestore" | "local";
};

export const statusLabels: Record<ScheduleStatus, string> = {
  work: "Jobb",
  off: "Fri",
  vacation: "Ferie",
  sick: "Syk",
  training: "Kurs",
  standby: "Standby",
  project: "Prosjekt",
  travel: "Reise",
};

export const statusShort: Record<ScheduleStatus, string> = {
  work: "JOBB",
  off: "FRI",
  vacation: "FERIE",
  sick: "SYK",
  training: "KURS",
  standby: "STBY",
  project: "PROS",
  travel: "REISE",
};

export const statusTone: Record<ScheduleStatus, string> = {
  work: "border-slate-300 bg-white text-slate-900",
  off: "border-slate-200 bg-slate-50 text-slate-500",
  vacation: "border-emerald-200 bg-emerald-50 text-emerald-800",
  sick: "border-rose-200 bg-rose-50 text-rose-800",
  training: "border-violet-200 bg-violet-50 text-violet-800",
  standby: "border-amber-200 bg-amber-50 text-amber-800",
  project: "border-blue-200 bg-blue-50 text-blue-800",
  travel: "border-sky-200 bg-sky-50 text-sky-800",
};
