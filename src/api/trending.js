import { supabase } from '../lib/supabaseClient.js'

// Path A: the browser reads snapshots straight from Supabase (no API server).
// Freshness is the ingest cron's job; the client just reads the latest snapshot.

const RANKING_SELECT =
  'rank, stars, forks, period_stars, repos!inner(full_name, owner, name, url, description, language, language_color)'

function mapRows(rows) {
  return (rows || []).map((row) => ({
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

function ensure() {
  if (!supabase) throw new Error('未配置 Supabase（VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY）')
}

async function reposForSnapshot(snapshotId) {
  const { data, error } = await supabase
    .from('rankings')
    .select(RANKING_SELECT)
    .eq('snapshot_id', snapshotId)
    .order('rank')
  if (error) throw new Error(error.message)
  return mapRows(data)
}

// Lightweight rank lookup for a snapshot: Map<fullName, rank>. Used to diff a
// ranking against the previous snapshot for the ▲/▼/NEW markers.
async function ranksForSnapshot(snapshotId) {
  const { data, error } = await supabase
    .from('rankings')
    .select('rank, repos!inner(full_name)')
    .eq('snapshot_id', snapshotId)
  if (error) return null
  return new Map((data || []).map((row) => [row.repos.full_name, row.rank]))
}

// Annotate each repo with movement vs the previous snapshot:
//   rankDelta = prevRank - rank  (positive = climbed; null = no comparison)
//   isNew     = present now but absent from the previous snapshot
// With no previous snapshot (prev = null), markers are suppressed entirely so a
// first-ever archived day doesn't render a wall of "NEW".
function annotateDeltas(current, prev) {
  if (!prev) return current.map((r) => ({ ...r, rankDelta: null, isNew: false }))
  return current.map((r) => {
    const prevRank = prev.get(r.fullName)
    return {
      ...r,
      rankDelta: prevRank === undefined ? null : prevRank - r.rank,
      isNew: prevRank === undefined,
    }
  })
}

export async function fetchTrending(since, language = '') {
  ensure()
  // Pull the two most recent snapshots so we can diff current vs previous.
  const { data: snaps, error } = await supabase
    .from('snapshots')
    .select('id')
    .eq('period', since)
    .eq('lang_filter', language)
    .order('captured_at', { ascending: false })
    .limit(2)
  if (error) throw new Error(error.message)
  if (!snaps?.length) return []
  const current = await reposForSnapshot(snaps[0].id)
  const prev = snaps[1] ? await ranksForSnapshot(snaps[1].id) : null
  return annotateDeltas(current, prev)
}

export async function fetchHistoryDates(since, language = '') {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('snapshots')
    .select('captured_date')
    .eq('period', since)
    .eq('lang_filter', language)
    .order('captured_date', { ascending: false })
  if (error) return []
  return [...new Set((data || []).map((d) => d.captured_date))]
}

export async function fetchHistory(date, since, language = '') {
  ensure()
  const { data: snaps, error } = await supabase
    .from('snapshots')
    .select('id')
    .eq('captured_date', date)
    .eq('period', since)
    .eq('lang_filter', language)
    .limit(1)
  if (error) throw new Error(error.message)
  if (!snaps?.length) return []

  // Previous archived day for the same period/language (dates can have gaps).
  const { data: prevSnaps } = await supabase
    .from('snapshots')
    .select('id')
    .eq('period', since)
    .eq('lang_filter', language)
    .lt('captured_date', date)
    .order('captured_date', { ascending: false })
    .limit(1)

  const current = await reposForSnapshot(snaps[0].id)
  const prev = prevSnaps?.length ? await ranksForSnapshot(prevSnaps[0].id) : null
  return annotateDeltas(current, prev)
}
