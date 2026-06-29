import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const environments = ["development", "preview", "production"];
const required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];

for (const environment of environments) {
  const file = path.join(os.tmpdir(), `heliq-vercel-${environment}-${process.pid}.env`);
  const result = spawnSync("vercel", ["env", "pull", file, "--environment", environment, "--yes"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0 || !fs.existsSync(file)) {
    console.log(`${environment}=pull_failed`);
    process.exitCode = 1;
    continue;
  }

  const text = fs.readFileSync(file, "utf8");
  fs.rmSync(file, { force: true });

  for (const key of required) {
    const present = new RegExp(`^${key}=`, "m").test(text);
    console.log(`${key}_${environment}=${present ? "present" : "missing"}`);
    if (!present) process.exitCode = 1;
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("vercel_pulled_env_required=ok");
