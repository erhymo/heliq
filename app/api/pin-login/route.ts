import { NextResponse } from "next/server";
import { getHeliqData } from "@/lib/store";
import { hashPin, sessionCookieName, signSession } from "@/lib/security";

export async function POST(request: Request) {
  const { pin } = await request.json();
  const pinText = String(pin || "");
  if (!/^[0-9]{4}$/.test(pinText)) return NextResponse.json({ error: "PIN må være 4 siffer" }, { status: 400 });
  const data = await getHeliqData();
  const person = data.personnel.find((candidate) => candidate.active && candidate.pinHash === hashPin(pinText));
  if (!person) return NextResponse.json({ error: "Ukjent PIN" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName("person"), signSession({ sub: person.id, role: "person" }, 24 * 14), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
}
