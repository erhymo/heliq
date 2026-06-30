import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/security";
import { applyCoverageAssignments, pushSchedule, removeScheduleAssignments, seedDemo, setScheduleAssignments, toggleAssignment, upsertBase, upsertBaseWithMembership, upsertPersonnel, upsertProject, upsertQualification } from "@/lib/store";

function mutationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ukjent feil";
  if (message.toLowerCase().includes("resource_exhausted") || message.toLowerCase().includes("quota") || message.startsWith("8 ")) {
    return { message: "Firestore-kvoten er brukt opp akkurat nå. Prøv igjen senere, eller øk Firebase-kvoten.", status: 503 };
  }
  return { message, status: 400 };
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Ikke admin" }, { status: 401 });
  try {
    const body = await request.json();
    const actor = session.sub;
    if (body.action === "seedDemo") return NextResponse.json({ data: await seedDemo(actor) });
    if (body.action === "pushSchedule") return NextResponse.json({ data: await pushSchedule(actor) });
    if (body.action === "upsertPersonnel") return NextResponse.json({ data: await upsertPersonnel(body.personnel, actor) });
    if (body.action === "upsertBase") return NextResponse.json({ data: await upsertBase(body.base, actor) });
    if (body.action === "upsertBaseWithMembership") return NextResponse.json({ data: await upsertBaseWithMembership(body.base, actor) });
    if (body.action === "upsertProject") return NextResponse.json({ data: await upsertProject(body.project, actor) });
    if (body.action === "upsertQualification") return NextResponse.json({ data: await upsertQualification(body.qualification, actor) });
    if (body.action === "toggleAssignment") return NextResponse.json({ data: await toggleAssignment(body.assignment, actor) });
    if (body.action === "setScheduleAssignments") return NextResponse.json({ data: await setScheduleAssignments(body, actor) });
    if (body.action === "removeScheduleAssignments") return NextResponse.json({ data: await removeScheduleAssignments(body, actor) });
    if (body.action === "applyCoverageAssignments") return NextResponse.json({ data: await applyCoverageAssignments(body, actor) });
    return NextResponse.json({ error: "Ukjent handling" }, { status: 400 });
  } catch (error) {
    const mapped = mutationError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
