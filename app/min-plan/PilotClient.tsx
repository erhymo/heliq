"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import HeliqLogo from "@/components/HeliqLogo";
import type { HeliqData, Personnel, ScheduleAssignment } from "@/lib/types";
import { statusLabels } from "@/lib/types";

export default function PilotClient() {
  const [pin, setPin] = useState("");
  const [data, setData] = useState<HeliqData | null>(null);
  const [personId, setPersonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/app-data", { cache: "no-store" });
    if (response.status === 401) { setData(null); setLoading(false); return; }
    const payload = await response.json();
    setData(payload.data);
    setPersonId(payload.session.personId || "");
    setLoading(false);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/pin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Feil PIN"); return; }
    setPin("");
    await load();
  }

  if (loading) return <Shell><p className="rounded-xl bg-white p-5 shadow-sm">Laster Min plan…</p></Shell>;
  if (!data || !personId) return (
    <Shell>
      <form onSubmit={login} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <HeliqLogo />
        <h1 className="mt-6 text-xl font-semibold">Pilot/TS-login</h1>
        <p className="mt-2 text-sm text-slate-600">Logg inn med din 4-sifrede PIN. Demo: piloter 1001–1003, TS 2001–2002.</p>
        <input inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-4 text-center text-2xl tracking-[0.4em]" placeholder="••••" />
        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
        <button className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">Åpne min plan</button>
      </form>
    </Shell>
  );

  return <Plan data={data} personId={personId} />;
}

function Plan({ data, personId }: { data: HeliqData; personId: string }) {
  const person = data.personnel.find((candidate) => candidate.id === personId);
  const assignments = useMemo(() => (data.publishedAssignments || []).filter((assignment) => assignment.personId === personId).sort((a, b) => a.date.localeCompare(b.date)), [data.publishedAssignments, personId]);
  const projects = new Map(data.projects.map((project) => [project.id, project]));
  const bases = new Map(data.bases.map((base) => [base.id, base]));
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <section className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <HeliqLogo />
          <h1 className="mt-5 text-2xl font-semibold">Min plan</h1>
          <p className="mt-1 text-slate-600">{person?.code} · {person?.name} · {person?.role === "ts" ? "Lastemann/TS" : "Pilot"}</p>
        </header>
        {assignments.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">Ingen planlagte dager enda.</p>}
        <div className="grid gap-3">
          {assignments.map((assignment) => <PlanCard key={assignment.id} assignment={assignment} data={data} projects={projects} bases={bases} me={person} />)}
        </div>
      </section>
    </main>
  );
}

function PlanCard({ assignment, data, projects, bases, me }: { assignment: ScheduleAssignment; data: HeliqData; projects: Map<string, { name: string; location: string; color: string }>; bases: Map<string, { name: string; code: string; color: string }>; me?: Personnel }) {
  const project = assignment.projectId ? projects.get(assignment.projectId) : undefined;
  const base = assignment.baseId ? bases.get(assignment.baseId) : undefined;
  const colleagues = (data.publishedAssignments || []).filter((other) => other.date === assignment.date && other.personId !== assignment.personId && (assignment.projectId ? other.projectId === assignment.projectId : other.baseId === assignment.baseId)).map((other) => data.personnel.find((person) => person.id === other.personId)).filter(Boolean) as Personnel[];
  const color = project?.color || base?.color || "#2563eb";
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={{ borderLeft: `6px solid ${color}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{new Date(`${assignment.date}T00:00:00`).toLocaleDateString("no-NO", { weekday: "long", day: "2-digit", month: "long" })}</p><h2 className="mt-1 text-xl font-semibold">{project?.name || base?.name || statusLabels[assignment.status]}</h2><p className="mt-1 text-sm text-slate-600">{project?.location || base?.code || ""}</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{statusLabels[assignment.status]}</span>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Du jobber med</p><p className="mt-1 text-sm text-slate-700">{colleagues.length ? colleagues.map((person) => `${person.code} ${person.name}`).join(", ") : me?.role === "pilot" ? "Ingen TS/kollega lagt inn enda" : "Ingen pilot/kollega lagt inn enda"}</p></div>
    </article>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900">{children}</main>;
}
