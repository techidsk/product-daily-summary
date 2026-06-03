import { forwardRef } from 'react'
import { useI18n } from '../i18n.jsx'
import { SITE_DOMAIN } from '../lib/share.js'

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

const HEADING_KEY = {
  daily: 'cardHeadingDaily',
  weekly: 'cardHeadingWeekly',
  monthly: 'cardHeadingMonthly',
}

/**
 * Exportable share card — editorial almanac style, fixed width for a
 * consistent PNG.
 */
const ShareCard = forwardRef(function ShareCard({ repos, since, language }, ref) {
  const { t, locale } = useI18n()
  const top = repos.slice(0, 5)
  const dateStr = new Date().toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div ref={ref} className="w-[480px] overflow-hidden bg-paper p-8 shadow-2xl">
      {/* masthead */}
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-vermilion">
        <span>{t('kicker')}</span>
        {language && <span className="capitalize text-muted">{language}</span>}
      </div>
      <h1 className="mt-3 font-display text-3xl font-black leading-tight tracking-tight text-ink">
        {t(HEADING_KEY[since])}
      </h1>
      <div className="mt-2 border-t-2 border-ink" />
      <div className="mt-1 border-t border-line pt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
        {dateStr}
      </div>

      {/* list */}
      <div className="mt-3">
        {top.map((r, i) => (
          <div key={r.fullName} className="flex items-start gap-4 border-t border-line-soft py-3.5 first:border-t-0">
            <div
              className={`w-8 shrink-0 text-right font-display text-3xl font-light leading-none tabular-nums ${
                i < 3 ? 'text-vermilion' : 'text-muted/70'
              }`}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <div className="truncate font-mono text-[15px] font-semibold tracking-tight text-ink">
                  <span className="text-muted">{r.owner}/</span>
                  {r.name}
                </div>
                {r.periodStars > 0 && (
                  <span className="shrink-0 whitespace-nowrap font-display text-base font-medium text-vermilion">
                    +{formatNum(r.periodStars)}
                  </span>
                )}
              </div>
              {r.description && (
                <div className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-soft">
                  {r.description}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-4 font-mono text-[11px] text-muted">
                {r.language && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: r.languageColor || '#94a3b8' }}
                    />
                    {r.language}
                  </span>
                )}
                <span>★ {formatNum(r.stars)}</span>
                <span>⑂ {formatNum(r.forks)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t-2 border-ink pt-2 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-vermilion">
        {SITE_DOMAIN}
      </div>
    </div>
  )
})

export default ShareCard
