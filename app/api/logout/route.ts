import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/security";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName("admin"));
  response.cookies.delete(sessionCookieName("person"));
  return response;
}
