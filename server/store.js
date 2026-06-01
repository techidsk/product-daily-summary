import { scrapeTrending } from './scrapeTrending.js'
import { ingestTrending } from './ingest.js'
import { pool, hasDb } from './db.js'

const TTL = 30 * 60 * 1000 // 30 min

// ── Fallback path when DATABASE_URL isn't set: in-memory cache ─────────
const mem = new Map() // key -> { at, repos }
const inflight = new Map()

async function memTrending(since, language) {
  const key = `${since}:${language}`
  const hit = mem.get(key)
  if (hit && Date.now() - hit.at < TTL) return { repos: hit.repos, source: 'memory' }
  try {
    if (!inflight.has(key)) inflight.set(key, scrapeTrending(since, language))
    const repos = await inflight.get(key)
    mem.set(key, { at: Date.now(), repos })
    return { repos, source: 'scrape' }
  } catch (e) {
    if (hit) return { repos: hit.repos, source: 'stale' }
    throw e
  } finally {
    inflight.delete(key)
  }
}

// ── DB reads ──────────────────────────────────────────────────────────
async function readSnapshotRepos(snapshotId) {
  const { rows } = await pool.query(
    `select rk.rank, rk.stars, rk.forks, rk.period_stars,
            r.full_name, r.owner, r.name, r.url, r.description, r.language, r.language_color
     from rankings rk
     join repos r on r.id = rk.repo_id
     where rk.snapshot_id = $1
     order by rk.rank`,
    [snapshotId],
  )
  return rows.map((row) => ({
    rank: row.rank,
    stars: row.stars,
    forks: row.forks,
    periodStars: row.period_stars,
    owner: row.owner,
    name: row.name,
    fullName: row.full_name,
    url: row.url,
    description: row.description,
    language: row.language,
    languageColor: row.language_color,
  }))
}

async function latestSnapshot(since, language) {
  const { rows } = await pool.query(
    `select id, captured_at from snapshots
     where period = $1 and lang_filter = $2
     order by captured_at desc limit 1`,
    [since, language],
  )
  return rows[0] || null
}

/** Serve trending: fresh DB snapshot → else re-ingest → else stale/scrape. */
export async function getTrending(since, language = '') {
  if (!hasDb) return memTrending(since, language)

  const snap = await latestSnapshot(since, language)
  const fresh = snap && Date.now() - new Date(snap.captured_at).getTime() < TTL
  if (fresh) return { repos: await readSnapshotRepos(snap.id), source: 'db' }

  try {
    const repos = await ingestTrending(since, language)
    return { repos, source: 'ingest' }
  } catch (e) {
    if (snap) return { repos: await readSnapshotRepos(snap.id), source: 'stale' } // upstream down → serve archive
    throw e
  }
}

/** History: distinct dates with a snapshot for this period + lang filter. */
export async function getHistoryDates(since, language = '') {
  if (!hasDb) return []
  const { rows } = await pool.query(
    `select distinct captured_date from snapshots
     where period = $1 and lang_filter = $2
     order by captured_date desc`,
    [since, language],
  )
  return rows.map((r) => r.captured_date)
}

/** History: a specific past day's snapshot. */
export async function getHistory(date, since, language = '') {
  if (!hasDb || !date) return []
  const { rows } = await pool.query(
    `select id from snapshots
     where captured_date = $1 and period = $2 and lang_filter = $3
     limit 1`,
    [date, since, language],
  )
  if (!rows[0]) return []
  return readSnapshotRepos(rows[0].id)
}
