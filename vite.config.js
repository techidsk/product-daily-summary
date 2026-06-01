import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { scrapeTrending } from './server/scrapeTrending.js'

// Dev-only middleware: serves real GitHub trending data without CORS.
// For production, port this handler to a serverless function (same logic).
function trendingApi() {
  return {
    name: 'trending-api',
    configureServer(server) {
      server.middlewares.use('/api/trending', async (req, res) => {
        const params = new URL(req.url, 'http://localhost').searchParams
        const since = params.get('since') || 'daily'
        const language = params.get('language') || ''
        res.setHeader('Content-Type', 'application/json')
        try {
          const repos = await scrapeTrending(since, language)
          res.end(JSON.stringify({ repos, since, language, fetchedAt: Date.now() }))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: String(e.message || e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), trendingApi()],
})
