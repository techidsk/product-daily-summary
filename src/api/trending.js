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

export async function fetchTrending(since, language = '') {
  ensure()
  const { data: snaps, error } = await supabase
    .from('snapshots')
    .select('id')
    .eq('period', since)
    .eq('lang_filter', language)
    .order('captured_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  if (!snaps?.length) return []
  return reposForSnapshot(snaps[0].id)
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
  return reposForSnapshot(snaps[0].id)
}
