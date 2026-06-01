import { ingestTrending } from './ingest.js'
import { pool, hasDb } from './db.js'

// Ingest every period × language combo as today's snapshot.
// Run via `npm run ingest`; scheduled by GitHub Actions (.github/workflows/ingest.yml).
const PERIODS = ['daily', 'weekly', 'monthly']
const LANGUAGES = ['', 'javascript', 'typescript', 'python', 'go', 'rust', 'java', 'c++']

async function run() {
  if (!hasDb) {
    console.error('✗ 未配置 DATABASE_URL（在 .env 设置）')
    process.exit(1)
  }
  for (const since of PERIODS) {
    for (const lang of LANGUAGES) {
      try {
        const repos = await ingestTrending(since, lang)
        console.log(`✓ ${since.padEnd(7)} ${(lang || 'all').padEnd(10)} ${repos.length} repos`)
      } catch (e) {
        console.warn(`! ${since} ${lang || 'all'} skipped: ${e.message || e}`)
      }
    }
  }
  console.log('done.')
  await pool.end()
}

run().catch(async (e) => {
  console.error('✗ ingest failed:', e.message || e)
  await pool?.end()
  process.exit(1)
})
