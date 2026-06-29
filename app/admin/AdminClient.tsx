"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import HeliqLogo from "@/components/HeliqLogo";
import type { Base, HeliqData, Personnel, Project, QualificationKind, Role, ScheduleAssignment, ScheduleStatus } from "@/lib/types";
import { statusColor, statusLabels, statusShort } from "@/lib/types";

type Tab = "schedule" | "people" | "projects" | "bases" | "quals" | "audit";
type CoverageProposalAssignment = { personId: string; date: string; baseId: string; note?: string };
type CoverageProposal = {
  id: string;
  startDate: string;
  endDate: string;
  baseId: string;
  baseCode: string;
  crewLabel: string;
  missingPilots: number;
  missingTs: number;
  pilotNames: string[];
  tsNames: string[];
  warnings: string[];
  assignments: CoverageProposalAssignment[];
};
type ScheduleCellSelection = { personId: string; date: string };
type ScheduleApplyOptions = { personId?: string; baseId?: string; projectId?: string; note?: string; startDate?: string; endDate?: string };
type CellCandidateSuggestion = { base: Base; role: "pilot" | "ts"; person: Personnel; startDate: string; endDate: string };

const quickScheduleStatuses: ScheduleStatus[] = ["work", "sold_day", "vacation", "sick", "training", "standby", "travel", "off"];
const dutyStatuses = new Set<ScheduleStatus>(["work", "project", "training", "standby", "travel"]);
const hardConflictStatuses = new Set<ScheduleStatus>(["work", "project", "vacation", "sick", "training", "standby", "sold_day", "travel", "off"]);
const todayYear = new Date().getFullYear();
const PROJECT_COLOR = "#2563eb";

function shortCodeFromText(text: string, fallback = "---") {
  const clean = text.trim().split(/\s+/).at(-1)?.replace(/[^A-Za-zÆØÅæøå]/g, "") || text.replace(/[^A-Za-zÆØÅæøå]/g, "");
  return (clean || fallback).slice(0, 3).toUpperCase();
}

function personCode(person: Pick<Personnel, "name" | "code">) {
  return shortCodeFromText(person.name, person.code || "---");
}

function daysInYear(year: number) {
  const days: string[] = [];
  const date = new Date(Date.UTC(year, 0, 1));
  while (date.getUTCFullYear() === year) {
    days.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}

function datesBetween(startDate: string, endDate: string) {
  const dates: string[] = [];
  const safeEndDate = endDate && endDate >= startDate ? endDate : startDate;
  for (let date = startDate; date <= safeEndDate; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function prettyDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("no-NO", { day: "2-digit", month: "short", weekday: "short" });
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOnOrBefore(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
}

export default function AdminClient() {
  const [data, setData] = useState<HeliqData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("schedule");
  const [year, setYear] = useState(todayYear);
  const [cellSelection, setCellSelection] = useState<ScheduleCellSelection | null>(null);
  const [cellEndDate, setCellEndDate] = useState("");
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);

  useEffect(() => { load(); }, []);
  const coverageSuggestions = useMemo(() => data ? buildCoverageSuggestions(data, daysInYear(year), new Set(dismissedSuggestionIds)) : [], [data, year, dismissedSuggestionIds]);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/app-data", { cache: "no-store" });
    if (response.status === 401) { setData(null); setLoading(false); return; }
    const payload = await response.json();
    setData(payload.data);
    setLoading(false);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Feil innlogging"); return; }
    setEmail("");
    setPassword("");
    await load();
  }

  async function mutate(action: string, payload: Record<string, unknown>) {
    setError("");
    const response = await fetch("/api/admin/mutate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Kunne ikke lagre"); return; }
    setData(result.data);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setData(null);
    setEmail("");
    setPassword("");
    setError("");
  }

  async function pushSchedule() {
    if (!window.confirm("Publisere gjeldende draft-schedule til alle piloter og TS?")) return;
    await mutate("pushSchedule", {});
  }

  if (loading) return <Shell><p className="rounded-xl bg-white p-5 shadow-sm">Laster Heliq…</p></Shell>;
  if (!data) return (
    <Shell>
      <form onSubmit={login} className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <HeliqLogo />
        <h1 className="mt-6 text-xl font-semibold">Admin-login</h1>
        <p className="mt-2 text-sm text-slate-600">Logg inn med Firebase Authentication-brukeren din. Lokal fallback bruker kun passord hvis Firebase web API key ikke er satt.</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="E-post / brukernavn" autoComplete="username" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Passord" autoComplete="current-password" />
        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
        <button className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">Logg inn</button>
      </form>
    </Shell>
  );

  const people = [...data.personnel].sort((a, b) => (a.role === b.role ? personCode(a).localeCompare(personCode(b)) : a.role === "pilot" ? -1 : 1));
  const assignmentsByKey = new Map(data.assignments.map((assignment) => [`${assignment.personId}_${assignment.date}`, assignment]));
  const days = daysInYear(year);
  const warnings = buildWarnings(data).slice(0, 8);
  const selectedPersonId = "";
  const selectedCellPerson = cellSelection ? data.personnel.find((person) => person.id === cellSelection.personId) : undefined;
  const selectedCellAssignment = cellSelection ? assignmentsByKey.get(`${cellSelection.personId}_${cellSelection.date}`) : undefined;
  const selectedCellSuggestions = cellSelection && !selectedCellAssignment ? buildCellCandidateSuggestions(data, cellSelection.date) : [];

  function clickCell(person: Personnel, date: string) {
    if (selectedPersonId && selectedPersonId !== person.id) return;
    setCellSelection({ personId: person.id, date });
    setCellEndDate(date);
  }

  async function applyCellStatus(status: ScheduleStatus, options: ScheduleApplyOptions = {}) {
    if (!cellSelection || !data) return;
    const person = data.personnel.find((candidate) => candidate.id === cellSelection.personId);
    const assignee = options.personId ? data.personnel.find((candidate) => candidate.id === options.personId) : person;
    if (!person || !assignee) return;
    const projectId = status === "project" ? options.projectId : undefined;
    const nextStatus = projectId ? "project" : status === "project" ? "work" : status;
    const shouldUseBase = !projectId && (Boolean(options.baseId) || nextStatus === "work");
    const baseId = projectId ? undefined : options.baseId || (shouldUseBase ? person.homeBaseId : undefined);
    const dates = datesBetween(options.startDate || cellSelection.date, options.endDate || cellEndDate);
    await mutate("setScheduleAssignments", { assignments: dates.map((date) => ({ personId: assignee.id, date, status: nextStatus, projectId, baseId, note: options.note })) });
    setCellSelection(null);
  }

  async function clearCellAssignments() {
    if (!cellSelection || !data) return;
    const dates = datesBetween(cellSelection.date, cellEndDate);
    await mutate("removeScheduleAssignments", { assignments: dates.map((date) => ({ personId: cellSelection.personId, date })) });
    setCellSelection(null);
  }

  async function approveCoverageSuggestion(suggestion: CoverageProposal) {
    await mutate("applyCoverageAssignments", { assignments: suggestion.assignments });
    setDismissedSuggestionIds((ids) => [...ids, suggestion.id]);
  }

  function dismissCoverageSuggestion(suggestionId: string) {
    setDismissedSuggestionIds((ids) => [...ids, suggestionId]);
  }

  return (
    <Shell wide>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 p-4">
          <HeliqLogo />
          <div className="flex flex-wrap gap-2">
            {(["schedule", "people", "projects", "bases", "quals", "audit"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === item ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}>{tabLabel(item)}</button>)}
            <button onClick={pushSchedule} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Push schedule</button>
            <button onClick={logout} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100">Logg ut</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1800px] space-y-3 p-2 lg:p-3">
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {tab === "schedule" && <ScheduleToolbar year={year} setYear={setYear} />}
        {tab === "schedule" && <CoverageSuggestions suggestions={coverageSuggestions} totalHidden={Math.max(0, coverageSuggestions.length - 12)} onApprove={approveCoverageSuggestion} onDismiss={dismissCoverageSuggestion} />}
        {tab === "schedule" && warnings.length > 0 && <Warnings warnings={warnings} />}
        {tab === "schedule" && <ScheduleGrid people={people} days={days} data={data} assignmentsByKey={assignmentsByKey} selectedPersonId={selectedPersonId} selectedCell={cellSelection} onCell={clickCell} />}
        {tab === "schedule" && cellSelection && selectedCellPerson && <ScheduleCellPopover key={`${cellSelection.personId}_${cellSelection.date}`} data={data} person={selectedCellPerson} date={cellSelection.date} endDate={cellEndDate} setEndDate={setCellEndDate} assignment={selectedCellAssignment} suggestions={selectedCellSuggestions} onApply={applyCellStatus} onClear={clearCellAssignments} onClose={() => setCellSelection(null)} />}
        {tab === "people" && <PeoplePanel data={data} mutate={mutate} />}
        {tab === "projects" && <ProjectsPanel data={data} mutate={mutate} />}
        {tab === "bases" && <BasesPanel data={data} mutate={mutate} />}
        {tab === "quals" && <QualificationsPanel mutate={mutate} />}
        {tab === "audit" && <AuditPanel data={data} />}
      </main>
    </Shell>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`min-h-screen bg-slate-50 text-slate-900 ${wide ? "" : "flex items-center justify-center p-4"}`}>{children}</div>;
}

