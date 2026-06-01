import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { scrapeTrending } from './server/scrapeTrending.js'

// Dev-only middleware: serves real GitHub trending data without CORS.
// For production, port this handler to a serverless function (same logic) and
// swap this in-memory cache for the CDN/KV layer (see README "数据持久化").
function trendingApi() {
  const TTL = 30 * 60 * 1000 // 30 min — GitHub trending only updates a few times/day
  const cache = new Map() // key -> { at, repos }
  const inflight = new Map() // key -> Promise (coalesce concurrent/StrictMode double fetches)

  return {
    name: 'trending-api',
    configureServer(server) {
      server.middlewares.use('/api/trending', async (req, res) => {
        const params = new URL(req.url, 'http://localhost').searchParams
        const since = params.get('since') || 'daily'
        const language = params.get('language') || ''
        const key = `${since}:${language}`
        res.setHeader('Content-Type', 'application/json')

        const hit = cache.get(key)
        if (hit && Date.now() - hit.at < TTL) {
          res.end(JSON.stringify({ repos: hit.repos, since, language, cached: true }))
          return
        }
        try {
          if (!inflight.has(key)) inflight.set(key, scrapeTrending(since, language))
          const repos = await inflight.get(key)
          cache.set(key, { at: Date.now(), repos })
          res.end(JSON.stringify({ repos, since, language, cached: false }))
        } catch (e) {
          if (hit) {
            // serve stale on upstream failure rather than erroring
            res.end(JSON.stringify({ repos: hit.repos, since, language, stale: true }))
          } else {
            res.statusCode = 502
            res.end(JSON.stringify({ error: String(e.message || e) }))
          }
        } finally {
          inflight.delete(key)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), trendingApi()],
})
