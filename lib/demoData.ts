import { hashPin, newId } from "@/lib/security";
import type { Base, HeliqData, Personnel, Project, Qualification, ScheduleAssignment } from "@/lib/types";

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function assignment(personId: string, date: string, projectId: string, status = "project"): ScheduleAssignment {
  return { id: `${personId}_${date}`, personId, date, projectId, status: status as ScheduleAssignment["status"] };
}

function codeFromLastName(name: string) {
  const lastName = name.trim().split(/\s+/).at(-1) || name;
  return lastName.replace(/[^A-Za-zÆØÅæøå]/g, "").slice(0, 3).toUpperCase();
}

function pilot(id: string, name: string, homeBaseId: string, qualificationIds: string[], pin: string): Personnel {
  return { id, name, code: codeFromLastName(name), role: "pilot", active: true, homeBaseId, phone: "", email: "", qualificationIds, vehicleIds: [], trailerIds: [], pinHash: hashPin(pin) };
}

function tsPerson(id: string, name: string, homeBaseId: string, adr: boolean, vehicleIds: string[], trailerIds: string[], pin: string): Personnel {
  return { id, name, code: codeFromLastName(name), role: "ts", active: true, homeBaseId, phone: "", email: "", qualificationIds: adr ? ["q_adr"] : [], adr, vehicleIds, trailerIds, pinHash: hashPin(pin) };
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
    { id: "proj_naal", name: "Nål-løft vest", customer: "Demo Kunde", location: "Jølster", color: "#2563eb", startDate: iso(year, 1, 8), endDate: iso(year, 1, 21), minPilots: 1, minTs: 1, requiredPilotQualificationIds: ["q_naal"], requiredTsQualificationIds: ["q_adr"], note: "Demo-prosjekt med kvalifikasjonskrav." },
    { id: "proj_linjer", name: "Linjeinspeksjon", customer: "Demo Nett", location: "Sunnfjord", color: "#2563eb", startDate: iso(year, 2, 5), endDate: iso(year, 2, 18), minPilots: 1, minTs: 1, requiredPilotQualificationIds: ["q_heslo2"], requiredTsQualificationIds: [] },
  ];
  const personnel: Personnel[] = [
    pilot("p_abc", "Anders Berg", "base_fde", ["q_heslo3", "q_naal"], "1001"),
    pilot("p_def", "Dina Eide", "base_bgo", ["q_heslo2"], "1002"),
    pilot("p_ghi", "Geir Holm", "base_fde", ["q_heslo4", "q_longline"], "1003"),
    pilot("p_pqr", "Pål Rønning", "base_bgo", ["q_heslo3"], "1004"),
    pilot("p_stu", "Sofie Tveit", "base_fde", ["q_heslo2", "q_longline"], "1005"),
    pilot("p_vwx", "Vebjørn Wold", "base_bgo", ["q_heslo4", "q_naal"], "1006"),
    pilot("p_yza", "Ylva Aasen", "base_fde", ["q_heslo3"], "1007"),
    pilot("p_bcd", "Bjørn Dahl", "base_bgo", ["q_heslo2"], "1008"),
    pilot("p_cde", "Camilla Eik", "base_fde", ["q_heslo4"], "1009"),
    pilot("p_efg", "Eirik Fonn", "base_bgo", ["q_heslo3", "q_longline"], "1010"),
    pilot("p_fgh", "Frida Gran", "base_fde", ["q_heslo2", "q_naal"], "1011"),
    pilot("p_hij", "Henrik Iversen", "base_bgo", ["q_heslo4"], "1012"),
    pilot("p_ijk", "Ida Jansen", "base_fde", ["q_heslo3"], "1013"),
    pilot("p_klm", "Kasper Lien", "base_bgo", ["q_heslo2"], "1014"),
    pilot("p_nop", "Nora Opheim", "base_fde", ["q_heslo4", "q_naal"], "1015"),
    tsPerson("t_jkl", "Jenny Lund", "base_fde", true, ["Pickup"], ["Stor henger"], "2001"),
    tsPerson("t_mno", "Mats Nord", "base_bgo", false, ["Varebil"], ["Liten henger"], "2002"),
    tsPerson("t_qrs", "Quentin Rød", "base_fde", true, ["Lastebil"], ["Stor henger"], "2003"),
    tsPerson("t_rst", "Ragnhild Sæther", "base_bgo", true, ["Pickup"], ["Liten henger"], "2004"),
    tsPerson("t_suv", "Stian Ulvik", "base_fde", false, ["Varebil"], ["Liten henger"], "2005"),
    tsPerson("t_tvw", "Tiril Vik", "base_bgo", true, ["Pickup", "Lastebil"], ["Stor henger"], "2006"),
    tsPerson("t_uxy", "Ulrik Xylander", "base_fde", false, ["Pickup"], ["Liten henger"], "2007"),
    tsPerson("t_vab", "Vilde Abrahamsen", "base_bgo", true, ["Varebil"], ["Stor henger"], "2008"),
    tsPerson("t_wac", "William Aksnes", "base_fde", true, ["Lastebil"], ["Stor henger"], "2009"),
    tsPerson("t_xad", "Xander Adolfsen", "base_bgo", false, ["Pickup"], ["Liten henger"], "2010"),
    tsPerson("t_yae", "Yngvild Eide", "base_fde", true, ["Varebil"], ["Liten henger"], "2011"),
    tsPerson("t_zaf", "Zahid Fjeld", "base_bgo", true, ["Pickup", "Lastebil"], ["Stor henger"], "2012"),
    tsPerson("t_laa", "Lars Aamodt", "base_fde", false, ["Varebil"], ["Liten henger"], "2013"),
    tsPerson("t_lbb", "Linda Bøe", "base_bgo", true, ["Pickup"], ["Stor henger"], "2014"),
    tsPerson("t_lcc", "Leif Christiansen", "base_fde", false, ["Varebil"], ["Liten henger"], "2015"),
    tsPerson("t_ldd", "Live Dalen", "base_bgo", true, ["Lastebil"], ["Stor henger"], "2016"),
    tsPerson("t_lee", "Lena Engen", "base_fde", true, ["Pickup"], ["Liten henger"], "2017"),
    tsPerson("t_lff", "Ludvik Foss", "base_bgo", false, ["Varebil"], ["Stor henger"], "2018"),
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
