import { scrapeTrending } from './scrapeTrending.js'
import { pool, hasDb } from './db.js'

/**
 * Persist a list of scraped repos as one snapshot, in a single transaction:
 *  - upsert repos (dedup by full_name)
 *  - upsert the (capturedDate, period, lang) snapshot row
 *  - replace that snapshot's rankings
 * Shared by live ingest (today) and historical backfill (a past date).
 */
export async function persistSnapshot(repos, capturedDate, since = 'daily', language = '') {
  if (!hasDb || repos.length === 0) return repos

  const client = await pool.connect()
  try {
    await client.query('begin')

    // 1. upsert repos, collect id per full_name
    const idByName = new Map()
    for (const r of repos) {
      const { rows } = await client.query(
        `insert into repos (full_name, owner, name, url, description, language, language_color, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7, now())
         on conflict (full_name) do update set
           owner = excluded.owner, name = excluded.name, url = excluded.url,
           description = excluded.description, language = excluded.language,
           language_color = excluded.language_color, updated_at = now()
         returning id, full_name`,
        [r.fullName, r.owner, r.name, r.url, r.description, r.language, r.languageColor],
      )
      idByName.set(rows[0].full_name, rows[0].id)
    }

    // 2. upsert the snapshot (refreshes captured_at if re-run for the same day)
    const { rows: snapRows } = await client.query(
      `insert into snapshots (captured_date, period, lang_filter, captured_at)
       values ($1,$2,$3, now())
       on conflict (captured_date, period, lang_filter) do update set captured_at = now()
       returning id`,
      [capturedDate, since, language],
    )
    const snapshotId = snapRows[0].id

    // 3. replace rankings for this snapshot
    await client.query('delete from rankings where snapshot_id = $1', [snapshotId])
    for (const r of repos) {
      const repoId = idByName.get(r.fullName)
      if (!repoId) continue
      await client.query(
        `insert into rankings (snapshot_id, repo_id, rank, stars, forks, period_stars)
         values ($1,$2,$3,$4,$5,$6)`,
        [snapshotId, repoId, r.rank, r.stars, r.forks, r.periodStars],
      )
    }

    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }

  return repos
}

/**
 * Scrape today's github.com/trending for one (period, language) and persist it.
 * Returns the scraped repos (frontend shape).
 */
export async function ingestTrending(since = 'daily', language = '') {
  const scraped = await scrapeTrending(since, language)
  if (!hasDb || scraped.length === 0) return scraped
  const capturedDate = new Date().toISOString().slice(0, 10)
  return persistSnapshot(scraped, capturedDate, since, language)
}
