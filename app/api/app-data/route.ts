import { NextResponse } from "next/server";
import { getAdminSession, getPersonSession } from "@/lib/security";
import { getHeliqData, publicData } from "@/lib/store";

function dataLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Ukjent feil");
  if (message.toLowerCase().includes("resource_exhausted") || message.toLowerCase().includes("quota") || message.startsWith("8 ")) {
    return "Firestore-kvoten er brukt opp akkurat nå. Prøv igjen senere, eller øk Firebase-kvoten.";
  }
  return "Kunne ikke laste Heliq-data akkurat nå.";
}

export async function GET() {
  const admin = await getAdminSession();
  const person = await getPersonSession();
  if (!admin && !person) return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  try {
    const data = publicData(await getHeliqData());
    if (admin) return NextResponse.json({ data, session: { role: "admin" } });
    return NextResponse.json({ data, session: { role: "person", personId: person?.sub } });
  } catch (error) {
    return NextResponse.json({ error: dataLoadError(error) }, { status: 503 });
  }
}
