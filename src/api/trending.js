export async function fetchTrending(since, language = '') {
  const params = new URLSearchParams({ since })
  if (language) params.set('language', language)
  const res = await fetch(`/api/trending?${params.toString()}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
  return data.repos || []
}

export async function fetchHistoryDates(since, language = '') {
  const params = new URLSearchParams({ since })
  if (language) params.set('language', language)
  const res = await fetch(`/api/history/dates?${params.toString()}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return []
  return data.dates || []
}

export async function fetchHistory(date, since, language = '') {
  const params = new URLSearchParams({ date, since })
  if (language) params.set('language', language)
  const res = await fetch(`/api/history?${params.toString()}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
  return data.repos || []
}
