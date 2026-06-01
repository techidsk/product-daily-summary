import { useEffect, useMemo, useRef, useState } from 'react'
import { CaretLeft, CaretRight, CalendarBlank, X } from '@phosphor-icons/react'
import { useI18n } from '../i18n.jsx'

// 'YYYY-MM-DD' helpers that never touch a Date object's timezone.
const pad = (n) => String(n).padStart(2, '0')
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}` // m is 0-based
const todayKey = () => new Date().toISOString().slice(0, 10)

function monthMatrix(year, month) {
  // 6 weeks × 7 days, Monday-first, with leading/trailing nulls.
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7 // 0 = Monday
  const days = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/**
 * Archive calendar popover.
 * @param {string[]} availableDates  'YYYY-MM-DD' dates that have a snapshot
 * @param {string}   selected        '' = live/latest, else the picked date
 * @param {(date: string) => void} onSelect
 * @param {() => void} onClear        reset to live/latest
 */
export default function Calendar({ availableDates, selected, onSelect, onClear }) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const have = useMemo(() => new Set(availableDates), [availableDates])

  // Where to start the visible month: selected → most recent archived → today.
  const anchor = selected || availableDates[0] || todayKey()
  const [view, setView] = useState(() => {
    const [y, m] = anchor.split('-').map(Number)
    return { year: y, month: m - 1 }
  })

  // Re-anchor when the period/lang change swaps out the available dates.
  useEffect(() => {
    const [y, m] = (selected || availableDates[0] || todayKey()).split('-').map(Number)
    setView({ year: y, month: m - 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, availableDates[0]])

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
  })

  // Localized Monday-first weekday initials.
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i))) // Jan 1 2024 = Monday
  }, [locale])

  const cells = useMemo(() => monthMatrix(view.year, view.month), [view])

  const shiftMonth = (delta) =>
    setView(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  const triggerLabel = selected || t('archiveLatest')
  const today = todayKey()

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={t('archivePrefix')}
        className={`flex items-center gap-1.5 border-b py-1 pr-1 font-mono text-xs uppercase tracking-wider transition focus:outline-none ${
          selected
            ? 'border-vermilion text-vermilion'
            : 'border-ink/30 text-ink-soft hover:text-ink'
        }`}
      >
        <CalendarBlank size={14} weight={selected ? 'fill' : 'regular'} />
        {triggerLabel}
        {selected && (
          <X
            size={13}
            weight="bold"
            className="ml-0.5 rounded-full text-vermilion/70 transition hover:text-vermilion"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
              setOpen(false)
            }}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[19rem] rounded-sm border border-line bg-paper p-3 shadow-xl">
          {/* month nav */}
          <div className="flex items-center justify-between px-1 pb-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="rounded-sm p-1 text-muted transition hover:bg-paper-2 hover:text-ink"
              aria-label="prev month"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <span className="font-display text-base font-medium text-ink">{monthLabel}</span>
            <button
              onClick={() => shiftMonth(1)}
              className="rounded-sm p-1 text-muted transition hover:bg-paper-2 hover:text-ink"
              aria-label="next month"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>

          {/* weekday header */}
          <div className="grid grid-cols-7 gap-0.5 border-t border-line-soft pt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
            {weekdays.map((w, i) => (
              <div key={i} className="py-1 text-center">
                {w}
              </div>
            ))}
          </div>

          {/* day grid */}
          <div className="mt-0.5 grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />
              const k = key(view.year, view.month, d)
              const hasData = have.has(k)
              const isSelected = selected === k
              const isToday = k === today
              return (
                <button
                  key={i}
                  disabled={!hasData}
                  onClick={() => {
                    onSelect(k)
                    setOpen(false)
                  }}
                  title={hasData ? k : t('calNoData')}
                  className={[
                    'relative flex h-9 items-center justify-center rounded-sm font-mono text-xs tabular-nums transition',
                    isSelected
                      ? 'bg-vermilion font-semibold text-paper'
                      : hasData
                        ? 'font-medium text-ink hover:bg-vermilion/10 hover:text-vermilion'
                        : 'cursor-default text-muted/35',
                  ].join(' ')}
                >
                  {d}
                  {/* data dot */}
                  {hasData && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-vermilion" />
                  )}
                  {/* today ring */}
                  {isToday && !isSelected && (
                    <span className="pointer-events-none absolute inset-0.5 rounded-sm ring-1 ring-ink/25" />
                  )}
                </button>
              )
            })}
          </div>

          {/* footer: live reset + count */}
          <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2">
            <button
              onClick={() => {
                onClear()
                setOpen(false)
              }}
              className={`font-mono text-[11px] uppercase tracking-wider transition ${
                selected ? 'text-ink-soft hover:text-vermilion' : 'font-semibold text-vermilion'
              }`}
            >
              ◷ {t('archiveLatest')}
            </button>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {availableDates.length} {t('calArchivedDays')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
