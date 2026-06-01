import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import {
  Star,
  GitFork,
  ShareNetwork,
  DownloadSimple,
  X,
  ArrowsClockwise,
  Flame,
} from '@phosphor-icons/react'
import { fetchTrending } from './api/trending.js'
import { useI18n } from './i18n.jsx'
import ShareCard from './components/ShareCard.jsx'
import LanguageSwitcher from './components/LanguageSwitcher.jsx'

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

function RepoRow({ repo }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
    >
      <div className="mt-0.5 w-7 shrink-0 text-center font-mono text-sm font-bold text-slate-300">
        {repo.rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[15px] font-semibold tracking-tight text-slate-900">
          <span className="text-slate-400">{repo.owner}/</span>
          {repo.name}
        </div>
        {repo.description && (
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{repo.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: repo.languageColor || '#94a3b8' }}
              />
              {repo.language}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Star size={15} weight="fill" className="text-amber-500" />
            {formatNum(repo.stars)}
          </span>
          <span className="flex items-center gap-1.5">
            <GitFork size={15} weight="bold" />
            {formatNum(repo.forks)}
          </span>
          {repo.periodStars > 0 && (
            <span className="flex items-center gap-1.5 font-mono font-medium text-emerald-600">
              <Star size={15} weight="fill" className="text-emerald-600" />+
              {formatNum(repo.periodStars)}
            </span>
          )}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <ShareCard ref={cardRef} repos={repos} since={since} language={language} />
        <div className="flex gap-3">
          <button
            onClick={download}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-medium text-slate-900 shadow-lg transition hover:bg-slate-100 disabled:opacity-60"
          >
            <DownloadSimple size={18} weight="bold" />
            {busy ? t('generating') : t('download')}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 font-medium text-white backdrop-blur transition hover:bg-white/20"
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
  const { t } = useI18n()
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 shadow-sm">
              <Flame size={24} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">GitHub Trending</h1>
              <p className="text-sm text-slate-500">{t('subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={() => setSharing(true)}
              disabled={repos.length === 0}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              <ShareNetwork size={16} weight="bold" />
              <span className="hidden sm:inline">{t('share')}</span>
            </button>
          </div>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg bg-white p-1 shadow-sm">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setSince(p.key)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  since === p.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t(p.tk)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.value === '' ? t('allLanguages') : l.label}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:text-slate-900"
              title={t('refresh')}
            >
              <ArrowsClockwise size={16} weight="bold" className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {loading ? (
            <div className="px-5 py-20 text-center text-slate-400">{t('loading')}</div>
          ) : error ? (
            <div className="px-5 py-20 text-center">
              <p className="text-rose-500">
                {t('loadFailed')}
                {error}
              </p>
              <button
                onClick={load}
                className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
              >
                {t('retry')}
              </button>
            </div>
          ) : repos.length === 0 ? (
            <div className="px-5 py-20 text-center text-slate-400">{t('empty')}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {repos.map((r) => (
                <RepoRow key={r.fullName} repo={r} />
              ))}
            </div>
          )}
        </div>

        <footer className="mt-6 text-center font-mono text-xs text-slate-400">{t('footer')}</footer>
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
