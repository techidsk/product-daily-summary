import { ingestTrending } from './ingest.js'
import { pool, hasDb } from './db.js'

// Ingest every period × language combo as today's snapshot.
// Run via `npm run ingest`; scheduled by GitHub Actions (.github/workflows/ingest.yml).
const PERIODS = ['daily', 'weekly', 'monthly']
const LANGUAGES = ['', 'javascript', 'typescript', 'python', 'go', 'rust', 'java', 'c++']

// Space out requests — github.com/trending rate-limits rapid bursts.
const GAP_MS = 2500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run() {
  if (!hasDb) {
    console.error('✗ 未配置 DATABASE_URL（在 .env 设置）')
    process.exit(1)
  }
  const combos = PERIODS.flatMap((since) => LANGUAGES.map((lang) => ({ since, lang })))
  let ok = 0
  for (let i = 0; i < combos.length; i++) {
    const { since, lang } = combos[i]
    try {
      const repos = await ingestTrending(since, lang)
      ok++
      console.log(`✓ ${since.padEnd(7)} ${(lang || 'all').padEnd(10)} ${repos.length} repos`)
    } catch (e) {
      console.warn(`! ${since} ${lang || 'all'} skipped: ${e.message || e}`)
    }
    if (i < combos.length - 1) await sleep(GAP_MS)
  }
  console.log(`done. ${ok}/${combos.length} ok`)
  await pool.end()
}

run().catch(async (e) => {
  console.error('✗ ingest failed:', e.message || e)
  await pool?.end()
  process.exit(1)
})
