import { ProxyAgent, setGlobalDispatcher } from 'undici'

// Node's built-in fetch (undici) ignores HTTPS_PROXY/HTTP_PROXY env vars.
// When a proxy is configured we install it as the global dispatcher so every
// fetch() — notably the Wayback/archive.org calls in backfill — routes through it.
// No-ops when no proxy var is set (e.g. GitHub Actions), so it's always safe to import.
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  process.env.ALL_PROXY ||
  process.env.all_proxy ||
  ''

if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl))
}

export const usingProxy = Boolean(proxyUrl)
export const proxyEndpoint = proxyUrl
