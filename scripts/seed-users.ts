/**
 * Seed 30 users into Supabase Auth:
 *   2 admin, 8 manager, 20 readonly
 *
 * Usage: npm run seed-users
 * Requires: SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 *
 * Credentials are printed to stdout — save them somewhere secure.
 * This script is idempotent: re-running skips existing users.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local (tsx --env-file handles this at runtime, but parse manually as fallback) ──
function loadEnvLocal(): void {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local not found — rely on process.env (e.g. CI vars or tsx --env-file)
  }
}

loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !KEY) {
  console.error(
    "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SeedUser {
  email: string;
  password: string;
  role: "admin" | "manager" | "readonly";
}

const PASSWORD = "mwlab2026!";

function buildUserList(): SeedUser[] {
  const users: SeedUser[] = [];

  // 2 admin
  for (let i = 0; i < 2; i++) {
    users.push({
      email: `user${String(i).padStart(2, "0")}@mwlab.internal`,
      password: PASSWORD,
      role: "admin",
    });
  }

  // 8 manager
  for (let i = 2; i < 10; i++) {
    users.push({
      email: `user${String(i).padStart(2, "0")}@mwlab.internal`,
      password: PASSWORD,
      role: "manager",
    });
  }

  // 20 readonly
  for (let i = 10; i < 30; i++) {
    users.push({
      email: `user${String(i).padStart(2, "0")}@mwlab.internal`,
      password: PASSWORD,
      role: "readonly",
    });
  }

  return users;
}

async function main(): Promise<void> {
  const users = buildUserList();
  const credentials: { email: string; password: string; role: string }[] = [];

  console.log(`Seeding ${users.length} users...\n`);

  for (const u of users) {
    // Check if user already exists (idempotency)
    const { data: existing } = await supabase.auth.admin.listUsers();
    const alreadyExists = existing?.users?.some(
      (eu) => eu.email === u.email,
    );

    if (alreadyExists) {
      console.log(`  SKIP ${u.email} — already exists`);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      app_metadata: { role: u.role },
    });

    if (error) {
      console.error(`  FAIL ${u.email}: ${error.message}`);
      continue;
    }

    console.log(`  OK   ${u.email} (${u.role})`);
    credentials.push({ email: u.email, password: u.password, role: u.role });
  }

  // ── Summary ──
  console.log("\n─── Seed complete ───");
  console.log(
    `Created: ${credentials.length} | Skipped: ${users.length - credentials.length}`,
  );

  // Print admin credentials separately
  const admins = credentials.filter((c) => c.role === "admin");
  if (admins.length > 0) {
    console.log("\nAdmin logins:");
    for (const a of admins) {
      console.log(`  ${a.email} / ${a.password}`);
    }
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
