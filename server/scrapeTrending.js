import * as cheerio from 'cheerio'

const SINCE = new Set(['daily', 'weekly', 'monthly'])

// GitHub occasionally drops a connection ("fetch failed"); retry briefly.
async function fetchHtml(url, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html',
        },
      })
      if (!res.ok) throw new Error(`GitHub responded ${res.status}`)
      return await res.text()
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw lastErr
}

function parseCount(text) {
  if (!text) return 0
  const m = text.replace(/,/g, '').match(/[\d]+/)
  return m ? parseInt(m[0], 10) : 0
}

/**
 * Scrape github.com/trending on the server (no CORS, real data).
 * @param {'daily'|'weekly'|'monthly'} since
 * @param {string} language e.g. 'javascript' (empty = all)
 */
export async function scrapeTrending(since = 'daily', language = '') {
  if (!SINCE.has(since)) since = 'daily'
  const path = language ? `/trending/${encodeURIComponent(language)}` : '/trending'
  const url = `https://github.com${path}?since=${since}`

  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const repos = []

  $('article.Box-row').each((i, el) => {
    const $el = $(el)
    const href = $el.find('h2 a').attr('href') || ''
    const [, owner, name] = href.split('/')
    if (!owner || !name) return

    const description = $el.find('p').first().text().trim()
    const language = $el.find('[itemprop="programmingLanguage"]').first().text().trim()
    const languageColor =
      $el.find('.repo-language-color').first().attr('style')?.match(/#[0-9a-fA-F]{3,6}/)?.[0] || null
    const stars = parseCount($el.find('a[href$="/stargazers"]').first().text())
    const forks = parseCount($el.find('a[href$="/forks"], a[href$="/network/members"]').first().text())
    const periodStars = parseCount($el.find('.float-sm-right').first().text())

    repos.push({
      rank: i + 1,
      owner,
      name,
      fullName: `${owner}/${name}`,
      url: `https://github.com${href}`,
      description,
      language: language || null,
      languageColor,
      stars,
      forks,
      periodStars,
    })
  })

  return repos
}
