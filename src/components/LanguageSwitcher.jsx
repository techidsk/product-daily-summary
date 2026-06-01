import { useEffect, useRef, useState } from 'react'
import { Translate, CaretDown, Check } from '@phosphor-icons/react'
import { useI18n, LANG_OPTIONS } from '../i18n.jsx'

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const current = LANG_OPTIONS.find((o) => o.value === lang)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-sm border border-ink/20 bg-transparent px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-ink/40 hover:bg-paper-2"
      >
        <Translate size={16} weight="bold" />
        <span>{current?.label}</span>
        <CaretDown size={12} weight="bold" className={open ? 'rotate-180 transition' : 'transition'} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-36 overflow-hidden rounded-sm border border-line bg-paper py-1 shadow-xl">
          {LANG_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                setLang(o.value)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-sm transition hover:bg-paper-2 ${
                o.value === lang ? 'font-semibold text-ink' : 'text-muted'
              }`}
            >
              {o.label}
              {o.value === lang && <Check size={15} weight="bold" className="text-vermilion" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
