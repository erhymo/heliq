import { NextResponse } from "next/server";
import { LEGACY_ADMIN_COOKIES, sessionCookieName } from "@/lib/security";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName("admin"));
  for (const cookieName of LEGACY_ADMIN_COOKIES) response.cookies.delete(cookieName);
  response.cookies.delete(sessionCookieName("person"));
  return response;
}
