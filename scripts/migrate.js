#!/usr/bin/env node
/**
 * Neon-compatible migration runner.
 * Prisma's migrate deploy uses pg_advisory_lock which times out on Neon's pooler.
 * This script applies pending migrations directly via SQL and records them in _prisma_migrations.
 */
const { Client } = require("pg")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

const MIGRATIONS_DIR = path.join(__dirname, "../prisma/migrations")
const DB_URL = (process.env.DIRECT_URL || process.env.DATABASE_URL || "")
  .replace("sslmode=require", "sslmode=verify-full")
  .replace("channel_binding=require", "channel_binding=require")

async function run() {
  if (!DB_URL) {
    console.error("No DATABASE_URL or DIRECT_URL set")
    process.exit(1)
  }

  const client = new Client({ connectionString: DB_URL })
  await client.connect()

  // Ensure migrations table exists (Prisma creates it; safe to no-op if already there)
  await client.query(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id VARCHAR(36) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT,
      rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Get already-applied migrations
  const { rows: applied } = await client.query(
    `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
  )
  const appliedSet = new Set(applied.map((r) => r.migration_name))

  // Read migration folders sorted
  const folders = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory())
    .sort()

  let count = 0
  for (const folder of folders) {
    if (appliedSet.has(folder)) continue

    const sqlFile = path.join(MIGRATIONS_DIR, folder, "migration.sql")
    if (!fs.existsSync(sqlFile)) continue

    const sql = fs.readFileSync(sqlFile, "utf8")
    const checksum = crypto.createHash("sha256").update(sql).digest("hex")

    console.log(`Applying migration: ${folder}`)
    try {
      await client.query(sql)
      await client.query(
        `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid(), $1, NOW(), $2, NULL, NULL, NOW(), 1)`,
        [checksum, folder]
      )
      console.log(`  ✓ Applied`)
      count++
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`)
      await client.end()
      process.exit(1)
    }
  }

  await client.end()
  console.log(count === 0 ? "All migrations already applied." : `${count} migration(s) applied.`)
}

run().catch((e) => { console.error(e); process.exit(1) })
