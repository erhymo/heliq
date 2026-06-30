import type { Base, HeliqData, Personnel, ScheduleAssignment, ScheduleStatus } from "@/lib/types";

export type CrewRole = "pilot" | "ts";
export type ScheduleRuleAssignment = Pick<ScheduleAssignment, "personId" | "date" | "status" | "baseId" | "projectId" | "note">;
export type CellCandidateSuggestion = { base: Base; role: CrewRole; person: Personnel; startDate: string; endDate: string; warnings: string[] };
export type CoverageProposalAssignment = { personId: string; date: string; baseId: string; note?: string };
export type CoverageProposal = { id: string; startDate: string; endDate: string; baseId: string; baseCode: string; crewLabel: string; missingPilots: number; missingTs: number; pilotNames: string[]; tsNames: string[]; warnings: string[]; assignments: CoverageProposalAssignment[] };
export type CoverageGap = { id: string; date: string; baseCode: string; missingPilots: number; missingTs: number; reasons: string[] };

export const DUTY_STATUSES = new Set<ScheduleStatus>(["work", "project", "training", "standby", "travel"]);
export const HARD_CONFLICT_STATUSES = new Set<ScheduleStatus>(["work", "project", "vacation", "sick", "training", "standby", "sold_day", "travel", "off"]);

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysInYear(year: number) {
  const days: string[] = [];
  for (let date = `${year}-01-01`; date <= `${year}-12-31`; date = addDays(date, 1)) days.push(date);
  return days;
}

export function mondayOnOrBefore(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}

export function personCode(person: Pick<Personnel, "name" | "code">) {
  const fallback = person.code || "---";
  const last = (person.name || fallback).trim().split(/\s+/).at(-1) || fallback;
  return (last.replace(/[^A-Za-zÆØÅæøå]/g, "") || fallback).slice(0, 3).toUpperCase();
}

export function annualDutyLimit(year: number) {
  return Math.ceil(daysInYear(year).length / 2);
}

export function qualifiedForBase(person: Personnel, base: Base) {
  return base.requiredQualificationIds.every((id) => person.qualificationIds.includes(id));
}

function assignmentId(assignment: Pick<ScheduleAssignment, "personId" | "date">) {
  return `${assignment.personId}_${assignment.date}`;
}

function activeCrew(data: HeliqData) {
  return data.personnel.filter((person) => person.active && (person.role === "pilot" || person.role === "ts"));
}

function existingMap(data: HeliqData, ignoreIds = new Set<string>()) {
  return new Map(data.assignments.filter((item) => !ignoreIds.has(item.id || assignmentId(item))).map((item) => [item.id || assignmentId(item), item]));
}

function dutyCount(data: HeliqData, personId: string, year: string, ignoreIds = new Set<string>()) {
  return data.assignments.filter((a) => !ignoreIds.has(a.id || assignmentId(a)) && a.personId === personId && a.date.startsWith(`${year}-`) && DUTY_STATUSES.has(a.status)).length;
}

function hasDutyBetween(map: Map<string, ScheduleAssignment>, personId: string, startDate: string, endDate: string) {
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const assignment = map.get(`${personId}_${date}`);
    if (assignment && DUTY_STATUSES.has(assignment.status)) return true;
  }
  return false;
}

function hasHardConflict(map: Map<string, ScheduleAssignment>, personId: string, date: string) {
  const assignment = map.get(`${personId}_${date}`);
  return assignment ? HARD_CONFLICT_STATUSES.has(assignment.status) : false;
}

function ranges(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  const result: Array<{ startDate: string; endDate: string; dates: string[] }> = [];
  for (const date of sorted) {
    const last = result.at(-1);
    if (last && addDays(last.endDate, 1) === date) { last.endDate = date; last.dates.push(date); }
    else result.push({ startDate: date, endDate: date, dates: [date] });
  }
  return result;
}

