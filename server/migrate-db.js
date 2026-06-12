import pg from 'pg'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

pg.types.setTypeParser(1082, (v) => v)

const here = dirname(fileURLToPath(import.meta.url))

const PERIODS = new Set(['daily', 'weekly', 'monthly'])

function parseArgs(argv) {
  const out = {}
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/)
    if (match) out[match[1]] = match[2]
    else if (arg.startsWith('--')) out[arg.slice(2)] = true
  }
  return out
}

function splitList(value) {
  if (!value) return null
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function resolveLangs(value) {
  const langs = splitList(value)
  if (!langs) return null
  return langs.map((lang) => (lang === 'all' ? '' : lang))
}

function resolvePeriods(value) {
  const periods = splitList(value)
  if (!periods) return null
  const invalid = periods.filter((period) => !PERIODS.has(period))
  if (invalid.length) throw new Error(`invalid period(s): ${invalid.join(', ')}`)
  return periods
}

function poolFor(connectionString) {
  return new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
  })
}

function addFilter(parts, params, sql, value) {
  params.push(value)
  parts.push(sql.replace('?', `$${params.length}`))
}

function snapshotFilter(args) {
  const parts = []
  const params = []
  const periods = resolvePeriods(args.periods)
  const langs = resolveLangs(args.langs)

  if (args.from) addFilter(parts, params, 'captured_date >= ?', args.from)
  if (args.to) addFilter(parts, params, 'captured_date <= ?', args.to)
  if (periods) addFilter(parts, params, 'period = any(?::text[])', periods)
  if (langs) addFilter(parts, params, 'lang_filter = any(?::text[])', langs)

  return {
    where: parts.length ? `where ${parts.join(' and ')}` : '',
    params,
  }
}

async function fetchSourceData(source, args) {
  const filter = snapshotFilter(args)
  const snapshots = (
    await source.query(
      `select id, captured_at, captured_date, period, lang_filter
       from snapshots
       ${filter.where}
       order by captured_date, period, lang_filter`,
      filter.params,
    )
  ).rows

  if (snapshots.length === 0) return { snapshots, repos: [], rankings: [] }

  const snapshotIds = snapshots.map((row) => row.id)
  const repos = (
    await source.query(
      `select distinct r.id, r.full_name, r.owner, r.name, r.url, r.description,
              r.language, r.language_color, r.updated_at
       from repos r
       join rankings rk on rk.repo_id = r.id
       where rk.snapshot_id = any($1::bigint[])
       order by r.id`,
      [snapshotIds],
    )
  ).rows

  const rankings = (
    await source.query(
      `select snapshot_id, repo_id, rank, stars, forks, period_stars
       from rankings
       where snapshot_id = any($1::bigint[])
       order by snapshot_id, rank`,
      [snapshotIds],
    )
  ).rows

  return { snapshots, repos, rankings }
}

async function applySchema(target) {
  const schema = readFileSync(join(here, '..', 'supabase', 'schema.sql'), 'utf8')
  await target.query(schema)
}

async function upsertRepos(client, repos) {
  const idMap = new Map()
  for (const repo of repos) {
    const { rows } = await client.query(
      `insert into repos (full_name, owner, name, url, description, language, language_color, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (full_name) do update set
         owner = excluded.owner,
         name = excluded.name,
         url = excluded.url,
         description = excluded.description,
         language = excluded.language,
         language_color = excluded.language_color,
         updated_at = excluded.updated_at
       returning id`,
      [
        repo.full_name,
        repo.owner,
        repo.name,
        repo.url,
        repo.description,
        repo.language,
        repo.language_color,
        repo.updated_at,
      ],
    )
    idMap.set(String(repo.id), rows[0].id)
  }
  return idMap
}

async function upsertSnapshots(client, snapshots) {
  const idMap = new Map()
  for (const snapshot of snapshots) {
    const { rows } = await client.query(
      `insert into snapshots (captured_at, captured_date, period, lang_filter)
       values ($1,$2,$3,$4)
       on conflict (captured_date, period, lang_filter) do update set
         captured_at = excluded.captured_at
       returning id`,
      [snapshot.captured_at, snapshot.captured_date, snapshot.period, snapshot.lang_filter],
    )
    idMap.set(String(snapshot.id), rows[0].id)
  }
  return idMap
}

async function insertRankings(client, rankings, snapshotMap, repoMap) {
  const batchSize = 1000
  let inserted = 0

  for (let i = 0; i < rankings.length; i += batchSize) {
    const batch = rankings.slice(i, i + batchSize)
    const params = []
    const values = []

    for (const row of batch) {
      const targetSnapshotId = snapshotMap.get(String(row.snapshot_id))
      const targetRepoId = repoMap.get(String(row.repo_id))
      if (!targetSnapshotId || !targetRepoId) continue

      params.push(targetSnapshotId, targetRepoId, row.rank, row.stars, row.forks, row.period_stars)
      const offset = params.length - 5
      values.push(`($${offset},$${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5})`)
    }

    if (values.length === 0) continue
    await client.query(
      `insert into rankings (snapshot_id, repo_id, rank, stars, forks, period_stars)
       values ${values.join(',')}`,
      params,
    )
    inserted += values.length
  }

  return inserted
}

async function migrate(target, data, skipSchema) {
  if (!skipSchema) await applySchema(target)

  const client = await target.connect()
  try {
    await client.query('begin')
    const repoMap = await upsertRepos(client, data.repos)
    const snapshotMap = await upsertSnapshots(client, data.snapshots)
    const targetSnapshotIds = [...snapshotMap.values()]

    if (targetSnapshotIds.length) {
      await client.query('delete from rankings where snapshot_id = any($1::bigint[])', [targetSnapshotIds])
    }

    const insertedRankings = await insertRankings(client, data.rankings, snapshotMap, repoMap)
    await client.query('commit')

    return {
      repos: repoMap.size,
      snapshots: snapshotMap.size,
      rankings: insertedRankings,
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL
  const targetUrl = process.env.TARGET_DATABASE_URL

  if (!sourceUrl) throw new Error('missing SOURCE_DATABASE_URL or DATABASE_URL')
  if (!targetUrl) throw new Error('missing TARGET_DATABASE_URL')
  if (sourceUrl === targetUrl) throw new Error('source and target database URLs are identical')

  const source = poolFor(sourceUrl)
  const target = poolFor(targetUrl)

  try {
    const data = await fetchSourceData(source, args)
    console.log(
      `source: ${data.repos.length} repos, ${data.snapshots.length} snapshots, ${data.rankings.length} rankings`,
    )

    if (args['dry-run']) return
    if (data.snapshots.length === 0) return

    const result = await migrate(target, data, Boolean(args['skip-schema']))
    console.log(`target: migrated ${result.repos} repos, ${result.snapshots} snapshots, ${result.rankings} rankings`)
  } finally {
    await source.end()
    await target.end()
  }
}

run().catch((error) => {
  console.error('db:migrate failed:', error.message || error)
  process.exit(1)
})
