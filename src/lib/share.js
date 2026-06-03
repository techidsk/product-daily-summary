// Social-share intent URLs. Each target builds a share link from a page URL + a
// bit of text. Facebook and LinkedIn ignore caller-supplied text (they scrape the
// page's Open Graph tags), so those builders use the URL only.

export const SITE = 'https://trending.magikaru.com'
export const SITE_DOMAIN = 'trending.magikaru.com'

const enc = encodeURIComponent

export const SHARE_TARGETS = [
  {
    key: 'x',
    label: 'X',
    build: ({ url, text }) => `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    build: ({ url }) => `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    build: ({ url }) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
  },
  {
    key: 'reddit',
    label: 'Reddit',
    build: ({ url, text }) => `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    build: ({ url, text }) => `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    build: ({ url, text }) => `https://wa.me/?text=${enc(`${text} ${url}`)}`,
  },
]

// Open an intent URL in a centred popup (falls back to a new tab on mobile).
export function openShare(href) {
  window.open(href, '_blank', 'noopener,noreferrer,width=600,height=640')
}

// Best-effort clipboard copy; returns true on success.
export async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}
