import { useI18n } from '../i18n.jsx'

/**
 * Reserved advertising slot. Renders an editorial placeholder now; drop real
 * ad markup (AdSense / direct) into the inner `[data-ad-slot]` node later —
 * the layout space is already accounted for so nothing shifts.
 *
 * @param {number} width  IAB width  (e.g. 300)
 * @param {number} height IAB height (e.g. 600 half-page, 250 medium rectangle)
 * @param {string} slot   slot id passed through to data-ad-slot
 */
export default function AdSlot({ width = 300, height = 600, slot = 'rail', className = '' }) {
  const { t } = useI18n()
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
