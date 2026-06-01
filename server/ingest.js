import { scrapeTrending } from './scrapeTrending.js'
import { pool, hasDb } from './db.js'

/**
 * Scrape one (period, language) and persist as a snapshot, in one transaction:
 *  - upsert repos (dedup by full_name)
 *  - upsert today's snapshot row
 *  - replace that snapshot's rankings
 * Returns the scraped repos (frontend shape).
 */
export async function ingestTrending(since = 'daily', language = '') {
  const scraped = await scrapeTrending(since, language)
  if (!hasDb || scraped.length === 0) return scraped

  const client = await pool.connect()
  try {
    await client.query('begin')

    // 1. upsert repos, collect id per full_name
    const idByName = new Map()
    for (const r of scraped) {
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

    // 2. upsert today's snapshot (refreshes captured_at if re-run same day)
    const capturedDate = new Date().toISOString().slice(0, 10)
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
    for (const r of scraped) {
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

  return scraped
}
