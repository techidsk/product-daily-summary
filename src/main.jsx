import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/jetbrains-mono'
import App from './App.jsx'
import { LanguageProvider } from './i18n.jsx'
import './index.css'

// Snapshots only change a few times a day (ingest cron), so cached results stay
// fresh for a while and switching period/language/date is instant on revisit.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — no refetch on revisit within this window
      // gcTime must be >= the persister maxAge below, otherwise restored entries
      // get garbage-collected before they're shown. 24h keeps a full day cached.
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Persist the cache to localStorage so it survives full page loads — refreshes,
// returning visitors, and navigating back from the prerendered /repo and
// /hall-of-fame pages (each is a separate HTML doc, so the in-memory cache is
// otherwise wiped). On revisit the feed paints instantly from localStorage and
// only refetches in the background once the data goes stale. The `buster` is
// bumped whenever the cached shape changes to invalidate old entries.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'gh-trending-cache',
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000, buster: 'v1' }}
    >
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
