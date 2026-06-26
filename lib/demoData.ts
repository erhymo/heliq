import { hashPin, newId } from "@/lib/security";
import type { Base, HeliqData, Personnel, Project, Qualification, ScheduleAssignment } from "@/lib/types";

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function assignment(personId: string, date: string, projectId: string, status = "project"): ScheduleAssignment {
  return { id: `${personId}_${date}`, personId, date, projectId, status: status as ScheduleAssignment["status"] };
}

export function createDemoData(storageMode: "firestore" | "local"): HeliqData {
  const year = new Date().getFullYear();
  const qualifications: Qualification[] = [
    { id: "q_heslo2", name: "HESLO 2", kind: "pilot" },
    { id: "q_heslo3", name: "HESLO 3", kind: "pilot" },
    { id: "q_heslo4", name: "HESLO 4", kind: "pilot" },
    { id: "q_naal", name: "Nål", kind: "pilot" },
    { id: "q_longline", name: "Longline", kind: "pilot" },
    { id: "q_adr", name: "ADR", kind: "ts" },
  ];
  const bases: Base[] = [
    { id: "base_fde", name: "Førde", code: "FDE", color: "#2563eb", minPilots: 1, minTs: 1, requiredQualificationIds: ["q_heslo3"] },
    { id: "base_bgo", name: "Bergen", code: "BGO", color: "#0f766e", minPilots: 1, minTs: 1, requiredQualificationIds: [] },
  ];
  const projects: Project[] = [
    { id: "proj_naal", name: "Nål-løft vest", customer: "Demo Kunde", location: "Jølster", color: "#1d4ed8", startDate: iso(year, 1, 8), endDate: iso(year, 1, 21), minPilots: 1, minTs: 1, requiredPilotQualificationIds: ["q_naal"], requiredTsQualificationIds: ["q_adr"], note: "Demo-prosjekt med kvalifikasjonskrav." },
    { id: "proj_linjer", name: "Linjeinspeksjon", customer: "Demo Nett", location: "Sunnfjord", color: "#059669", startDate: iso(year, 2, 5), endDate: iso(year, 2, 18), minPilots: 1, minTs: 1, requiredPilotQualificationIds: ["q_heslo2"], requiredTsQualificationIds: [] },
  ];
  const personnel: Personnel[] = [
    { id: "p_abc", name: "Anders Berg", code: "ABC", role: "pilot", active: true, homeBaseId: "base_fde", phone: "", email: "", qualificationIds: ["q_heslo3", "q_naal"], vehicleIds: [], trailerIds: [], pinHash: hashPin("1001") },
    { id: "p_def", name: "Dina Eide", code: "DEF", role: "pilot", active: true, homeBaseId: "base_bgo", phone: "", email: "", qualificationIds: ["q_heslo2"], vehicleIds: [], trailerIds: [], pinHash: hashPin("1002") },
    { id: "p_ghi", name: "Geir Holm", code: "GHI", role: "pilot", active: true, homeBaseId: "base_fde", phone: "", email: "", qualificationIds: ["q_heslo4", "q_longline"], vehicleIds: [], trailerIds: [], pinHash: hashPin("1003") },
    { id: "t_jkl", name: "Jenny Lund", code: "JKL", role: "ts", active: true, homeBaseId: "base_fde", phone: "", email: "", qualificationIds: ["q_adr"], adr: true, vehicleIds: ["Pickup"], trailerIds: ["Stor henger"], pinHash: hashPin("2001") },
    { id: "t_mno", name: "Mats Nord", code: "MNO", role: "ts", active: true, homeBaseId: "base_bgo", phone: "", email: "", qualificationIds: [], adr: false, vehicleIds: ["Varebil"], trailerIds: ["Liten henger"], pinHash: hashPin("2002") },
  ];
  const dates = Array.from({ length: 14 }, (_, i) => iso(year, 1, 8 + i));
  const assignments = dates.flatMap((date) => [assignment("p_abc", date, "proj_naal"), assignment("t_jkl", date, "proj_naal")]);
  return {
    personnel,
    bases,
    projects,
    qualifications,
    vehicles: ["Pickup", "Varebil", "Lastebil"],
    trailers: ["Liten henger", "Stor henger"],
    assignments,
    auditLogs: [{ id: newId("audit"), at: new Date().toISOString(), actor: "system", action: "seed", target: "demo", summary: "Demo-data opprettet" }],
    storageMode,
  };
}
