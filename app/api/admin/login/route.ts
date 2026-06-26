import { NextResponse } from "next/server";
import { sessionCookieName, signSession, verifyAdminPassword } from "@/lib/security";

export async function POST(request: Request) {
  const { password } = await request.json();
  if (!verifyAdminPassword(String(password || ""))) return NextResponse.json({ error: "Feil passord" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName("admin"), signSession({ sub: "admin", role: "admin" }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
}
