import { forwardRef } from 'react'
import { Star, GitFork } from '@phosphor-icons/react'
import { useI18n } from '../i18n.jsx'

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
 * The exportable share card. Fixed width so the PNG stays consistent.
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
    <div ref={ref} className="w-[480px] overflow-hidden rounded-2xl bg-white shadow-xl">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-7 py-6 text-white">
        <div className="flex items-center gap-2 font-mono text-sm font-medium tracking-tight text-slate-300">
          <span>GitHub Trending</span>
          {language && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs capitalize">
              {language}
            </span>
          )}
        </div>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{t(HEADING_KEY[since])}</h1>
        <p className="mt-1 text-sm text-slate-400">{dateStr}</p>
      </div>

      <div className="divide-y divide-slate-100 px-7 py-3">
        {top.map((r, i) => (
          <div key={r.fullName} className="flex items-start gap-3 py-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-sm font-bold text-slate-500">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[15px] font-semibold tracking-tight text-slate-900">
                {r.fullName}
              </div>
              {r.description && (
                <div className="mt-0.5 line-clamp-2 text-sm leading-snug text-slate-500">
                  {r.description}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-500">
                {r.language && (
                  <span className="flex items-center gap-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: r.languageColor || '#94a3b8' }}
                    />
                    {r.language}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star size={13} weight="fill" className="text-amber-500" />
                  {formatNum(r.stars)}
                </span>
                <span className="flex items-center gap-1">
                  <GitFork size={13} weight="bold" />
                  {formatNum(r.forks)}
                </span>
                {r.periodStars > 0 && (
                  <span className="font-mono font-medium text-emerald-600">
                    +{formatNum(r.periodStars)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-7 py-3 text-center font-mono text-xs text-slate-400">
        {t('cardFooter')}
      </div>
    </div>
  )
})

export default ShareCard
