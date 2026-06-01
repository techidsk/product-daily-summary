import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import {
  Star,
  GitFork,
  ShareNetwork,
  DownloadSimple,
  X,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import { fetchTrending } from './api/trending.js'
import { useI18n } from './i18n.jsx'
import ShareCard from './components/ShareCard.jsx'
import LanguageSwitcher from './components/LanguageSwitcher.jsx'
import AdSlot from './components/AdSlot.jsx'

const PERIODS = [
  { key: 'daily', tk: 'periodDaily' },
  { key: 'weekly', tk: 'periodWeekly' },
  { key: 'monthly', tk: 'periodMonthly' },
]

const LANGUAGES = [
  { value: '', label: 'allLanguages' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'c++', label: 'C++' },
]

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

function RepoRow({ repo, index }) {
  const top = repo.rank <= 3
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noreferrer"
      className="rise group relative flex gap-5 border-t border-line-soft py-6 pl-4 transition-colors first:border-t-0 hover:bg-paper-2/70"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      {/* hover marginalia bar */}
      <span className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-0 bg-vermilion transition-transform duration-300 group-hover:scale-y-100" />

      <div
        className={`w-12 shrink-0 text-right font-display text-4xl font-light leading-none tabular-nums sm:text-5xl ${
          top ? 'text-vermilion' : 'text-muted/70'
        }`}
      >
        {String(repo.rank).padStart(2, '0')}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="truncate font-mono text-base font-semibold tracking-tight text-ink sm:text-lg">
            <span className="text-muted">{repo.owner}/</span>
            {repo.name}
          </h3>
          {repo.periodStars > 0 && (
            <span className="shrink-0 whitespace-nowrap font-display text-lg font-medium text-vermilion sm:text-xl">
              +{formatNum(repo.periodStars)}
              <span className="ml-0.5 align-text-top text-xs">★</span>
            </span>
          )}
        </div>

        {repo.description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {repo.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-muted">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: repo.languageColor || '#94a3b8' }}
              />
              {repo.language}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Star size={13} weight="fill" className="text-amber-500" />
            {formatNum(repo.stars)}
          </span>
          <span className="flex items-center gap-1.5">
            <GitFork size={13} weight="bold" />
            {formatNum(repo.forks)}
          </span>
        </div>
      </div>
    </a>
  )
}

function ShareModal({ repos, since, language, onClose }) {
  const { t } = useI18n()
  const cardRef = useRef(null)
  const [busy, setBusy] = useState(false)

  async function download() {
    if (!cardRef.current) return
    setBusy(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.download = `github-trending-${since}.png`
      a.href = dataUrl
      a.click()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <ShareCard ref={cardRef} repos={repos} since={since} language={language} />
        <div className="flex gap-3">
          <button
            onClick={download}
            disabled={busy}
            className="flex items-center gap-2 rounded-sm bg-paper px-5 py-2.5 font-medium text-ink shadow-lg transition hover:bg-paper-2 disabled:opacity-60"
          >
            <DownloadSimple size={18} weight="bold" />
            {busy ? t('generating') : t('download')}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-sm bg-white/10 px-4 py-2.5 font-medium text-paper backdrop-blur transition hover:bg-white/20"
          >
            <X size={18} weight="bold" />
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { t, locale } = useI18n()
  const [since, setSince] = useState('daily')
  const [language, setLanguage] = useState('')
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sharing, setSharing] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRepos(await fetchTrending(since, language))
    } catch (e) {
      setError(e.message)
      setRepos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since, language])

  const dateline = new Date().toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="grain relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14">
        {/* ───────────────── Masthead ───────────────── */}
        <header className="rise">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="flex items-baseline gap-2.5 font-mono uppercase">
                <span className="text-sm font-bold tracking-[0.42em] text-vermilion">GitHub</span>
                <span className="text-muted/50">·</span>
                <span className="text-[11px] tracking-[0.28em] text-muted">{t('kicker')}</span>
              </div>
              <h1
                className="-mt-1 font-display text-7xl font-light italic leading-[0.9] tracking-tight text-ink sm:text-8xl"
                style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 1' }}
              >
                Trending
              </h1>
            </div>
            <div className="flex items-center gap-2.5 pb-1">
              <LanguageSwitcher />
              <button
                onClick={() => setSharing(true)}
                disabled={repos.length === 0}
                className="flex items-center gap-2 rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-vermilion-deep disabled:opacity-40"
              >
                <ShareNetwork size={16} weight="bold" />
                <span className="hidden sm:inline">{t('share')}</span>
              </button>
            </div>
          </div>

          {/* double rule + dateline */}
          <div className="mt-6 border-t-2 border-ink" />
          <div className="mt-1 flex items-center justify-between border-t border-line pt-2 font-mono text-[11px] uppercase tracking-widest text-muted">
            <span>{dateline}</span>
            <span className="hidden sm:inline">{t('subtitle')}</span>
          </div>
        </header>

        {/* ───────────────── Body: feed + ad rail ───────────────── */}
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_300px]">
          <main>
            {/* controls */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-end gap-6">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSince(p.key)}
                    className={`relative pb-1.5 font-display text-xl tracking-tight transition-colors ${
                      since === p.key
                        ? 'font-semibold text-ink'
                        : 'font-normal text-muted hover:text-ink-soft'
                    }`}
                  >
                    {t(p.tk)}
                    {since === p.key && (
                      <span className="absolute -bottom-px left-0 h-[3px] w-full bg-vermilion" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="cursor-pointer border-b border-ink/30 bg-transparent py-1 pr-6 font-mono text-xs uppercase tracking-wider text-ink-soft focus:border-vermilion focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.value === '' ? t('allLanguages') : l.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={load}
                  className="text-muted transition hover:text-vermilion"
                  title={t('refresh')}
                  aria-label={t('refresh')}
                >
                  <ArrowsClockwise size={16} weight="bold" className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* feed */}
            <div className="mt-2">
              {loading ? (
                <div className="py-24 text-center font-mono text-sm text-muted">{t('loading')}</div>
              ) : error ? (
                <div className="py-24 text-center">
                  <p className="font-mono text-sm text-vermilion">
                    {t('loadFailed')}
                    {error}
                  </p>
                  <button
                    onClick={load}
                    className="mt-4 rounded-sm bg-ink px-4 py-2 text-sm text-paper"
                  >
                    {t('retry')}
                  </button>
                </div>
              ) : repos.length === 0 ? (
                <div className="py-24 text-center font-mono text-sm text-muted">{t('empty')}</div>
              ) : (
                <div>
                  {repos.map((r, i) => (
                    <RepoRow key={r.fullName} repo={r} index={i} />
                  ))}
                </div>
              )}
            </div>

            {/* in-feed ad fallback for narrow screens (rail is hidden < lg) */}
            <div className="mt-8 lg:hidden">
              <AdSlot width={320} height={100} slot="infeed-mobile" />
            </div>
          </main>

          {/* sticky ad rail */}
          <aside className="hidden lg:block">
            <div className="sticky top-10 space-y-6">
              <AdSlot width={300} height={600} slot="rail-halfpage" />
              <AdSlot width={300} height={250} slot="rail-rectangle" />
            </div>
          </aside>
        </div>

        <footer className="mt-14 border-t border-line pt-4 text-center font-mono text-[11px] uppercase tracking-widest text-muted">
          {t('footer')}
        </footer>
      </div>

      {sharing && (
        <ShareModal
          repos={repos}
          since={since}
          language={language}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  )
}
