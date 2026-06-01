import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Path A: the SPA reads data directly from Supabase (see src/api/trending.js).
// No dev API middleware needed. Ingestion is a separate Node job (npm run ingest,
// scheduled by GitHub Actions). VITE_* vars are auto-exposed by Vite.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
