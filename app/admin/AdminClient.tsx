"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import HeliqLogo from "@/components/HeliqLogo";
import type { Base, HeliqData, Personnel, Project, QualificationKind, Role, ScheduleAssignment, ScheduleStatus } from "@/lib/types";
import { statusLabels, statusShort } from "@/lib/types";

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

const statuses = Object.keys(statusLabels) as ScheduleStatus[];
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
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ScheduleStatus>("work");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedBaseId, setSelectedBaseId] = useState("");
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
  const activeProject = data.projects.find((project) => project.id === selectedProjectId);
  const activeBase = data.bases.find((base) => base.id === selectedBaseId);
  const warnings = buildWarnings(data).slice(0, 8);

  async function clickCell(person: Personnel, date: string) {
    if (selectedPersonId && selectedPersonId !== person.id) return;
    const projectId = selectedProjectId || undefined;
    const status = projectId ? "project" : selectedStatus === "project" ? "work" : selectedStatus;
    const shouldUseBase = Boolean(selectedBaseId) || status === "work";
    const baseId = projectId ? undefined : selectedBaseId || (shouldUseBase ? person.homeBaseId : undefined);
    await mutate("toggleAssignment", { assignment: { personId: person.id, date, status, projectId, baseId } });
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
            <button onClick={logout} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100">Logg ut</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div><p className="text-sm font-semibold text-slate-500">Lagring</p><p className="font-semibold">{data.storageMode === "firestore" ? "Firebase Firestore" : "Lokal demo-lagring"}</p></div>
          <button onClick={() => mutate("seedDemo", {})} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">Last demo-data på nytt</button>
        </div>
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {tab === "schedule" && <ScheduleToolbar data={data} year={year} setYear={setYear} selectedPersonId={selectedPersonId} setSelectedPersonId={setSelectedPersonId} selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} selectedBaseId={selectedBaseId} setSelectedBaseId={setSelectedBaseId} />}
        {tab === "schedule" && <CoverageSuggestions suggestions={coverageSuggestions} totalHidden={Math.max(0, coverageSuggestions.length - 30)} onApprove={approveCoverageSuggestion} onDismiss={dismissCoverageSuggestion} />}
        {tab === "schedule" && warnings.length > 0 && <Warnings warnings={warnings} />}
        {tab === "schedule" && <ScheduleGrid people={people} days={days} data={data} assignmentsByKey={assignmentsByKey} selectedPersonId={selectedPersonId} onCell={clickCell} activeProject={activeProject} activeBase={activeBase} />}
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

function ScheduleToolbar(props: { data: HeliqData; year: number; setYear: (y: number) => void; selectedPersonId: string; setSelectedPersonId: (v: string) => void; selectedStatus: ScheduleStatus; setSelectedStatus: (v: ScheduleStatus) => void; selectedProjectId: string; setSelectedProjectId: (v: string) => void; selectedBaseId: string; setSelectedBaseId: (v: string) => void }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-6">
      <Select label="År" value={String(props.year)} onChange={(v) => props.setYear(Number(v))} options={[todayYear - 1, todayYear, todayYear + 1].map(String)} />
      <Select label="Ansatt" value={props.selectedPersonId} onChange={props.setSelectedPersonId} options={["", ...props.data.personnel.map((p) => p.id)]} labels={{ "": "Klikk alle", ...Object.fromEntries(props.data.personnel.map((p) => [p.id, `${p.code} ${p.name}`])) }} />
      <Select label="Status" value={props.selectedStatus} onChange={(v) => props.setSelectedStatus(v as ScheduleStatus)} options={statuses} labels={statusLabels} />
      <Select label="Prosjekt" value={props.selectedProjectId} onChange={props.setSelectedProjectId} options={["", ...props.data.projects.map((p) => p.id)]} labels={{ "": "Ingen prosjekt", ...Object.fromEntries(props.data.projects.map((p) => [p.id, p.name])) }} />
      <Select label="Base" value={props.selectedBaseId} onChange={props.setSelectedBaseId} options={["", ...props.data.bases.map((b) => b.id)]} labels={{ "": "Personens base", ...Object.fromEntries(props.data.bases.map((b) => [b.id, b.name])) }} />
      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Klikk en dag for jobb på personens base. Velg prosjekt for å overstyre med prosjektkode.</div>
    </section>
  );
}

