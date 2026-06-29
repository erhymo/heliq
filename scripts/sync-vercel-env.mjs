import fs from "fs";
import { spawnSync } from "child_process";

const logFile = "sync-vercel-env.local.log";
fs.writeFileSync(logFile, "", { mode: 0o600 });

function log(message) {
  fs.appendFileSync(logFile, message + "\n");
  console.log(message);
}

const serviceFile = fs.readdirSync(process.cwd()).find((name) => name.includes("firebase-adminsdk") && name.endsWith(".json"));

if (!serviceFile) {
  console.error("service_account_file=missing");
  process.exit(1);
}

const service = JSON.parse(fs.readFileSync(serviceFile, "utf8"));
const values = {
  FIREBASE_PROJECT_ID: service.project_id,
  FIREBASE_CLIENT_EMAIL: service.client_email,
  FIREBASE_PRIVATE_KEY: service.private_key,
};

for (const [key, value] of Object.entries(values)) {
  if (!value || /replace|example/i.test(String(value))) {
    console.error(key + "=missing");
    process.exit(1);
  }
}

function setLocalEnv() {
  const file = ".env.local";
  let env = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const safeValue = String(value).replace(/\r?\n/g, "\\n");
    const line = key + "=" + JSON.stringify(safeValue);
    const re = new RegExp("^" + key + "=.*$", "m");
    env = re.test(env) ? env.replace(re, line) : env + (env.endsWith("\n") || env === "" ? "" : "\n") + line + "\n";
  }
  fs.writeFileSync(file, env, { mode: 0o600 });
  log("local_env=ok");
}

function vercel(args, input) {
  return spawnSync("vercel", args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function safeText(text) {
  return String(text || "")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "[redacted-email]")
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[redacted-private-key]");
}

function syncVercelEnv() {
  for (const [key, value] of Object.entries(values)) {
    for (const target of ["development", "preview", "production"]) {
      const args = target === "development"
        ? ["env", "add", key, target, "--force", "--yes"]
        : target === "preview"
          ? ["env", "add", key, target, "", "--sensitive", "--force", "--yes"]
          : ["env", "add", key, target, "--sensitive", "--force", "--yes"];
      const result = vercel(args, String(value) + "\n");
      if (result.status !== 0) {
        console.error(key + "_" + target + "=failed");
        console.error(safeText(result.stderr || result.stdout).slice(0, 500));
        process.exit(result.status || 1);
      }
      log(key + "_" + target + "=ok");
    }
  }
}

setLocalEnv();
syncVercelEnv();
console.log("sync_vercel_env=ok");
log("sync_vercel_env=ok");
