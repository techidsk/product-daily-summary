import { listWaybackSnapshots, scrapeWaybackSnapshot } from './scrapeWayback.js'
import { persistSnapshot } from './ingest.js'
import { pool, hasDb } from './db.js'

// Backfill historical trending snapshots from the Internet Archive.
//
//   npm run backfill -- --from=2024-01-01 --to=2024-03-01
//   npm run backfill -- --days=90                       # last 90 days up to today
//   npm run backfill -- --from=2024-01-01 --periods=daily --langs=all,javascript
//
// Each archived day is stored under its REAL capture date, so the calendar
// reflects exactly which days archive.org actually captured.

const PERIODS = ['daily', 'weekly', 'monthly']
const ALL_LANGS = ['', 'javascript', 'typescript', 'python', 'go', 'rust', 'java', 'c++']

// Be polite to archive.org — it rate-limits bursts hard.
const GAP_MS = 1500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
    else if (a.startsWith('--')) out[a.slice(2)] = true
  }
  return out
}

function dateNDaysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function resolveRange(args) {
  const today = new Date().toISOString().slice(0, 10)
  if (args.days) return { from: dateNDaysAgo(parseInt(args.days, 10)), to: today }
  return { from: args.from || dateNDaysAgo(30), to: args.to || today }
}

// 'all' / '' both mean the unfiltered (all-languages) trending page.
function resolveLangs(arg) {
  if (!arg) return ['']
  return String(arg)
    .split(',')
    .map((s) => (s === 'all' ? '' : s.trim()))
}

async function run() {
  if (!hasDb) {
    console.error('✗ 未配置 DATABASE_URL（在 .env 设置）')
    process.exit(1)
  }

  const args = parseArgs(process.argv.slice(2))
  const { from, to } = resolveRange(args)
  const periods = args.periods ? String(args.periods).split(',') : PERIODS
  const langs = args.langs ? resolveLangs(args.langs) : ['']

  console.log(`backfill ${from} → ${to}`)
  console.log(`periods: ${periods.join(', ')}  ·  langs: ${langs.map((l) => l || 'all').join(', ')}\n`)

  let days = 0
  let fail = 0

  for (const since of periods) {
    for (const language of langs) {
      const label = `${since}/${language || 'all'}`
      let snaps
      try {
        snaps = await listWaybackSnapshots({ from, to, since, language })
      } catch (e) {
        console.warn(`! ${label} CDX lookup failed: ${e.message || e}`)
        continue
      }
      console.log(`· ${label}: ${snaps.length} archived day(s)`)

      for (const snap of snaps) {
        try {
          const repos = await scrapeWaybackSnapshot(snap)
          if (repos.length === 0) {
            console.warn(`  ! ${snap.date} ${label}: empty (skipped)`)
          } else {
            await persistSnapshot(repos, snap.date, since, language)
            days++
            console.log(`  ✓ ${snap.date} ${label.padEnd(18)} ${repos.length} repos`)
          }
        } catch (e) {
          fail++
          console.warn(`  ! ${snap.date} ${label}: ${e.message || e}`)
        }
        await sleep(GAP_MS)
      }
    }
  }

  console.log(`\ndone. ${days} day-snapshots stored, ${fail} failed`)
  await pool.end()
}

run().catch(async (e) => {
  console.error('✗ backfill failed:', e.message || e)
  await pool?.end()
  process.exit(1)
})
