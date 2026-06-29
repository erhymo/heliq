const statuses = ["work", "sold_day", "vacation", "sick", "training", "standby", "travel", "off", "project"];

function scheduleAssignment(input, updatedAt = new Date().toISOString()) {
  const item = { id: `${input.personId}_${input.date}`, personId: input.personId, date: input.date, status: input.status, updatedAt };
  if (input.baseId) item.baseId = input.baseId;
  if (input.projectId) item.projectId = input.projectId;
  if (input.note) item.note = input.note;
  return item;
}

function hasUndefined(value) {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasUndefined);
}

for (const status of statuses) {
  const assignment = scheduleAssignment({
    personId: "person_test",
    date: "2026-06-01",
    status,
    baseId: status === "work" ? "base_test" : undefined,
    projectId: status === "project" ? "project_test" : undefined,
    note: undefined,
  }, "2026-01-01T00:00:00.000Z");
  const ok = !hasUndefined(assignment);
  console.log(`${status}=${ok ? "ok" : "undefined_found"}`);
  if (!ok) process.exitCode = 1;
}

if (process.exitCode) process.exit(process.exitCode);
console.log("schedule_assignment_sanitizer=ok");