function Select({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <label className="text-sm font-semibold text-slate-600">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900">{options.map((option) => <option key={option} value={option}>{labels[option] || option}</option>)}</select></label>;
}

function ScheduleGrid({ people, days, data, assignmentsByKey, selectedPersonId, onCell }: { people: Personnel[]; days: string[]; data: HeliqData; assignmentsByKey: Map<string, ScheduleAssignment>; selectedPersonId: string; onCell: (p: Personnel, d: string) => void; activeProject?: Project; activeBase?: Base }) {
  const projectById = new Map(data.projects.map((project) => [project.id, project]));
  const baseById = new Map(data.bases.map((base) => [base.id, base]));
  return (
    <section className="heliq-grid max-h-[82vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-w-max" style={{ gridTemplateColumns: `7rem repeat(${people.length}, 4.25rem)` }}>
        <div className="sticky left-0 top-0 z-20 border-b border-r border-slate-200 bg-slate-100 p-2 text-[11px] font-bold uppercase text-slate-500">Dato</div>
        {people.map((person) => <div key={person.id} className={`sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-100 p-1 text-center ${selectedPersonId && selectedPersonId !== person.id ? "opacity-40" : ""}`}><p className="text-sm font-bold">{personCode(person)}</p><p className="text-[9px] text-slate-500">{person.role === "ts" ? "TS" : "Pilot"}</p></div>)}
        {days.map((day) => <Row key={day} day={day} people={people} assignmentsByKey={assignmentsByKey} projectById={projectById} baseById={baseById} selectedPersonId={selectedPersonId} onCell={onCell} />)}
      </div>
    </section>
  );
}

function Row({ day, people, assignmentsByKey, projectById, baseById, selectedPersonId, onCell }: { day: string; people: Personnel[]; assignmentsByKey: Map<string, ScheduleAssignment>; projectById: Map<string, Project>; baseById: Map<string, Base>; selectedPersonId: string; onCell: (p: Personnel, d: string) => void }) {
  const weekend = [0, 6].includes(new Date(`${day}T00:00:00`).getDay());
  return <>{<div className={`sticky left-0 z-10 border-b border-r border-slate-200 p-2 text-xs font-semibold ${weekend ? "bg-slate-100" : "bg-white"}`}>{prettyDate(day)}</div>}{people.map((person) => {
    const assignment = assignmentsByKey.get(`${person.id}_${day}`);
    const project = assignment?.projectId ? projectById.get(assignment.projectId) : undefined;
    const base = assignment?.baseId ? baseById.get(assignment.baseId) : undefined;
    const color = project ? PROJECT_COLOR : base?.color;
    const cellCode = project ? shortCodeFromText(project.name) : base?.code || (assignment ? statusShort[assignment.status].slice(0, 3) : "");
    return <button key={`${person.id}_${day}`} onClick={() => onCell(person, day)} className={`h-8 border-b border-r border-slate-200 p-0.5 text-center text-[10px] font-black transition hover:ring-2 hover:ring-blue-400 ${selectedPersonId && selectedPersonId !== person.id ? "opacity-40" : ""}`} style={{ background: color ? `${color}24` : weekend ? "#f8fafc" : "#fff", color: color || "#334155" }}>{cellCode}</button>;
  })}</>;
}

function buildCoverageSuggestions(data: HeliqData, days: string[], dismissed: Set<string>): CoverageProposal[] {
  const today = new Date().toISOString().slice(0, 10);
  const activePeople = data.personnel.filter((person) => person.active && (person.role === "pilot" || person.role === "ts"));
  const assignmentsByPersonDate = new Map(data.assignments.map((assignment) => [`${assignment.personId}_${assignment.date}`, assignment]));
  const yearDays = new Set(days);
  const year = days[0]?.slice(0, 4) || String(todayYear);
  const firstBlockStart = mondayOnOrBefore(`${year}-01-01`);
  const lastDay = days.at(-1) || `${year}-12-31`;
  const futureStart = today > `${year}-01-01` ? today : `${year}-01-01`;

  function qualifiedForBase(person: Personnel, base: Base) {
    return base.requiredQualificationIds.every((id) => person.qualificationIds.includes(id));
  }

  function personHasConflict(personId: string, blockDays: string[]) {
    return blockDays.some((date) => assignmentsByPersonDate.has(`${personId}_${date}`));
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
    const sorted = [...homeBase, ...borrowed].filter((person) => !personHasConflict(person.id, blockDays));
    const homeBaseCount = homeBase.length;
    const neededForRotation = Math.max(required * 2, required);
    const rotated = sorted.slice().sort((a, b) => personCode(a).localeCompare(personCode(b)));
    const start = required === 0 ? 0 : (crewIndex * required) % Math.max(rotated.length, 1);
    const ordered = [...rotated.slice(start), ...rotated.slice(0, start)];
    return {
      selected: ordered.slice(0, required),
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
  const visible = suggestions.slice(0, 30);
  if (suggestions.length === 0) {
    return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><span className="font-semibold">Dekningsforslag:</span> Alle baser ser dekket ut for valgt år med dagens regler.</section>;
  }
  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-blue-950">Forslag til full basedekning</h2>
          <p className="mt-1 text-sm text-blue-800">Systemet foreslår 14/14-turnusblokker med bytte mandag og avgang søndag. Admin må godkjenne eller avvise.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-900">{suggestions.length} forslag</span>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        {visible.map((suggestion) => (
          <article key={suggestion.id} className="rounded-xl border border-blue-100 bg-white p-3 text-sm shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-bold text-slate-950">{suggestion.baseCode} · {suggestion.crewLabel}</p><p className="text-slate-600">{prettyDate(suggestion.startDate)} – {prettyDate(suggestion.endDate)}</p></div>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">{suggestion.assignments.length} dager</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p><span className="font-semibold text-slate-800">Hull:</span> {suggestion.missingPilots} pilotdager / {suggestion.missingTs} TS-dager</p>
              {suggestion.pilotNames.length > 0 && <p><span className="font-semibold text-slate-800">Piloter:</span> {suggestion.pilotNames.join(", ")}</p>}
              {suggestion.tsNames.length > 0 && <p><span className="font-semibold text-slate-800">TS:</span> {suggestion.tsNames.join(", ")}</p>}
              {suggestion.warnings.map((warning) => <p key={warning} className="rounded-lg bg-amber-50 p-2 text-amber-800">{warning}</p>)}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onApprove(suggestion)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">OK, legg inn</button>
              <button onClick={() => onDismiss(suggestion.id)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Avvis</button>
            </div>
          </article>
        ))}
      </div>
      {totalHidden > 0 && <p className="mt-3 text-xs text-blue-800">Viser de første 30 forslagene. {totalHidden} flere kommer frem etter hvert som du godkjenner eller avviser.</p>}
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
