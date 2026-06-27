import { NextResponse } from "next/server";
import { sessionCookieName, signSession, verifyAdminPassword } from "@/lib/security";

type FirebasePasswordResponse = {
  email: string;
  localId: string;
};

function firebaseWebApiKey() {
  return process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
}

function allowedAdminEmails() {
  return (process.env.HELIQ_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

async function verifyFirebasePassword(email: string, password: string) {
  const apiKey = firebaseWebApiKey();
  if (!apiKey) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!response.ok) return null;
  const user = await response.json() as FirebasePasswordResponse;
  const allowed = allowedAdminEmails();
  if (allowed.length > 0 && !allowed.includes(user.email.toLowerCase())) return null;
  return user;
}

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const passwordText = String(password || "");
  const emailText = String(email || "").trim().toLowerCase();
  const firebaseUser = await verifyFirebasePassword(emailText, passwordText);
  if (firebaseWebApiKey()) {
    if (!firebaseUser) return NextResponse.json({ error: "Feil e-post eller passord" }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName("admin"), signSession({ sub: firebaseUser.localId, role: "admin" }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    return response;
  }

  if (!verifyAdminPassword(passwordText)) return NextResponse.json({ error: "Feil passord" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName("admin"), signSession({ sub: "admin", role: "admin" }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
}