function tabLabel(tab: Tab) {
  return ({ schedule: "Schedule", people: "Personell", projects: "Prosjekter", bases: "Baser", quals: "Kvalifikasjoner", audit: "Logg" })[tab];
}

function ScheduleToolbar(props: { year: number; setYear: (y: number) => void }) {
  return (
    <section className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">År<select value={String(props.year)} onChange={(event) => props.setYear(Number(event.target.value))} className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900">{[todayYear - 1, todayYear, todayYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <div className="flex-1" />
      <span className="hidden text-xs text-slate-400 sm:inline">Flere schedule-handlinger kommer her</span>
    </section>
  );
}

function Select({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <label className="text-sm font-semibold text-slate-600">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900">{options.map((option) => <option key={option} value={option}>{labels[option] || option}</option>)}</select></label>;
}

function ScheduleGrid({ people, days, data, assignmentsByKey, selectedPersonId, selectedCell, onCell }: { people: Personnel[]; days: string[]; data: HeliqData; assignmentsByKey: Map<string, ScheduleAssignment>; selectedPersonId: string; selectedCell: ScheduleCellSelection | null; onCell: (p: Personnel, d: string) => void }) {
  const projectById = new Map(data.projects.map((project) => [project.id, project]));
  const baseById = new Map(data.bases.map((base) => [base.id, base]));
  return (
    <section className="heliq-grid max-h-[82vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-w-max" style={{ gridTemplateColumns: `7rem repeat(${people.length}, 4.25rem)` }}>
        <div className="sticky left-0 top-0 z-20 border-b border-r border-slate-200 bg-slate-100 p-2 text-[11px] font-bold uppercase text-slate-500">Dato</div>
        {people.map((person) => <div key={person.id} className={`sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-100 p-1 text-center ${selectedPersonId && selectedPersonId !== person.id ? "opacity-40" : ""}`}><p className="text-sm font-bold">{personCode(person)}</p><p className="text-[9px] text-slate-500">{person.role === "ts" ? "TS" : "Pilot"}</p></div>)}
        {days.map((day) => <Row key={day} day={day} people={people} assignmentsByKey={assignmentsByKey} projectById={projectById} baseById={baseById} selectedPersonId={selectedPersonId} selectedCell={selectedCell} onCell={onCell} />)}
      </div>
    </section>
  );
}

function Row({ day, people, assignmentsByKey, projectById, baseById, selectedPersonId, selectedCell, onCell }: { day: string; people: Personnel[]; assignmentsByKey: Map<string, ScheduleAssignment>; projectById: Map<string, Project>; baseById: Map<string, Base>; selectedPersonId: string; selectedCell: ScheduleCellSelection | null; onCell: (p: Personnel, d: string) => void }) {
  const weekend = [0, 6].includes(new Date(`${day}T00:00:00`).getDay());
  return <>{<div className={`sticky left-0 z-10 border-b border-r border-slate-200 p-2 text-xs font-semibold ${weekend ? "bg-slate-100" : "bg-white"}`}>{prettyDate(day)}</div>}{people.map((person) => {
    const assignment = assignmentsByKey.get(`${person.id}_${day}`);
    const project = assignment?.projectId ? projectById.get(assignment.projectId) : undefined;
    const base = assignment?.baseId ? baseById.get(assignment.baseId) : undefined;
    const color = project ? PROJECT_COLOR : assignment?.status === "work" ? base?.color : assignment ? statusColor[assignment.status] : undefined;
    const cellCode = project ? shortCodeFromText(project.name) : assignment?.status === "work" ? base?.code || statusShort.work.slice(0, 3) : assignment ? statusShort[assignment.status].slice(0, 4) : "";
    const selected = selectedCell?.personId === person.id && selectedCell.date === day;
    return <button key={`${person.id}_${day}`} onClick={() => onCell(person, day)} className={`h-8 border-b border-r border-slate-200 p-0.5 text-center text-[10px] font-black transition hover:ring-2 hover:ring-blue-400 ${selectedPersonId && selectedPersonId !== person.id ? "opacity-40" : ""} ${selected ? "ring-2 ring-blue-600" : ""}`} style={{ background: color ? `${color}24` : weekend ? "#f8fafc" : "#fff", color: color || "#334155" }}>{cellCode}</button>;
  })}</>;
}

function ScheduleCellPopover({ data, person, date, endDate, setEndDate, assignment, suggestions, onApply, onClear, onClose }: { data: HeliqData; person: Personnel; date: string; endDate: string; setEndDate: (value: string) => void; assignment?: ScheduleAssignment; suggestions: CellCandidateSuggestion[]; onApply: (status: ScheduleStatus, options?: ScheduleApplyOptions) => void; onClear: () => void; onClose: () => void }) {
  const [baseId, setBaseId] = useState(assignment?.baseId || person.homeBaseId || "");
  const [projectId, setProjectId] = useState(assignment?.projectId || "");
  const [note, setNote] = useState(assignment?.note || "");
  const base = data.bases.find((item) => item.id === baseId);
  const project = data.projects.find((item) => item.id === projectId);
  const baseLabel = base?.code || "ingen base";
  return (
    <div className="fixed right-4 top-24 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Marker schedule</p>
          <h3 className="mt-1 font-semibold text-slate-950">{personCode(person)} · {person.name}</h3>
          <p className="text-sm text-slate-600">{prettyDate(date)}{assignment ? ` · nå: ${statusLabels[assignment.status]}` : ""}</p>
        </div>
        <button onClick={onClose} className="rounded-full border border-slate-200 px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-50">Lukk</button>
      </div>
      <label className="mt-4 block text-sm font-semibold text-slate-600">Til dato<input type="date" value={endDate || date} min={date} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" /></label>
      {suggestions.length > 0 && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-950"><p className="font-bold">Systemforslag for manglende dekning</p><div className="mt-2 grid gap-1">{suggestions.slice(0, 3).map((suggestion) => <button key={`${suggestion.base.id}_${suggestion.role}_${suggestion.person.id}`} onClick={() => onApply("work", { personId: suggestion.person.id, baseId: suggestion.base.id, startDate: suggestion.startDate, endDate: suggestion.endDate, note: `Systemforslag 14/14 ${suggestion.base.code}` })} className="rounded-lg bg-white px-2 py-1.5 text-left font-semibold text-emerald-900 hover:bg-emerald-100">{personCode(suggestion.person)} · {suggestion.person.name} til {suggestion.base.code} ({suggestion.role === "ts" ? "TS" : "pilot"}) · {prettyDate(suggestion.startDate)}–{prettyDate(suggestion.endDate)}</button>)}</div></div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Base<select value={baseId} onChange={(event) => setBaseId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="">Ingen base</option>{data.bases.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Prosjekt<select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="">Ingen prosjekt</option>{data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      {project && <button onClick={() => onApply("project", { projectId, note })} className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Prosjekt · {project.name}</button>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {quickScheduleStatuses.map((status) => <button key={status} onClick={() => onApply(status, { baseId: status === "work" ? baseId : undefined, note })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-blue-300 hover:bg-blue-50">{status === "work" ? `Jobb · ${baseLabel}` : statusLabels[status]}</button>)}
      </div>
      <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900" placeholder="Notat (valgfritt)" />
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <button onClick={onClear} className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100">Fjern</button>
        <button onClick={onClose} className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Avbryt</button>
      </div>
    </div>
  );
}

function buildCellCandidateSuggestions(data: HeliqData, date: string): CellCandidateSuggestion[] {
  const year = date.slice(0, 4);
  const annualDutyLimit = Math.ceil(daysInYear(Number(year)).length / 2);
  const activePeople = data.personnel.filter((person) => person.active && (person.role === "pilot" || person.role === "ts"));
  const assignmentsByKey = new Map(data.assignments.map((assignment) => [`${assignment.personId}_${assignment.date}`, assignment]));
  const blockStart = mondayOnOrBefore(date);
  const blockDays = Array.from({ length: 14 }, (_, index) => addDays(blockStart, index)).filter((day) => day.startsWith(year));
  const blockFirst = blockDays[0] || date;
  const blockEnd = blockDays.at(-1) || date;

  function qualifiedForBase(person: Personnel, base: Base) {
    return base.requiredQualificationIds.every((id) => person.qualificationIds.includes(id));
  }

  function roleCount(base: Base, role: "pilot" | "ts") {
    return data.assignments
      .filter((assignment) => assignment.date === date && assignment.baseId === base.id)
      .map((assignment) => data.personnel.find((person) => person.id === assignment.personId))
      .filter((person): person is Personnel => person !== undefined && person.role === role).length;
  }

  function dutyCount(personId: string) {
    return data.assignments.filter((assignment) => assignment.personId === personId && assignment.date.startsWith(year) && dutyStatuses.has(assignment.status)).length;
  }

  function hasDutyBetween(personId: string, startDate: string, endDate: string) {
    for (let current = startDate; current <= endDate; current = addDays(current, 1)) {
      const assignment = assignmentsByKey.get(`${personId}_${current}`);
      if (assignment && dutyStatuses.has(assignment.status)) return true;
    }
    return false;
  }

  function canWorkBlock(person: Personnel) {
    if (blockDays.some((day) => {
      const assignment = assignmentsByKey.get(`${person.id}_${day}`);
      return assignment ? hardConflictStatuses.has(assignment.status) : false;
    })) return false;
    if (dutyCount(person.id) + blockDays.length > annualDutyLimit) return false;
    return !hasDutyBetween(person.id, addDays(blockStart, -14), addDays(blockStart, -1)) && !hasDutyBetween(person.id, addDays(blockEnd, 1), addDays(blockEnd, 14));
  }

  const suggestions: CellCandidateSuggestion[] = [];
  for (const base of data.bases) {
    for (const role of ["pilot", "ts"] as const) {
      const missing = Math.max(0, Number(role === "pilot" ? base.minPilots : base.minTs) - roleCount(base, role));
      if (missing === 0) continue;
      const candidates = activePeople
        .filter((person) => person.role === role && qualifiedForBase(person, base) && canWorkBlock(person))
        .sort((a, b) => Number(b.homeBaseId === base.id) - Number(a.homeBaseId === base.id) || dutyCount(a.id) - dutyCount(b.id) || personCode(a).localeCompare(personCode(b)));
      if (candidates[0]) suggestions.push({ base, role, person: candidates[0], startDate: blockFirst, endDate: blockEnd });
    }
  }
  return suggestions;
}

function buildCoverageSuggestions(data: HeliqData, days: string[], dismissed: Set<string>): CoverageProposal[] {
  const today = new Date().toISOString().slice(0, 10);
  const activePeople = data.personnel.filter((person) => person.active && (person.role === "pilot" || person.role === "ts"));
  const assignmentsByPersonDate = new Map(data.assignments.map((assignment) => [`${assignment.personId}_${assignment.date}`, assignment]));
  const yearDays = new Set(days);
  const year = days[0]?.slice(0, 4) || String(todayYear);
  const annualDutyLimit = Math.ceil(yearDays.size / 2);
  const firstBlockStart = mondayOnOrBefore(`${year}-01-01`);
  const lastDay = days.at(-1) || `${year}-12-31`;
  const futureStart = today > `${year}-01-01` ? today : `${year}-01-01`;

  function qualifiedForBase(person: Personnel, base: Base) {
    return base.requiredQualificationIds.every((id) => person.qualificationIds.includes(id));
  }

  function personHasConflict(personId: string, blockDays: string[]) {
    return blockDays.some((date) => {
      const assignment = assignmentsByPersonDate.get(`${personId}_${date}`);
      return assignment ? hardConflictStatuses.has(assignment.status) : false;
    });
  }

  function personDutyCount(personId: string) {
    return data.assignments.filter((assignment) => assignment.personId === personId && assignment.date.startsWith(year) && dutyStatuses.has(assignment.status)).length;
  }

  function personHasDutyBetween(personId: string, startDate: string, endDate: string) {
    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
      const assignment = assignmentsByPersonDate.get(`${personId}_${date}`);
      if (assignment && dutyStatuses.has(assignment.status)) return true;
    }
    return false;
  }

  function personCanWorkBlock(person: Personnel, blockDays: string[]) {
    const first = blockDays[0];
    const last = blockDays.at(-1);
    if (!first || !last) return false;
    if (personHasConflict(person.id, blockDays)) return false;
    if (personDutyCount(person.id) + blockDays.length > annualDutyLimit) return false;
    return !personHasDutyBetween(person.id, addDays(first, -14), addDays(first, -1)) && !personHasDutyBetween(person.id, addDays(last, 1), addDays(last, 14));
  }

  function roleCount(base: Base, date: string, role: "pilot" | "ts") {
    return data.assignments
      .filter((assignment) => assignment.date === date && assignment.baseId === base.id)
      .map((assignment) => data.personnel.find((person) => person.id === assignment.personId))
      .filter((person): person is Personnel => person !== undefined && person.role === role).length;
  }

  function candidatePool(base: Base, role: "pilot" | "ts", blockDays: string[], crewIndex: number, required: number) {
    const homeBase = activePeople.filter((person) => person.role === role && person.homeBaseId === base.id && qualifiedForBase(person, base));
    const borrowed = activePeople.filter((person) => person.role === role && person.homeBaseId !== base.id && qualifiedForBase(person, base));
    const sorted = [...homeBase, ...borrowed].filter((person) => personCanWorkBlock(person, blockDays));
    const homeBaseCount = homeBase.length;
    const neededForRotation = Math.max(required * 2, required);
    const rotated = sorted.slice().sort((a, b) => personCode(a).localeCompare(personCode(b)));
    const slotCount = Math.max(rotated.length, neededForRotation, 1);
    const selected = Array.from({ length: required }, (_, index) => {
      const slot = required === 0 ? 0 : (crewIndex * required + index) % slotCount;
      return slot < rotated.length ? rotated[slot] : undefined;
    }).filter((person): person is Personnel => person !== undefined);
    return {
      selected,
      enoughHomeBaseFor1414: homeBaseCount >= neededForRotation,
      enoughTotalFor1414: sorted.length >= neededForRotation,
    };
  }

  const proposals: CoverageProposal[] = [];
  for (let blockStart = firstBlockStart, blockIndex = 0; blockStart <= lastDay; blockStart = addDays(blockStart, 14), blockIndex += 1) {
    const rawBlockDays = Array.from({ length: 14 }, (_, index) => addDays(blockStart, index));
    const blockDays = rawBlockDays.filter((date) => yearDays.has(date) && date >= futureStart);
    if (blockDays.length === 0) continue;
    const blockEnd = blockDays.at(-1) || blockStart;

    for (const base of data.bases) {
      const pilotPool = candidatePool(base, "pilot", blockDays, blockIndex, base.minPilots);
      const tsPool = candidatePool(base, "ts", blockDays, blockIndex, base.minTs);
      const assignments: CoverageProposalAssignment[] = [];
      const missingPilotDays = blockDays.filter((date) => roleCount(base, date, "pilot") < base.minPilots);
      const missingTsDays = blockDays.filter((date) => roleCount(base, date, "ts") < base.minTs);

      for (const date of missingPilotDays) {
        const missing = Math.max(0, base.minPilots - roleCount(base, date, "pilot"));
        assignments.push(...pilotPool.selected.slice(0, missing).map((person) => ({ personId: person.id, date, baseId: base.id, note: `14/14-forslag for ${base.code}` })));
      }
      for (const date of missingTsDays) {
        const missing = Math.max(0, base.minTs - roleCount(base, date, "ts"));
        assignments.push(...tsPool.selected.slice(0, missing).map((person) => ({ personId: person.id, date, baseId: base.id, note: `14/14-forslag for ${base.code}` })));
      }
      if (assignments.length === 0) continue;

      const warnings: string[] = [];
      if (!pilotPool.enoughHomeBaseFor1414 && base.minPilots > 0) warnings.push("Ikke nok hjemmebase-piloter til ren 14/14. Foreslår kvalifiserte tilgjengelige piloter hvis mulig.");
      if (!tsPool.enoughHomeBaseFor1414 && base.minTs > 0) warnings.push("Ikke nok hjemmebase-TS til ren 14/14. Foreslår kvalifiserte tilgjengelige TS hvis mulig.");
      if (pilotPool.selected.length < base.minPilots || tsPool.selected.length < base.minTs) warnings.push("Mangler fortsatt nok ledige/kvalifiserte personer til å fylle hele perioden.");

      const id = `${base.id}_${blockStart}_${pilotPool.selected.map((person) => person.id).join("-")}_${tsPool.selected.map((person) => person.id).join("-")}`;
      if (dismissed.has(id)) continue;
      proposals.push({
        id,
        startDate: blockDays[0],
        endDate: blockEnd,
        baseId: base.id,
        baseCode: base.code,
        crewLabel: blockIndex % 2 === 0 ? "Crew A" : "Crew B",
        missingPilots: missingPilotDays.length,
        missingTs: missingTsDays.length,
        pilotNames: pilotPool.selected.map((person) => `${personCode(person)} ${person.name}`),
        tsNames: tsPool.selected.map((person) => `${personCode(person)} ${person.name}`),
        warnings,
        assignments,
      });
    }
  }
  return proposals;
}

function CoverageSuggestions({ suggestions, totalHidden, onApprove, onDismiss }: { suggestions: CoverageProposal[]; totalHidden: number; onApprove: (suggestion: CoverageProposal) => void; onDismiss: (id: string) => void }) {
  const visible = suggestions.slice(0, 12);
  const totalPilotGaps = suggestions.reduce((sum, suggestion) => sum + suggestion.missingPilots, 0);
  const totalTsGaps = suggestions.reduce((sum, suggestion) => sum + suggestion.missingTs, 0);
  if (suggestions.length === 0) {
    return <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><span className="font-semibold">Dekningsforslag:</span> Alle baser ser dekket ut for valgt år.</section>;
  }
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <h2 className="font-semibold text-blue-950">Dekningsforslag</h2>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white px-2 py-1 text-blue-900">{suggestions.length} forslag</span>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">P {totalPilotGaps}</span>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">TS {totalTsGaps}</span>
        </div>
      </div>
      <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-blue-100 bg-white">
        {visible.map((suggestion) => {
          const crew = [...suggestion.pilotNames, ...suggestion.tsNames].join(", ") || "Ingen ledige kandidater";
          return (
            <article key={suggestion.id} className="grid gap-2 border-b border-slate-100 p-2 text-xs last:border-b-0 lg:grid-cols-[8rem_10rem_9rem_1fr_auto] lg:items-center">
              <div><p className="font-black text-slate-950">{suggestion.baseCode}</p><p className="text-slate-500">{suggestion.crewLabel}</p></div>
              <p className="font-semibold text-slate-700">{prettyDate(suggestion.startDate)} – {prettyDate(suggestion.endDate)}</p>
              <div className="flex flex-wrap gap-1 font-bold"><span className="rounded bg-amber-50 px-2 py-1 text-amber-800">P {suggestion.missingPilots}</span><span className="rounded bg-amber-50 px-2 py-1 text-amber-800">TS {suggestion.missingTs}</span><span className="rounded bg-blue-50 px-2 py-1 text-blue-800">{suggestion.assignments.length}</span></div>
              <div className="min-w-0"><p className="truncate font-semibold text-slate-700" title={crew}>{crew}</p>{suggestion.warnings.length > 0 && <p className="truncate text-amber-700" title={suggestion.warnings.join(" · ")}>⚠ {suggestion.warnings.join(" · ")}</p>}</div>
              <div className="flex gap-1 lg:justify-end">
                <button onClick={() => onApprove(suggestion)} className="rounded-lg bg-slate-900 px-2.5 py-1.5 font-semibold text-white">Legg inn</button>
                <button onClick={() => onDismiss(suggestion.id)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-700">Skjul</button>
              </div>
            </article>
          );
        })}
      </div>
      {suggestions.length > visible.length && <p className="mt-1 text-xs text-blue-800">Viser {visible.length} av {suggestions.length}. Godkjenn eller skjul forslag for å se flere.</p>}
      {totalHidden > 0 && <p className="mt-1 text-xs text-blue-800">{totalHidden} ekstra forslag er skjult i gjeldende visning.</p>}
    </section>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-semibold text-amber-950">Varsler</h2><ul className="mt-2 grid gap-1 text-sm text-amber-900">{warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></section>;
}

function buildWarnings(data: HeliqData) {
  const warnings: string[] = [];
  for (const project of data.projects) {
    const projectAssignments = data.assignments.filter((a) => a.projectId === project.id);
    const dates = [...new Set(projectAssignments.map((a) => a.date))];
    for (const date of dates) {
      const people = projectAssignments.filter((a) => a.date === date).map((a) => data.personnel.find((p) => p.id === a.personId)).filter(Boolean) as Personnel[];
      if (people.filter((p) => p.role === "pilot").length < project.minPilots) warnings.push(`${project.name} mangler pilot ${date}`);
      if (people.filter((p) => p.role === "ts").length < project.minTs) warnings.push(`${project.name} mangler TS ${date}`);
    }
  }
  return warnings;
}

type PersonForm = {
  id?: string;
  name: string;
  code: string;
  role: Exclude<Role, "admin">;
  active: boolean;
  homeBaseId: string;
  phone: string;
  email: string;
  qualificationIds: string[];
  adr: boolean;
  vehicleIds: string[];
  trailerIds: string[];
  note: string;
  pin: string;
};

const emptyPersonForm: PersonForm = { name: "", code: "", role: "pilot", active: true, homeBaseId: "", phone: "", email: "", qualificationIds: [], adr: false, vehicleIds: [], trailerIds: [], note: "", pin: "" };

function PeoplePanel({ data, mutate }: { data: HeliqData; mutate: (action: string, payload: Record<string, unknown>) => Promise<void> }) {
  const [person, setPerson] = useState<PersonForm>(emptyPersonForm);
  const editing = Boolean(person.id);
  const roleQualifications = data.qualifications.filter((qualification) => qualification.kind === "both" || qualification.kind === person.role);
  const baseLabels = { "": "Ingen", ...Object.fromEntries(data.bases.map((base) => [base.id, `${base.code} · ${base.name}`])) };
  const pilots = data.personnel.filter((item) => item.role === "pilot").sort((a, b) => personCode(a).localeCompare(personCode(b)));
  const taskSpecialists = data.personnel.filter((item) => item.role === "ts").sort((a, b) => personCode(a).localeCompare(personCode(b)));

  function editPerson(item: Personnel) {
    setPerson({ id: item.id, name: item.name, code: item.code, role: item.role === "admin" ? "pilot" : item.role, active: item.active, homeBaseId: item.homeBaseId || "", phone: item.phone || "", email: item.email || "", qualificationIds: item.qualificationIds || [], adr: Boolean(item.adr), vehicleIds: item.vehicleIds || [], trailerIds: item.trailerIds || [], note: item.note || "", pin: "" });
  }

  async function savePerson(event: FormEvent) {
    event.preventDefault();
    await mutate("upsertPersonnel", { personnel: { ...person, homeBaseId: person.homeBaseId || undefined, pin: person.pin || undefined } });
    setPerson(emptyPersonForm);
  }

  return (
    <Panel title="Personell">
      <form onSubmit={savePerson} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{editing ? `Rediger ${person.name}` : "Legg til person"}</h3>
            <p className="text-sm text-slate-600">Kode lages automatisk fra de tre første bokstavene i etternavnet. Piloter står til venstre, TS til høyre.</p>
          </div>
          {editing && <button type="button" onClick={() => setPerson(emptyPersonForm)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Avbryt</button>}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Input label="Navn" value={person.name} onChange={(v) => setPerson({ ...person, name: v })} />
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><p className="text-sm font-semibold text-slate-600">Kode</p><p className="mt-1 text-lg font-black text-slate-900">{person.name ? shortCodeFromText(person.name) : person.code || "—"}</p></div>
          <Select label="Rolle" value={person.role} onChange={(v) => setPerson({ ...person, role: v as Exclude<Role, "admin">, qualificationIds: person.qualificationIds.filter((id) => data.qualifications.some((q) => q.id === id && (q.kind === "both" || q.kind === v))) })} options={["pilot", "ts"]} labels={{ pilot: "Pilot", ts: "Lastemann/TS" }} />
          <Select label="Hovedbase" value={person.homeBaseId} onChange={(v) => setPerson({ ...person, homeBaseId: v })} options={["", ...data.bases.map((base) => base.id)]} labels={baseLabels} />
          <Input label="Telefon" value={person.phone} onChange={(v) => setPerson({ ...person, phone: v })} />
          <Input label="E-post" value={person.email} onChange={(v) => setPerson({ ...person, email: v })} />
          <Input label={editing ? "Ny PIN (valgfritt)" : "PIN"} value={person.pin} onChange={(v) => setPerson({ ...person, pin: v.replace(/[^0-9]/g, "").slice(0, 4) })} />
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={person.active} onChange={(e) => setPerson({ ...person, active: e.target.checked })} /> Aktiv</label>
        </div>

        <CheckboxList title="Kvalifikasjoner" items={roleQualifications.map((qualification) => ({ id: qualification.id, label: qualification.name }))} selected={person.qualificationIds} onChange={(qualificationIds) => setPerson({ ...person, qualificationIds })} emptyText="Ingen kvalifikasjoner opprettet for valgt rolle." />

        {person.role === "ts" && (
          <div className="grid gap-3 lg:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={person.adr} onChange={(e) => setPerson({ ...person, adr: e.target.checked, qualificationIds: e.target.checked ? [...new Set([...person.qualificationIds, "q_adr"])] : person.qualificationIds.filter((id) => id !== "q_adr") })} /> ADR</label>
            <CheckboxList title="Bil" items={data.vehicles.map((name) => ({ id: name, label: name }))} selected={person.vehicleIds} onChange={(vehicleIds) => setPerson({ ...person, vehicleIds })} emptyText="Ingen biler opprettet." />
            <CheckboxList title="Henger" items={data.trailers.map((name) => ({ id: name, label: name }))} selected={person.trailerIds} onChange={(trailerIds) => setPerson({ ...person, trailerIds })} emptyText="Ingen hengere opprettet." />
          </div>
        )}

        <Input label="Notat" value={person.note} onChange={(v) => setPerson({ ...person, note: v })} />
        <button className="w-fit rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">{editing ? "Lagre endringer" : "Legg til"}</button>
      </form>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section><h3 className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Piloter</h3><div className="grid gap-3">{pilots.map((item) => <PersonCard key={item.id} person={item} data={data} selected={item.id === person.id} onClick={() => editPerson(item)} />)}</div></section>
        <section><h3 className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Lastemenn/TS</h3><div className="grid gap-3">{taskSpecialists.map((item) => <PersonCard key={item.id} person={item} data={data} selected={item.id === person.id} onClick={() => editPerson(item)} />)}</div></section>
      </div>
    </Panel>
  );
}

function CheckboxList({ title, items, selected, onChange, emptyText }: { title: string; items: { id: string; label: string }[]; selected: string[]; onChange: (selected: string[]) => void; emptyText: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-sm font-semibold text-slate-600">{title}</p>{items.length === 0 ? <p className="mt-2 text-sm text-slate-500">{emptyText}</p> : <div className="mt-2 flex flex-wrap gap-2">{items.map((item) => <label key={item.id} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${selected.includes(item.id) ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 bg-white text-slate-700"}`}><input type="checkbox" className="sr-only" checked={selected.includes(item.id)} onChange={() => onChange(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} />{item.label}</label>)}</div>}</div>;
}

function PersonCard({ person, data, selected, onClick }: { person: Personnel; data: HeliqData; selected: boolean; onClick: () => void }) {
  const qualificationNames = person.qualificationIds.map((id) => data.qualifications.find((qualification) => qualification.id === id)?.name).filter(Boolean).join(", ");
  const base = data.bases.find((item) => item.id === person.homeBaseId);
  return <button type="button" onClick={onClick} className={`rounded-xl border bg-slate-50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 ${selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"}`}><h3 className="font-semibold">{personCode(person)} · {person.name}</h3><p className="mt-1 text-sm text-slate-600">{person.role === "ts" ? "Lastemann/TS" : "Pilot"}{base ? ` · ${base.code}` : ""}{person.active ? "" : " · Inaktiv"}</p><p className="mt-2 text-xs text-slate-500">{qualificationNames || "Ingen kvalifikasjoner"}</p></button>;
}

type ProjectForm = {
  id?: string;
  name: string;
  customer: string;
  location: string;
  startDate: string;
  endDate: string;
  minPilots: number;
  minTs: number;
  requiredPilotQualificationIds: string[];
  requiredTsQualificationIds: string[];
  note: string;
};

const todayIso = new Date().toISOString().slice(0, 10);
const emptyProjectForm: ProjectForm = { name: "", customer: "", location: "", startDate: todayIso, endDate: todayIso, minPilots: 1, minTs: 1, requiredPilotQualificationIds: [], requiredTsQualificationIds: [], note: "" };

function ProjectsPanel({ data, mutate }: { data: HeliqData; mutate: (action: string, payload: Record<string, unknown>) => Promise<void> }) {
  const [project, setProject] = useState<ProjectForm>(emptyProjectForm);
  const editing = Boolean(project.id);
  const pilotQualifications = data.qualifications.filter((qualification) => qualification.kind === "pilot" || qualification.kind === "both");
  const tsQualifications = data.qualifications.filter((qualification) => qualification.kind === "ts" || qualification.kind === "both");

  function editProject(item: Project) {
    setProject({
      id: item.id,
      name: item.name,
      customer: item.customer || "",
      location: item.location,
      startDate: item.startDate,
      endDate: item.endDate,
      minPilots: item.minPilots,
      minTs: item.minTs,
      requiredPilotQualificationIds: item.requiredPilotQualificationIds || [],
      requiredTsQualificationIds: item.requiredTsQualificationIds || [],
      note: item.note || "",
    });
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    await mutate("upsertProject", { project });
    setProject(emptyProjectForm);
  }

  return (
    <Panel title="Prosjekter">
      <form onSubmit={saveProject} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{editing ? `Rediger ${shortCodeFromText(project.name)}` : "Legg til prosjekt"}</h3>
            <p className="text-sm text-slate-600">Trykk på et prosjekt under, f.eks. VES, for å redigere bemanning, datoer og krav.</p>
          </div>
          {editing && <button type="button" onClick={() => setProject(emptyProjectForm)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Avbryt</button>}
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          <Input label="Prosjektnavn" value={project.name} onChange={(v) => setProject({ ...project, name: v })} />
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2"><p className="text-sm font-semibold text-slate-600">Kode i schedule</p><p className="mt-1 text-lg font-black text-slate-900">{project.name ? shortCodeFromText(project.name) : "—"}</p></div>
          <Input label="Kunde/oppdrag" value={project.customer} onChange={(v) => setProject({ ...project, customer: v })} />
          <Input label="Lokasjon" value={project.location} onChange={(v) => setProject({ ...project, location: v })} />
          <Input label="Start" type="date" value={project.startDate} onChange={(v) => setProject({ ...project, startDate: v })} />
          <Input label="Slutt" type="date" value={project.endDate} onChange={(v) => setProject({ ...project, endDate: v })} />
          <Input label="Antall piloter" type="number" value={String(project.minPilots)} onChange={(v) => setProject({ ...project, minPilots: Number(v) })} />
          <Input label="Antall TS" type="number" value={String(project.minTs)} onChange={(v) => setProject({ ...project, minTs: Number(v) })} />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <CheckboxList title="Krav til piloter" items={pilotQualifications.map((qualification) => ({ id: qualification.id, label: qualification.name }))} selected={project.requiredPilotQualificationIds} onChange={(requiredPilotQualificationIds) => setProject({ ...project, requiredPilotQualificationIds })} emptyText="Ingen pilotkvalifikasjoner opprettet." />
          <CheckboxList title="Krav til lastemann/TS" items={tsQualifications.map((qualification) => ({ id: qualification.id, label: qualification.name }))} selected={project.requiredTsQualificationIds} onChange={(requiredTsQualificationIds) => setProject({ ...project, requiredTsQualificationIds })} emptyText="Ingen TS-kvalifikasjoner opprettet." />
        </div>

        <Input label="Notat" value={project.note} onChange={(v) => setProject({ ...project, note: v })} />
        <button className="w-fit rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">{editing ? "Lagre prosjekt" : "Opprett prosjekt"}</button>
      </form>

      <CardGrid>{data.projects.map((item) => <ProjectCard key={item.id} project={item} data={data} selected={item.id === project.id} onClick={() => editProject(item)} />)}</CardGrid>
    </Panel>
  );
}

function ProjectCard({ project, data, selected, onClick }: { project: Project; data: HeliqData; selected: boolean; onClick: () => void }) {
  const pilotRequirements = project.requiredPilotQualificationIds.map((id) => data.qualifications.find((qualification) => qualification.id === id)?.name).filter(Boolean);
  const tsRequirements = project.requiredTsQualificationIds.map((id) => data.qualifications.find((qualification) => qualification.id === id)?.name).filter(Boolean);
  return <button type="button" onClick={onClick} className={`rounded-xl border bg-slate-50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 ${selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"}`} style={{ borderLeft: `5px solid ${PROJECT_COLOR}` }}><h3 className="font-semibold">{shortCodeFromText(project.name)} · {project.name}</h3><p className="mt-1 text-sm text-slate-600">{project.location} · {project.minPilots} pilot / {project.minTs} TS</p><p className="mt-2 text-xs text-slate-500">Pilotkrav: {pilotRequirements.join(", ") || "Ingen"}</p><p className="mt-1 text-xs text-slate-500">TS-krav: {tsRequirements.join(", ") || "Ingen"}</p></button>;
}

type BaseForm = { id?: string; name: string; code: string; color: string; minPilots: number; minTs: number; pilotIds: string[]; tsIds: string[]; note: string };

const emptyBaseForm: BaseForm = { name: "", code: "", color: "#2563eb", minPilots: 1, minTs: 1, pilotIds: [], tsIds: [], note: "" };

function BasesPanel({ data, mutate }: { data: HeliqData; mutate: (action: string, payload: Record<string, unknown>) => Promise<void> }) {
  const [base, setBase] = useState<BaseForm>(emptyBaseForm);
  const editing = Boolean(base.id);
  const pilots = data.personnel.filter((person) => person.role === "pilot" && person.active).sort((a, b) => a.code.localeCompare(b.code));
  const taskSpecialists = data.personnel.filter((person) => person.role === "ts" && person.active).sort((a, b) => a.code.localeCompare(b.code));

  function labelFor(person: Personnel) {
    const homeBase = data.bases.find((item) => item.id === person.homeBaseId);
    return `${person.code} · ${person.name}${homeBase && homeBase.id !== base.id ? ` (${homeBase.code})` : ""}`;
  }

  function editBase(item: Base) {
    setBase({ id: item.id, name: item.name, code: item.code, color: item.color, minPilots: item.minPilots, minTs: item.minTs, note: item.note || "", pilotIds: pilots.filter((person) => person.homeBaseId === item.id).map((person) => person.id), tsIds: taskSpecialists.filter((person) => person.homeBaseId === item.id).map((person) => person.id) });
  }

  async function saveBase(event: FormEvent) {
    event.preventDefault();
    await mutate("upsertBaseWithMembership", { base });
    setBase(emptyBaseForm);
  }

  return (
    <Panel title="Baser">
      <form onSubmit={saveBase} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{editing ? `Rediger ${base.code}` : "Legg til base"}</h3>
            <p className="text-sm text-slate-600">Trykk på en base under for å velge hvilke piloter og lastemenn/TS som hører til basen.</p>
          </div>
          {editing && <button type="button" onClick={() => setBase(emptyBaseForm)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Avbryt</button>}
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <Input label="Navn" value={base.name} onChange={(v) => setBase({ ...base, name: v })} />
          <Input label="Kode" value={base.code} onChange={(v) => setBase({ ...base, code: v.toUpperCase().slice(0, 4) })} />
          <Input label="Farge" type="color" value={base.color} onChange={(v) => setBase({ ...base, color: v })} />
          <Input label="Min piloter" type="number" value={String(base.minPilots)} onChange={(v) => setBase({ ...base, minPilots: Number(v) })} />
          <Input label="Min TS" type="number" value={String(base.minTs)} onChange={(v) => setBase({ ...base, minTs: Number(v) })} />
          <button className="self-end rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">{editing ? "Lagre base" : "Opprett base"}</button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <CheckboxList title="Piloter som hører til basen" items={pilots.map((person) => ({ id: person.id, label: labelFor(person) }))} selected={base.pilotIds} onChange={(pilotIds) => setBase({ ...base, pilotIds })} emptyText="Ingen aktive piloter." />
          <CheckboxList title="Lastemenn/TS som hører til basen" items={taskSpecialists.map((person) => ({ id: person.id, label: labelFor(person) }))} selected={base.tsIds} onChange={(tsIds) => setBase({ ...base, tsIds })} emptyText="Ingen aktive TS." />
        </div>
        <Input label="Notat" value={base.note} onChange={(v) => setBase({ ...base, note: v })} />
      </form>
      <CardGrid>{data.bases.map((item) => <BaseCard key={item.id} base={item} data={data} selected={item.id === base.id} onClick={() => editBase(item)} />)}</CardGrid>
    </Panel>
  );
}

function BaseCard({ base, data, selected, onClick }: { base: Base; data: HeliqData; selected: boolean; onClick: () => void }) {
  const pilots = data.personnel.filter((person) => person.role === "pilot" && person.homeBaseId === base.id);
  const taskSpecialists = data.personnel.filter((person) => person.role === "ts" && person.homeBaseId === base.id);
  const enoughPilots = pilots.length >= base.minPilots;
  const enoughTs = taskSpecialists.length >= base.minTs;
  return <button type="button" onClick={onClick} className={`rounded-xl border bg-slate-50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 ${selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"}`} style={{ borderLeft: `5px solid ${base.color}` }}><h3 className="font-semibold">{base.code} · {base.name}</h3><p className="mt-1 text-sm text-slate-600">Krav: {base.minPilots} pilot / {base.minTs} TS</p><p className="mt-2 text-xs font-semibold text-slate-500">Tilknyttet: <span className={enoughPilots ? "text-emerald-700" : "text-amber-700"}>{pilots.length} piloter</span> · <span className={enoughTs ? "text-emerald-700" : "text-amber-700"}>{taskSpecialists.length} TS</span></p></button>;
}

function QualificationsPanel({ mutate }: { mutate: (action: string, payload: Record<string, unknown>) => Promise<void> }) {
  const [qualification, setQualification] = useState({ name: "", kind: "pilot" as QualificationKind });
  return <Panel title="Kvalifikasjoner"><form onSubmit={(e) => { e.preventDefault(); mutate("upsertQualification", { qualification }); setQualification({ name: "", kind: "pilot" }); }} className="grid gap-3 md:grid-cols-3"><Input label="Navn" value={qualification.name} onChange={(v) => setQualification({ ...qualification, name: v })} /><Select label="Type" value={qualification.kind} onChange={(v) => setQualification({ ...qualification, kind: v as QualificationKind })} options={["pilot", "ts", "both"]} labels={{ pilot: "Pilot", ts: "TS", both: "Begge" }} /><button className="self-end rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">Lagre</button></form></Panel>;
}

function AuditPanel({ data }: { data: HeliqData }) {
  return <Panel title="Endringslogg"><div className="grid gap-2">{data.auditLogs.map((log) => <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><span className="font-semibold">{new Date(log.at).toLocaleString("no-NO")}</span> · {log.summary}</div>)}</div></Panel>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>; }
function CardGrid({ children }: { children: React.ReactNode }) { return <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>; }
function InfoCard({ title, text, color }: { title: string; text: string; color?: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" style={{ borderLeft: color ? `5px solid ${color}` : undefined }}><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-slate-600">{text}</p></div>; }
function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label className="text-sm font-semibold text-slate-600">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900" /></label>; }
