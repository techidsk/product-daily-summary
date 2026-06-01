export async function fetchTrending(since, language = '') {
  const params = new URLSearchParams({ since })
  if (language) params.set('language', language)
  const res = await fetch(`/api/trending?${params.toString()}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`)
  return data.repos || []
}
