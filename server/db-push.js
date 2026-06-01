import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool, hasDb } from './db.js'

// Apply supabase/schema.sql to the database in DATABASE_URL.
const here = dirname(fileURLToPath(import.meta.url))

async function run() {
  if (!hasDb) {
    console.error('✗ 未配置 DATABASE_URL（在 .env 设置）')
    process.exit(1)
  }
  const sql = readFileSync(join(here, '..', 'supabase', 'schema.sql'), 'utf8')
  await pool.query(sql)
  console.log('✓ schema applied (repos / snapshots / rankings)')
  await pool.end()
}

run().catch(async (e) => {
  console.error('✗ db:push failed:', e.message || e)
  await pool?.end()
  process.exit(1)
})
