import { createContext, useContext, useEffect, useState } from 'react'

export const LOCALES = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' }

export const LANG_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

const translations = {
  zh: {
    subtitle: '每日 / 每周 / 每月 热门项目汇总',
    kicker: '每日开源精选',
    adLabel: '赞助',
    archiveLatest: '最新',
    archivePrefix: '存档',
    calNoData: '当天暂无数据',
    calArchivedDays: '天存档',
    share: '分享卡片',
    shareRepo: '分享此项目',
    periodDaily: '每日',
    periodWeekly: '每周',
    periodMonthly: '每月',
    allLanguages: '全部语言',
    refresh: '刷新',
    loading: '加载中…',
    loadFailed: '加载失败：',
    retry: '重试',
    empty: '暂无数据',
    footer: '数据来自 github.com/trending · 服务端抓取',
    download: '下载 PNG',
    generating: '生成中…',
    close: '关闭',
    cardHeadingDaily: '今日最热开源项目',
    cardHeadingWeekly: '本周最热开源项目',
    cardHeadingMonthly: '本月最热开源项目',
    cardFooter: 'github.com/trending · 每日汇总',
    introHeading: '关于本榜单',
    introBody:
      '本站每天自动抓取 GitHub Trending，把最受关注的开源项目整理成易读的每日 / 每周 / 每月排行。GitHub 官方榜单只显示当天，过去的排名一旦滚动便难以找回；我们为每一天保存快照并长期归档，让你能回看开源世界的演变趋势，也能一键把当日 Top 5 导出为分享卡片。',
    faqHeading: '常见问题',
    faqQ1: '数据多久更新一次？',
    faqA1: '榜单通过定时任务每隔数小时自动抓取一次，确保接近 GitHub 官方 Trending 的实时排名。',
    faqQ2: '历史数据从哪里来？',
    faqA2: 'GitHub 只显示当天榜单，更早的日期由 Internet Archive（Wayback Machine）公开存档回填。日历中高亮的即为已归档、可回看的日期。',
    faqQ3: '可以按编程语言筛选吗？',
    faqA3: '可以。支持 JavaScript、TypeScript、Python、Go、Rust、Java、C++ 等主流语言，切换后排行会随之更新。',
    navAbout: '关于',
    navPrivacy: '隐私政策',
    navContact: '联系我们',
  },
  en: {
    subtitle: 'Daily / Weekly / Monthly trending digest',
    kicker: 'Daily Open Source',
    adLabel: 'Sponsored',
    archiveLatest: 'Latest',
    archivePrefix: 'Archive',
    calNoData: 'No data for this day',
    calArchivedDays: 'days archived',
    share: 'Share card',
    shareRepo: 'Share this repo',
    periodDaily: 'Daily',
    periodWeekly: 'Weekly',
    periodMonthly: 'Monthly',
    allLanguages: 'All languages',
    refresh: 'Refresh',
    loading: 'Loading…',
    loadFailed: 'Failed to load: ',
    retry: 'Retry',
    empty: 'No data',
    footer: 'Data from github.com/trending · server-side fetch',
    download: 'Download PNG',
    generating: 'Generating…',
    close: 'Close',
    cardHeadingDaily: "Today's Hottest Repos",
    cardHeadingWeekly: "This Week's Hottest Repos",
    cardHeadingMonthly: "This Month's Hottest Repos",
    cardFooter: 'github.com/trending · Daily Digest',
    introHeading: 'About this ranking',
    introBody:
      'This site collects GitHub Trending every day and organizes the most-starred open-source projects into a readable daily / weekly / monthly ranking. GitHub only shows the current day — once the list scrolls, the past is gone. We snapshot every day and archive it, so you can look back at how open-source trends evolved and export the daily Top 5 as a share card.',
    faqHeading: 'Frequently asked questions',
    faqQ1: 'How often is the data updated?',
    faqA1: 'A scheduled job fetches the rankings every few hours, keeping the list close to GitHub’s live Trending page.',
    faqQ2: 'Where does the historical data come from?',
    faqA2: 'GitHub only shows the current day; earlier days are backfilled from the Internet Archive (Wayback Machine). Highlighted dates in the calendar are the archived days you can revisit.',
    faqQ3: 'Can I filter by programming language?',
    faqA3: 'Yes — JavaScript, TypeScript, Python, Go, Rust, Java, C++ and more. The ranking updates when you switch languages.',
    navAbout: 'About',
    navPrivacy: 'Privacy',
    navContact: 'Contact',
  },
  ja: {
    subtitle: '毎日・毎週・毎月のトレンドまとめ',
    kicker: '毎日のオープンソース',
    adLabel: 'スポンサー',
    archiveLatest: '最新',
    archivePrefix: 'アーカイブ',
    calNoData: 'この日のデータなし',
    calArchivedDays: '日分',
    share: 'シェアカード',
    shareRepo: 'このリポジトリを共有',
    periodDaily: '毎日',
    periodWeekly: '毎週',
    periodMonthly: '毎月',
    allLanguages: 'すべての言語',
    refresh: '更新',
    loading: '読み込み中…',
    loadFailed: '読み込み失敗：',
    retry: '再試行',
    empty: 'データなし',
    footer: 'データ元 github.com/trending・サーバー取得',
    download: 'PNG を保存',
    generating: '生成中…',
    close: '閉じる',
    cardHeadingDaily: '本日の人気リポジトリ',
    cardHeadingWeekly: '今週の人気リポジトリ',
    cardHeadingMonthly: '今月の人気リポジトリ',
    cardFooter: 'github.com/trending・デイリーまとめ',
    introHeading: 'このランキングについて',
    introBody:
      '本サイトは毎日 GitHub Trending を取得し、最も注目されているオープンソースプロジェクトを毎日・毎週・毎月のランキングにまとめています。GitHub 公式は当日分しか表示されず、過去の順位は流れると追えません。本サイトは毎日のスナップショットを保存・アーカイブし、トレンドの変遷を振り返れるほか、当日 Top 5 をシェアカードとして書き出せます。',
    faqHeading: 'よくある質問',
    faqQ1: 'データの更新頻度は？',
    faqA1: '定期ジョブが数時間ごとに取得し、GitHub 公式 Trending に近いランキングを保ちます。',
    faqQ2: '過去のデータはどこから？',
    faqA2: 'GitHub は当日分のみ表示するため、過去の日付は Internet Archive（Wayback Machine）の公開アーカイブから補完しています。カレンダーで強調された日付が閲覧可能なアーカイブ日です。',
    faqQ3: 'プログラミング言語で絞り込めますか？',
    faqA3: 'はい。JavaScript・TypeScript・Python・Go・Rust・Java・C++ などに対応し、切り替えるとランキングが更新されます。',
    navAbout: '概要',
    navPrivacy: 'プライバシー',
    navContact: 'お問い合わせ',
  },
}

function detectLang() {
  try {
    const stored = localStorage.getItem('lang')
    if (stored && translations[stored]) return stored
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || 'en').toLowerCase()
  if (nav.startsWith('zh')) return 'zh'
  if (nav.startsWith('ja')) return 'ja'
  return 'en'
}

const LangContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)

  const setLang = (l) => {
    try {
      localStorage.setItem('lang', l)
    } catch {
      /* ignore */
    }
    setLangState(l)
  }

  useEffect(() => {
    document.documentElement.lang = LOCALES[lang]
  }, [lang])

  const t = (key) => translations[lang][key] ?? translations.en[key] ?? key

  return (
    <LangContext.Provider value={{ lang, setLang, t, locale: LOCALES[lang] }}>
      {children}
    </LangContext.Provider>
  )
}

export function useI18n() {
  return useContext(LangContext)
}
