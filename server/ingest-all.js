import { ingestTrending } from './ingest.js'
import { pool, hasDb } from './db.js'

// Ingest all three periods (all-languages) as today's snapshot.
// Run manually now via `npm run ingest`; wire to CF cron later.
const PERIODS = ['daily', 'weekly', 'monthly']

async function run() {
  if (!hasDb) {
    console.error('✗ 未配置 DATABASE_URL（在 .env 设置）')
    process.exit(1)
  }
  for (const since of PERIODS) {
    const repos = await ingestTrending(since, '')
    console.log(`✓ ${since.padEnd(7)} ${repos.length} repos`)
  }
  console.log('done.')
  await pool.end()
}

run().catch(async (e) => {
  console.error('✗ ingest failed:', e.message || e)
  await pool?.end()
  process.exit(1)
})
