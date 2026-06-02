// Central Google AdSense config.
//
// Ads stay COMPLETELY hidden until VITE_ADSENSE_CLIENT is set: no <ins> markup,
// no adsbygoogle.js script, and the layout collapses the empty ad rail. Once
// your account is approved, drop the publisher id (and per-unit slot ids) into
// the environment and rebuild — no code changes needed.

const clientRaw = import.meta.env.VITE_ADSENSE_CLIENT
export const ADSENSE_CLIENT = (clientRaw || '').trim()
export const ADS_ENABLED = ADSENSE_CLIENT.startsWith('ca-pub-')

// Show the dashed placeholder boxes even with no client id — handy while
// tweaking layout. Set VITE_ADS_PLACEHOLDER=1 in .env.local. Off by default,
// so production with no client id renders nothing at all.
const ph = import.meta.env.VITE_ADS_PLACEHOLDER
export const ADS_PLACEHOLDER = ph === '1' || ph === 'true'

// Anything that reserves ad space should gate on this.
export const ADS_VISIBLE = ADS_ENABLED || ADS_PLACEHOLDER

// Map the layout's slot names → the numeric ad-unit ids from your AdSense
// dashboard (Ads → By ad unit → each unit exposes a data-ad-slot number).
export const AD_SLOTS = {
  'rail-halfpage': import.meta.env.VITE_ADSENSE_SLOT_RAIL_HALFPAGE || '',
  'rail-rectangle': import.meta.env.VITE_ADSENSE_SLOT_RAIL_RECTANGLE || '',
  'infeed-mobile': import.meta.env.VITE_ADSENSE_SLOT_INFEED_MOBILE || '',
}

// Inject adsbygoogle.js exactly once, only when ads are enabled.
let injected = false
export function ensureAdsenseScript() {
  if (!ADS_ENABLED || injected) return
  if (document.querySelector('script[data-adsbygoogle]')) {
    injected = true
    return
  }
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src =
    'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
    encodeURIComponent(ADSENSE_CLIENT)
  s.dataset.adsbygoogle = '1'
  document.head.appendChild(s)
  injected = true
}
