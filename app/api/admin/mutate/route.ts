import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/security";
import { seedDemo, toggleAssignment, upsertBase, upsertBaseWithMembership, upsertPersonnel, upsertProject, upsertQualification } from "@/lib/store";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Ikke admin" }, { status: 401 });
  try {
    const body = await request.json();
    const actor = session.sub;
    if (body.action === "seedDemo") return NextResponse.json({ data: await seedDemo(actor) });
    if (body.action === "upsertPersonnel") return NextResponse.json({ data: await upsertPersonnel(body.personnel, actor) });
    if (body.action === "upsertBase") return NextResponse.json({ data: await upsertBase(body.base, actor) });
    if (body.action === "upsertBaseWithMembership") return NextResponse.json({ data: await upsertBaseWithMembership(body.base, actor) });
    if (body.action === "upsertProject") return NextResponse.json({ data: await upsertProject(body.project, actor) });
    if (body.action === "upsertQualification") return NextResponse.json({ data: await upsertQualification(body.qualification, actor) });
    if (body.action === "toggleAssignment") return NextResponse.json({ data: await toggleAssignment(body.assignment, actor) });
    return NextResponse.json({ error: "Ukjent handling" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukjent feil" }, { status: 400 });
  }
}
