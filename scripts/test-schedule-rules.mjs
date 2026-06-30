import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import ts from "typescript";

const source = fs.readFileSync("lib/scheduleRules.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const mod = new Module("scheduleRules.test");
mod.filename = path.resolve("lib/scheduleRules.ts");
mod.paths = Module._nodeModulePaths(process.cwd());
mod._compile(output, mod.filename);
const rules = mod.exports;

function person(id, qualificationIds = ["q1"]) {
  return { id, name: `Person ${id}`, code: id.toUpperCase(), role: "pilot", active: true, homeBaseId: "b1", qualificationIds, vehicleIds: [], trailerIds: [] };
}
function assignment(personId, date, status = "work") {
  return { id: `${personId}_${date}`, personId, date, status, baseId: "b1" };
}
function data(assignments = []) {
  return {
    personnel: [person("p1"), person("p2", [])],
    bases: [{ id: "b1", name: "Base", code: "BAS", color: "#000", minPilots: 1, minTs: 0, requiredQualificationIds: ["q1"] }],
    projects: [], qualifications: [], vehicles: [], trailers: [], assignments, publishedAssignments: [], auditLogs: [], storageMode: "local",
  };
}
function dates(start, count) {
  const result = [];
  for (let date = start, i = 0; i < count; i += 1, date = rules.addDays(date, 1)) result.push(date);
  return result;
}

assert.equal(rules.validateScheduleAssignments(data(), dates("2026-01-05", 14).map((date) => assignment("p1", date))).length, 0, "14 duty days should be valid");
assert.match(rules.validateScheduleAssignments(data(), dates("2026-01-05", 15).map((date) => assignment("p1", date))).join("\n"), /mer enn 14/, "15 consecutive duty days should fail");
assert.match(rules.validateScheduleAssignments(data(dates("2026-01-05", 183).map((date) => assignment("p1", date))), [assignment("p1", "2026-12-31")]).join("\n"), /overstiger årsverk/, "duty above annual limit should fail");
assert.equal(rules.validateScheduleAssignments(data(dates("2026-01-05", 183).map((date) => assignment("p1", date))), [{ personId: "p1", date: "2026-12-31", status: "sold_day" }]).length, 0, "sold day should not count as duty");
assert.match(rules.validateScheduleAssignments(data(), [assignment("p2", "2026-02-02")]).join("\n"), /mangler kvalifikasjon/, "missing base qualification should fail");
assert.equal(rules.validateScheduleAssignments(data([{ id: "p1_2026-03-01", personId: "p1", date: "2026-03-01", status: "vacation" }]), [assignment("p1", "2026-03-01")]).length, 0, "same-day overwrite should be allowed");
assert.equal(rules.expandedQualificationIds(person("p3", ["q_heslo4"])).has("q_heslo3"), true, "HESLO 4 should include HESLO 3");
assert.equal(rules.expandedQualificationIds(person("p3", ["q_heslo4"])).has("q_heslo2"), true, "HESLO 4 should include HESLO 2");
assert.equal(rules.expandedQualificationIds(person("p4", ["q_heslo3"])).has("q_heslo2"), true, "HESLO 3 should include HESLO 2");

console.log("schedule_rules_tests=ok");
