export default function HeliqLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
        <span className="text-lg font-black tracking-tight">H</span>
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-blue-500 ring-4 ring-white" />
      </div>
      {!compact && (
        <div>
          <p className="text-2xl font-bold leading-6 tracking-tight text-slate-950">Heliq</p>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-600">Crew schedule</p>
        </div>
      )}
    </div>
  );
}
