import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n.jsx'
import {
  ADS_ENABLED,
  ADS_PLACEHOLDER,
  ADSENSE_CLIENT,
  AD_SLOTS,
  ensureAdsenseScript,
} from '../lib/ads.js'

/**
 * Advertising slot.
 * - With a configured AdSense client id + a slot id → renders a real ad unit.
 * - With VITE_ADS_PLACEHOLDER=1 (and no client) → renders a dashed placeholder
 *   so you can see the reserved space while working on layout.
 * - Otherwise → renders nothing (the default until AdSense is wired up).
 *
 * @param {number} width  IAB width  (e.g. 300)
 * @param {number} height IAB height (e.g. 600 half-page, 250 medium rectangle)
 * @param {string} slot   slot name; mapped to a real ad-unit id via AD_SLOTS
 */
export default function AdSlot({ width = 300, height = 600, slot = 'rail', className = '' }) {
  const { t } = useI18n()
  const pushed = useRef(false)
  const adId = AD_SLOTS[slot] || ''
  const live = ADS_ENABLED && Boolean(adId)

  useEffect(() => {
    if (!live || pushed.current) return
    pushed.current = true
    ensureAdsenseScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* adsbygoogle not ready / blocked — ignore */
    }
  }, [live])

  // Real ad unit (fixed IAB size → no layout shift).
  if (live) {
    return (
      <div style={{ maxWidth: width }} className={`mx-auto w-full ${className}`}>
        <ins
          className="adsbygoogle block"
          style={{ display: 'inline-block', width, height }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={adId}
        />
      </div>
    )
  }

  // No client id yet and not in placeholder mode → render nothing.
  if (!ADS_PLACEHOLDER) return null

  // Dashed placeholder for layout work.
  return (
    <div
      data-ad-slot={slot}
      style={{ maxWidth: width, aspectRatio: `${width} / ${height}` }}
      className={`group relative mx-auto flex w-full items-center justify-center overflow-hidden border border-dashed border-line bg-paper-2/60 ${className}`}
    >
      {/* corner ticks for an intentional, set-into-the-page feel */}
      <span className="pointer-events-none absolute left-1.5 top-1.5 h-2.5 w-2.5 border-l border-t border-muted/50" />
      <span className="pointer-events-none absolute right-1.5 top-1.5 h-2.5 w-2.5 border-r border-t border-muted/50" />
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-2.5 w-2.5 border-b border-l border-muted/50" />
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b border-r border-muted/50" />

      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
          {t('adLabel')}
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted/60">
          {width}×{height}
        </div>
      </div>
    </div>
  )
}
