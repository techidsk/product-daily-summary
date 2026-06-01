import { fetchHtml, parseTrendingHtml } from './scrapeTrending.js'

// Historical backfill source: the Internet Archive (archive.org) keeps periodic
// snapshots of github.com/trending. We use the CDX API to enumerate one capture
// per day, then fetch each archived page in raw mode (`id_`) so the original,
// un-rewritten HTML flows straight into the existing trending parser.

const CDX = 'https://web.archive.org/cdx/search/cdx'

const ymd = (date) => date.replace(/-/g, '') // 'YYYY-MM-DD' -> 'YYYYMMDD'

// The URL the Archive actually captured (scheme-less, for CDX matching).
// `daily` is the bare /trending page (densely archived ~1×/day); weekly/monthly
// live under explicit ?since= variants (captured far less often).
function waybackTarget(since, language) {
  const path = language ? `github.com/trending/${encodeURIComponent(language)}` : 'github.com/trending'
  return since === 'daily' ? path : `${path}?since=${since}`
}

// '20240115093000' -> '2024-01-15'
function tsToDate(ts) {
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
}

/**
 * List one archived snapshot per day for a (since, language) trending page.
 * @param {{from: string, to: string, since?: string, language?: string}} opts
 *   from/to are inclusive 'YYYY-MM-DD' dates.
 * @returns {Promise<Array<{date: string, timestamp: string, original: string}>>}
 */
export async function listWaybackSnapshots({ from, to, since = 'daily', language = '' }) {
  const target = waybackTarget(since, language)
  const params = new URLSearchParams({
    url: target,
    output: 'json',
    from: ymd(from),
    to: ymd(to),
    filter: 'statuscode:200',
    collapse: 'timestamp:8', // at most one capture per calendar day
    fl: 'timestamp,original',
  })

  const res = await fetch(`${CDX}?${params}`, {
    headers: { 'User-Agent': 'github-trending-daily/backfill' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`CDX responded ${res.status}`)

  const rows = await res.json()
  // First row is the header (['timestamp','original']); skip it.
  return rows.slice(1).map(([timestamp, original]) => ({
    date: tsToDate(timestamp),
    timestamp,
    original,
  }))
}

/** Fetch + parse a single archived trending page (raw `id_` mode). */
export async function scrapeWaybackSnapshot(snapshot) {
  const raw = `https://web.archive.org/web/${snapshot.timestamp}id_/${snapshot.original}`
  const html = await fetchHtml(raw)
  return parseTrendingHtml(html)
}
