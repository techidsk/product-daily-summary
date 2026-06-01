import { scrapeTrending } from './scrapeTrending.js'
import { supabase } from './supabase.js'

/**
 * Scrape one (period, language) and persist as a snapshot:
 *  - upsert repos (dedup by full_name)
 *  - upsert today's snapshot row
 *  - replace that snapshot's rankings
 * Returns the scraped repos (frontend shape).
 */
export async function ingestTrending(since = 'daily', language = '') {
  const scraped = await scrapeTrending(since, language)
  if (!supabase || scraped.length === 0) return scraped

  // 1. upsert repos, get id per full_name
  const repoRows = scraped.map((r) => ({
    full_name: r.fullName,
    owner: r.owner,
    name: r.name,
    url: r.url,
    description: r.description,
    language: r.language,
    language_color: r.languageColor,
    updated_at: new Date().toISOString(),
  }))
  const { data: repos, error: repoErr } = await supabase
    .from('repos')
    .upsert(repoRows, { onConflict: 'full_name' })
    .select('id, full_name')
  if (repoErr) throw repoErr
  const idByName = new Map(repos.map((r) => [r.full_name, r.id]))

  // 2. upsert today's snapshot (refreshes captured_at if re-run same day)
  const captured_date = new Date().toISOString().slice(0, 10)
  const { data: snap, error: snapErr } = await supabase
    .from('snapshots')
    .upsert(
      { captured_date, period: since, lang_filter: language, captured_at: new Date().toISOString() },
      { onConflict: 'captured_date,period,lang_filter' },
    )
    .select('id')
    .single()
  if (snapErr) throw snapErr

  // 3. replace rankings for this snapshot
  await supabase.from('rankings').delete().eq('snapshot_id', snap.id)
  const rankingRows = scraped
    .map((r) => ({
      snapshot_id: snap.id,
      repo_id: idByName.get(r.fullName),
      rank: r.rank,
      stars: r.stars,
      forks: r.forks,
      period_stars: r.periodStars,
    }))
    .filter((r) => r.repo_id)
  const { error: rankErr } = await supabase.from('rankings').insert(rankingRows)
  if (rankErr) throw rankErr

  return scraped
}
