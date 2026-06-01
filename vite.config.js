import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only API middleware. Persistence lives behind the store layer (Supabase
// when configured, in-memory cache otherwise). When CF is added later, the same
// store/ingest modules move into a Worker — the frontend keeps calling /api/*.
function trendingApi() {
  const json = (res, body, status = 200) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  }

  return {
    name: 'trending-api',
    async configureServer(server) {
      // store.js touches process.env (Supabase keys) — import after loadEnv ran.
      const { getTrending, getHistory, getHistoryDates } = await import('./server/store.js')

      server.middlewares.use('/api/trending', async (req, res) => {
        const p = new URL(req.url, 'http://localhost').searchParams
        const since = p.get('since') || 'daily'
        const language = p.get('language') || ''
        try {
          const { repos, source } = await getTrending(since, language)
          json(res, { repos, since, language, source })
        } catch (e) {
          json(res, { error: String(e.message || e) }, 502)
        }
      })

      server.middlewares.use('/api/history/dates', async (req, res) => {
        const p = new URL(req.url, 'http://localhost').searchParams
        const since = p.get('since') || 'daily'
        const language = p.get('language') || ''
        try {
          json(res, { dates: await getHistoryDates(since, language) })
        } catch (e) {
          json(res, { error: String(e.message || e) }, 502)
        }
      })

      server.middlewares.use('/api/history', async (req, res) => {
        const p = new URL(req.url, 'http://localhost').searchParams
        const date = p.get('date')
        const since = p.get('since') || 'daily'
        const language = p.get('language') || ''
        try {
          json(res, { repos: await getHistory(date, since, language), date, since, language })
        } catch (e) {
          json(res, { error: String(e.message || e) }, 502)
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load .env into process.env so the server-side store can read Supabase keys.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), tailwindcss(), trendingApi()],
  }
})
