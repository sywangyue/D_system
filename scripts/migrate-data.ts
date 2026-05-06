/**
 * MWLAB-2026 · SQLite → Supabase PostgreSQL data migration
 *
 * Usage:
 *   npx tsx scripts/migrate-data.ts            # full migration
 *   npx tsx scripts/migrate-data.ts --dry-run   # count only, no inserts
 *
 * Prerequisites:
 *   - mwlab.db (SQLite) in project root
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Order: exhibition_brand → exhibition_edition → data_provenance
 *        → manual_tag_history → crawl_log
 * Idempotent: uses upsert on primary key — safe to re-run.
 */

import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";

// ─── CLI args ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

// ─── Env validation ───────────────────────────────────────────────────

function loadEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "ERROR: Missing env vars. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
        'Run with: npx tsx --env-file=.env.local scripts/migrate-data.ts',
    );
    process.exit(1);
  }
  return { url, key };
}

// ─── Date helpers ──────────────────────────────────────────────────────

/** Convert SQLite datetime string to ISO 8601 for PostgreSQL TIMESTAMPTZ.
 *  "2024-03-15 10:30:00" → "2024-03-15T10:30:00Z"
 *  "2024-03-15"          → "2024-03-15T00:00:00Z"
 *  "" / null             → null */
function toTimestamptz(val: string | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const iso = trimmed.replace(" ", "T");
  return iso.includes("T") ? iso + "Z" : iso + "T00:00:00Z";
}

/** Convert SQLite date string to PostgreSQL DATE.
 *  "2024-03-15 10:30:00" → "2024-03-15"
 *  "2024-03-15"          → "2024-03-15"
 *  "" / null             → null */
function toDate(val: string | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return trimmed.split(" ")[0]; // extract date part before any time
}

// ─── Row transformers (SQLite row → PostgreSQL-compatible object) ──────

function transformBrand(row: Record<string, unknown>) {
  return {
    ...row,
    created_at: toTimestamptz(row.created_at as string),
    updated_at: toTimestamptz(row.updated_at as string),
  };
}

function transformEdition(row: Record<string, unknown>) {
  return {
    ...row,
    date_start: toDate(row.date_start as string),
    date_end: toDate(row.date_end as string),
    recorded_at: toTimestamptz(row.recorded_at as string),
  };
}

function transformProvenance(row: Record<string, unknown>) {
  return {
    ...row,
    crawled_at: toTimestamptz(row.crawled_at as string),
  };
}

function transformCrawlLog(row: Record<string, unknown>) {
  return {
    ...row,
    started_at: toTimestamptz(row.started_at as string),
    finished_at: toTimestamptz(row.finished_at as string),
    created_at: toTimestamptz(row.created_at as string),
  };
}

function transformTagHistory(row: Record<string, unknown>) {
  return {
    ...row,
    changed_at: toTimestamptz(row.changed_at as string),
  };
}

// ─── Table definitions ────────────────────────────────────────────────

interface TableSpec {
  name: string; // PostgreSQL table name
  pkColumn: string; // primary key column for upsert onConflict
  transform: (row: Record<string, unknown>) => Record<string, unknown>;
}

const tables: TableSpec[] = [
  { name: "exhibition_brand", pkColumn: "brand_id", transform: transformBrand },
  { name: "exhibition_edition", pkColumn: "edition_id", transform: transformEdition },
  { name: "data_provenance", pkColumn: "record_id", transform: transformProvenance },
  { name: "manual_tag_history", pkColumn: "id", transform: transformTagHistory },
  { name: "crawl_log", pkColumn: "id", transform: transformCrawlLog },
];

const BATCH_SIZE = 200;

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const { url, key } = loadEnv();
  const supabase = createClient(url, key);
  const sqlite = new Database("mwlab.db", { readonly: true });

  const mode = dryRun ? "DRY RUN (no inserts)" : "LIVE MIGRATION";
  console.log(`\n=== MWLAB-2026 Data Migration: ${mode} ===\n`);
  console.log(`Target: ${url}`);
  console.log(`Source: mwlab.db (SQLite)\n`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const table of tables) {
    // Read SQLite rows
    const sqliteRows = sqlite.prepare(`SELECT * FROM ${table.name}`).all() as Record<string, unknown>[];
    const total = sqliteRows.length;
    console.log(`\n── ${table.name}: ${total} rows ──`);

    if (total === 0) {
      console.log(`  (empty table, skipping)`);
      continue;
    }

    if (dryRun) {
      // In dry-run mode, also check PostgreSQL count for comparison
      const { count: pgCount, error: countErr } = await supabase
        .from(table.name)
        .select("*", { count: "exact", head: true });

      if (countErr) {
        console.log(`  PostgreSQL count: ERROR (${countErr.message})`);
        console.log(`  Would insert: ${total} rows`);
      } else {
        const existing = pgCount ?? 0;
        const new_ = Math.max(0, total - existing);
        console.log(`  PostgreSQL: ${existing} existing, ${new_} new to insert`);
      }
      continue;
    }

    // Transform rows
    const transformed = sqliteRows.map(table.transform);

    // Upsert in batches
    let inserted = 0;
    for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
      const batch = transformed.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from(table.name)
        .upsert(batch, { onConflict: table.pkColumn });

      if (error) {
        console.error(`  ERROR at batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        errors.push(`${table.name}: ${error.message}`);
        break;
      }

      inserted += batch.length;
      const pct = Math.round((inserted / total) * 100);
      process.stdout.write(`  migrated ${inserted} / ${total} (${pct}%)\r`);
    }

    if (inserted === total) {
      console.log(`  migrated ${inserted} / ${total} (100%) ✓`);
      totalMigrated += inserted;
    } else if (inserted > 0) {
      console.log(`  migrated ${inserted} / ${total} (partial — errors above)`);
      totalMigrated += inserted;
    } else {
      console.log(`  FAILED — see error above`);
    }

    // Verify PostgreSQL count
    const { count: verifyCount, error: verifyErr } = await supabase
      .from(table.name)
      .select("*", { count: "exact", head: true });

    if (verifyErr) {
      console.log(`  verify: ERROR (${verifyErr.message})`);
    } else {
      const match = verifyCount === total ? "✓" : `MISMATCH (SQLite: ${total}, PG: ${verifyCount})`;
      console.log(`  verify: PostgreSQL has ${verifyCount} rows ${match}`);
      if (verifyCount !== total) {
        totalSkipped += Math.abs(total - (verifyCount ?? 0));
      }
    }
  }

  // Summary
  console.log(`\n=== Migration Summary ===`);
  console.log(`  Rows migrated: ${totalMigrated}`);
  if (totalSkipped > 0) console.log(`  Rows skipped/mismatched: ${totalSkipped}`);
  if (errors.length > 0) {
    console.log(`  Errors:`);
    errors.forEach((e) => console.log(`    - ${e}`));
  }
  if (dryRun) {
    console.log(`  Mode: DRY RUN — no data was written`);
  }
  console.log();

  sqlite.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
