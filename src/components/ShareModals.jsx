import { useLayoutEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import {
  DownloadSimple,
  X,
  Check,
  LinkSimple,
  ShareNetwork,
  XLogo,
  FacebookLogo,
  LinkedinLogo,
  RedditLogo,
  TelegramLogo,
  WhatsappLogo,
} from '@phosphor-icons/react'
import { useI18n } from '../i18n.jsx'
import { SHARE_TARGETS, SITE, openShare, copyLink } from '../lib/share.js'
import ShareCard from './ShareCard.jsx'
import RepoShareCard from './RepoShareCard.jsx'

const TARGET_ICONS = {
  x: XLogo,
  facebook: FacebookLogo,
  linkedin: LinkedinLogo,
  reddit: RedditLogo,
  telegram: TelegramLogo,
  whatsapp: WhatsappLogo,
}

// Row of social-share buttons shown beneath the card preview. `url` is the page
// being shared; `text` is the accompanying caption (used where the network
// supports it). On phones with the Web Share API we also offer the native sheet,
// which reaches apps that have no web intent (Instagram, WeChat, etc.).
function SocialShareRow({ url, text }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function onCopy() {
    if (await copyLink(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  async function onNative() {
    try {
      await navigator.share({ text, url })
    } catch {
      /* user cancelled */
    }
  }

  const btn =
    'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur transition hover:bg-white/20 hover:text-vermilion'

  return (
    <div className="flex flex-col items-center gap-2.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-paper/60">
        {t('shareVia')}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {SHARE_TARGETS.map((target) => {
          const Icon = TARGET_ICONS[target.key]
          return (
            <button
              key={target.key}
              onClick={() => openShare(target.build({ url, text }))}
              className={btn}
              title={target.label}
              aria-label={target.label}
            >
              <Icon size={18} weight="fill" />
            </button>
          )
        })}
        <button onClick={onCopy} className={btn} title={t('copyLink')} aria-label={t('copyLink')}>
          {copied ? <Check size={18} weight="bold" /> : <LinkSimple size={18} weight="bold" />}
        </button>
        {canNative && (
          <button
            onClick={onNative}
            className={btn}
            title={t('shareNative')}
            aria-label={t('shareNative')}
          >
            <ShareNetwork size={18} weight="bold" />
          </button>
        )}
      </div>
    </div>
  )
}

// The share cards render at a fixed 480px so the exported PNG is crisp and
// consistent. On phones narrower than that the preview would overflow the
// modal, so we shrink it with CSS `zoom` to fit the viewport. zoom scales the
// layout box too (unlike transform), keeping the card centred and the buttons
// snug beneath it. The ref'd card itself stays 480px, so toPng output is
// unaffected.
function FitToViewport({ width, children }) {
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const compute = () => setScale(Math.min(1, (window.innerWidth - 32) / width))
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [width])
  return <div style={{ zoom: scale }}>{children}</div>
}

export function ShareModal({ repos, since, language, onClose }) {
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
        <FitToViewport width={480}>
          <ShareCard ref={cardRef} repos={repos} since={since} language={language} />
        </FitToViewport>
        <SocialShareRow
          url={SITE}
          text={t(`cardHeading${since.charAt(0).toUpperCase()}${since.slice(1)}`)}
        />
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

export function RepoShareModal({ repo, since, onClose }) {
  const { t } = useI18n()
  const cardRef = useRef(null)
  const [busy, setBusy] = useState(false)

  async function download() {
    if (!cardRef.current) return
    setBusy(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.download = `github-trending-${repo.owner}-${repo.name}.png`
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
        <FitToViewport width={480}>
          <RepoShareCard ref={cardRef} repo={repo} since={since} />
        </FitToViewport>
        <SocialShareRow url={repo.url} text={`${repo.fullName} ${t('trendingOnGitHub')}`} />
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