function datesBetween(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function validateScheduleAssignments(data: HeliqData, assignments: ScheduleRuleAssignment[]) {
  const errors: string[] = [];
  const dutyAssignments = assignments.filter((item) => DUTY_STATUSES.has(item.status));
  const ignoreIds = new Set(assignments.map(assignmentId));
  const map = existingMap(data, ignoreIds);
  const grouped = new Map<string, ScheduleRuleAssignment[]>();
  for (const assignment of dutyAssignments) {
    const person = data.personnel.find((item) => item.id === assignment.personId);
    const base = assignment.baseId ? data.bases.find((item) => item.id === assignment.baseId) : undefined;
    if (!person || !person.active || (person.role !== "pilot" && person.role !== "ts")) errors.push(`${assignment.personId} er ikke aktiv pilot/TS`);
    if (assignment.status === "work" && base && person && !qualifiedForBase(person, base)) errors.push(`${person.name} mangler kvalifikasjon for ${base.code}`);
    grouped.set(assignment.personId, [...(grouped.get(assignment.personId) || []), assignment]);
  }
  for (const [personId, items] of grouped) {
    const person = data.personnel.find((item) => item.id === personId);
    const year = items[0]?.date.slice(0, 4) || String(new Date().getFullYear());
    const existingDutyDates = data.assignments.filter((a) => !ignoreIds.has(a.id || assignmentId(a)) && a.personId === personId && a.date.startsWith(`${year}-`) && DUTY_STATUSES.has(a.status)).map((a) => a.date);
    const resultingRanges = ranges([...existingDutyDates, ...items.map((item) => item.date)]);
    const dutyTotal = resultingRanges.reduce((sum, range) => sum + range.dates.length, 0);
    if (dutyTotal > annualDutyLimit(Number(year))) errors.push(`${person?.name || personId} overstiger årsverk (${dutyTotal}/${annualDutyLimit(Number(year))})`);
    for (const range of ranges(items.map((item) => item.date))) {
      if (range.dates.some((date) => hasHardConflict(map, personId, date))) errors.push(`${person?.name || personId} har konflikt i perioden ${range.startDate}–${range.endDate}`);
    }
    for (let index = 0; index < resultingRanges.length; index += 1) {
      const range = resultingRanges[index];
      if (range.dates.length > 14) errors.push(`${person?.name || personId} har mer enn 14 sammenhengende pliktdager`);
      const next = resultingRanges[index + 1];
      if (next && datesBetween(addDays(range.endDate, 1), addDays(next.startDate, -1)).length < 14) errors.push(`${person?.name || personId} har mindre enn 14 fridager mellom pliktperioder`);
    }
  }
  return errors;
}

export function roleCount(data: HeliqData, base: Base, date: string, role: CrewRole) {
  return data.assignments.filter((a) => a.date === date && a.baseId === base.id).map((a) => data.personnel.find((p) => p.id === a.personId)).filter((p): p is Personnel => Boolean(p && p.role === role)).length;
}

export function bestCandidate(data: HeliqData, base: Base, role: CrewRole, startDate: string, endDate: string) {
  const dates = datesBetween(startDate, endDate);
  return activeCrew(data).filter((person) => person.role === role && qualifiedForBase(person, base) && validateScheduleAssignments(data, dates.map((date) => ({ personId: person.id, date, status: "work", baseId: base.id }))).length === 0).sort((a, b) => Number(b.homeBaseId === base.id) - Number(a.homeBaseId === base.id) || dutyCount(data, a.id, startDate.slice(0, 4)) - dutyCount(data, b.id, startDate.slice(0, 4)) || personCode(a).localeCompare(personCode(b)))[0];
}

export function buildCellCandidateSuggestions(data: HeliqData, date: string): CellCandidateSuggestion[] {
  const year = date.slice(0, 4);
  const blockStart = mondayOnOrBefore(date);
  const blockDays = Array.from({ length: 14 }, (_, index) => addDays(blockStart, index)).filter((day) => day.startsWith(year));
  const startDate = blockDays[0] || date;
  const endDate = blockDays.at(-1) || date;
  return data.bases.flatMap((base) => (["pilot", "ts"] as const).flatMap((role) => {
    const missing = Math.max(0, Number(role === "pilot" ? base.minPilots : base.minTs) - roleCount(data, base, date, role));
    if (!missing) return [];
    const person = bestCandidate(data, base, role, startDate, endDate);
    return person ? [{ base, role, person, startDate, endDate, warnings: [] }] : [];
  }));
}

export function buildCoverageGaps(data: HeliqData, days: string[]): CoverageGap[] {
  return data.bases.flatMap((base) => days.flatMap((date) => {
    const missingPilots = Math.max(0, Number(base.minPilots || 0) - roleCount(data, base, date, "pilot"));
    const missingTs = Math.max(0, Number(base.minTs || 0) - roleCount(data, base, date, "ts"));
    if (!missingPilots && !missingTs) return [];
    const reasons: string[] = [];
    for (const role of ["pilot", "ts"] as const) {
      const missing = role === "pilot" ? missingPilots : missingTs;
      if (!missing) continue;
      const qualified = activeCrew(data).filter((person) => person.role === role && qualifiedForBase(person, base));
      const candidate = bestCandidate(data, base, role, mondayOnOrBefore(date), addDays(mondayOnOrBefore(date), 13));
      if (qualified.length === 0) reasons.push(`Ingen kvalifisert ${role === "ts" ? "TS" : "pilot"}`);
      else if (!candidate) reasons.push(`Ingen lovlig ${role === "ts" ? "TS" : "pilot"} innen 14/14/årsverk`);
    }
    return [{ id: `${base.id}_${date}`, date, baseCode: base.code, missingPilots, missingTs, reasons }];
  }));
}
