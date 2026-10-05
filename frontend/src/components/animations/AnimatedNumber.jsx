import { useEffect, useRef, useState } from 'react'

const REDUCED = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Smoothly transitions old value -> new value (~600ms, ease-out, rAF).
 *  Null/NaN-safe: renders fallback until a finite number arrives. */
export default function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  duration = 600,
  fallback = '—',
}) {
  const target = Number(value)
  const valid = Number.isFinite(target)
  const [display, setDisplay] = useState(valid ? 0 : null)
  const fromRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!valid) { setDisplay(null); return }
    if (REDUCED()) { setDisplay(target); fromRef.current = target; return }
    const from = fromRef.current
    if (from === target) { setDisplay(target); return }
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (target - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [valid, target, duration])

  if (display === null || !Number.isFinite(display)) return <span>{fallback}</span>
  return (
    <span className="kpi-value">
      {prefix}{display.toLocaleString(undefined, {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      })}{suffix}
    </span>
  )
}
