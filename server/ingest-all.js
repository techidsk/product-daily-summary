import { ingestTrending } from './ingest.js'
import { hasSupabase } from './supabase.js'

// Ingest all three periods (all-languages) into Supabase as today's snapshot.
// Run manually now via `npm run ingest`; wire to CF cron later.
const PERIODS = ['daily', 'weekly', 'monthly']

async function run() {
  if (!hasSupabase) {
    console.error('✗ Supabase 未配置：请在 .env 设置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  for (const since of PERIODS) {
    const repos = await ingestTrending(since, '')
    console.log(`✓ ${since.padEnd(7)} ${repos.length} repos`)
  }
  console.log('done.')
}

run().catch((e) => {
  console.error('✗ ingest failed:', e.message || e)
  process.exit(1)
})
