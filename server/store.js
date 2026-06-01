import { scrapeTrending } from './scrapeTrending.js'
import { ingestTrending } from './ingest.js'
import { supabase, hasSupabase } from './supabase.js'

const TTL = 30 * 60 * 1000 // 30 min

// ── Fallback path when Supabase isn't configured: in-memory cache ──────
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

// ── Map a snapshot's ranking rows to the frontend repo shape ──────────
function mapRows(rows) {
  return rows.map((row) => ({
    rank: row.rank,
    stars: row.stars,
    forks: row.forks,
    periodStars: row.period_stars,
    owner: row.repos.owner,
    name: row.repos.name,
    fullName: row.repos.full_name,
    url: row.repos.url,
    description: row.repos.description,
    language: row.repos.language,
    languageColor: row.repos.language_color,
  }))
}

const RANKING_SELECT =
  'rank, stars, forks, period_stars, repos!inner(full_name, owner, name, url, description, language, language_color)'

async function readSnapshotRepos(snapshotId) {
  const { data, error } = await supabase
    .from('rankings')
    .select(RANKING_SELECT)
    .eq('snapshot_id', snapshotId)
    .order('rank')
  if (error) throw error
  return mapRows(data)
}

async function latestSnapshot(since, language) {
  const { data, error } = await supabase
    .from('snapshots')
    .select('id, captured_at')
    .eq('period', since)
    .eq('lang_filter', language)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Serve trending: fresh DB snapshot → else re-ingest → else stale/scrape. */
export async function getTrending(since, language = '') {
  if (!hasSupabase) return memTrending(since, language)

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

/** History: distinct dates that have an all-languages snapshot for a period. */
export async function getHistoryDates(since, language = '') {
  if (!hasSupabase) return []
  const { data, error } = await supabase
    .from('snapshots')
    .select('captured_date')
    .eq('period', since)
    .eq('lang_filter', language)
    .order('captured_date', { ascending: false })
  if (error) throw error
  return [...new Set(data.map((d) => d.captured_date))]
}

/** History: a specific past day's snapshot. */
export async function getHistory(date, since, language = '') {
  if (!hasSupabase) return []
  const { data: snap, error } = await supabase
    .from('snapshots')
    .select('id')
    .eq('captured_date', date)
    .eq('period', since)
    .eq('lang_filter', language)
    .maybeSingle()
  if (error) throw error
  if (!snap) return []
  return readSnapshotRepos(snap.id)
}
