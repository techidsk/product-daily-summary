import { forwardRef } from 'react'
import { useI18n } from '../i18n.jsx'
import { SITE_DOMAIN } from '../lib/share.js'

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

/**
 * Exportable single-repo share card — editorial almanac style, fixed width
 * for a consistent PNG. Mirrors ShareCard's masthead so the brand reads the
 * same whether you share the daily Top 5 or one project.
 */
const RepoShareCard = forwardRef(function RepoShareCard({ repo, since }, ref) {
  const { t, locale } = useI18n()
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
        <span className="text-muted">#{repo.rank}</span>
      </div>

      {/* repo name */}
      <h1 className="mt-4 break-words font-mono text-2xl font-bold leading-tight tracking-tight text-ink">
        <span className="text-muted">{repo.owner}/</span>
        {repo.name}
      </h1>

      {repo.description && (
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{repo.description}</p>
      )}

      <div className="mt-5 border-t-2 border-ink" />

      {/* stats row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[13px] text-muted">
        {repo.language && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: repo.languageColor || '#94a3b8' }}
            />
            {repo.language}
          </span>
        )}
        <span>★ {formatNum(repo.stars)}</span>
        <span>⑂ {formatNum(repo.forks)}</span>
        {repo.periodStars > 0 && (
          <span className="font-medium text-vermilion">+{formatNum(repo.periodStars)} ★</span>
        )}
      </div>

      <div className="mt-5 border-t border-line pt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        <span>{dateStr}</span>
        <span className="text-vermilion">{SITE_DOMAIN}</span>
      </div>
    </div>
  )
})

export default RepoShareCard
