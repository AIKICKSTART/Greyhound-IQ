import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/deployment-vercel.md",
  "docs/wiki/Home.md",
  "docs/wiki/Local-Development.md",
  "docs/wiki/Environment-Variables.md",
  "docs/wiki/Supabase-Setup.md",
  "docs/wiki/Vercel-Deployments.md",
  "docs/wiki/GitHub-Workflow.md",
  "docs/wiki/CICD-Gates.md",
  "docs/wiki/Codex-Review-Process.md",
  "docs/wiki/Release-Process.md",
  "docs/wiki/Incident-Secrets-Runbook.md",
];

const requiredReadmeSnippets = [
  "public/images/og-image.png",
  "npm run dev",
  "npm run ci",
  "Vercel",
  "Supabase",
  "Codex",
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Missing required docs file: ${file}`);
}

if (existsSync(join(root, "README.md"))) {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  for (const snippet of requiredReadmeSnippets) {
    if (!readme.includes(snippet)) failures.push(`README.md missing: ${snippet}`);
  }
}

if (existsSync(join(root, ".env.example"))) {
  const envExample = readFileSync(join(root, ".env.example"), "utf8");
  for (const key of ["DATABASE_URL", "SUPABASE_URL", "WORKOS_CLIENT_ID", "INTERNAL_API_SECRET"]) {
    if (!envExample.includes(key)) failures.push(`.env.example missing: ${key}`);
  }
}

if (failures.length) {
  console.error("Docs gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Docs gate passed.");
