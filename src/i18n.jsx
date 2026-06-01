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
    share: '分享卡片',
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
  },
  en: {
    subtitle: 'Daily / Weekly / Monthly trending digest',
    share: 'Share card',
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
  },
  ja: {
    subtitle: '毎日・毎週・毎月のトレンドまとめ',
    share: 'シェアカード',
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
