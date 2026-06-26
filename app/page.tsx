import Link from "next/link";
import HeliqLogo from "@/components/HeliqLogo";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="space-y-5">
          <HeliqLogo />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Schedule for helikopteroperasjoner</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Lys og enkel planlegger for piloter, lastemann/TS, baser og prosjekter.</p>
          </div>
        </header>
        <div className="mt-6 grid gap-3">
          <Link href="/min-plan" className="rounded-xl bg-blue-600 px-4 py-4 text-center font-semibold text-white shadow-sm hover:bg-blue-700">Pilot/TS: Min plan</Link>
          <Link href="/admin" className="rounded-xl border border-slate-300 bg-white px-4 py-4 text-center font-semibold text-slate-900 hover:bg-slate-50">Admin planlegger</Link>
        </div>
        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">MVP bruker Firestore når Firebase-miljøvariabler er satt. Uten Firebase kjører den trygt på lokal demo-lagring.</p>
      </section>
    </main>
  );
}
