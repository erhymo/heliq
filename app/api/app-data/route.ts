import { NextResponse } from "next/server";
import { getAdminSession, getPersonSession } from "@/lib/security";
import { getHeliqData, publicData } from "@/lib/store";

export async function GET() {
  const admin = await getAdminSession();
  const person = await getPersonSession();
  if (!admin && !person) return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  const data = publicData(await getHeliqData());
  if (admin) return NextResponse.json({ data, session: { role: "admin" } });
  return NextResponse.json({ data, session: { role: "person", personId: person?.sub } });
}
