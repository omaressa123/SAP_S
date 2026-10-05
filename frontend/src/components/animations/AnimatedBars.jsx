import { useEffect, useState } from 'react'
import AnimatedNumber from './AnimatedNumber'

/** Bars grow from zero (scaleX) with stagger; values count up. Real rows only. */
export default function AnimatedBars({ rows = [], labelKey = 'label', valueKey = 'count' }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)))
    return () => cancelAnimationFrame(t)
  }, [])
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0))
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 64px', gap: 8, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(r[labelKey])}</span>
          <div style={{ background: '#eef0fa', borderRadius: 8, height: 14, overflow: 'hidden' }}>
            <div
              className={`anim-bar-fill${grown ? ' grown' : ''}`}
              style={{
                width: `${(100 * (Number(r[valueKey]) || 0)) / max}%`,
                height: '100%', borderRadius: 8,
                background: 'linear-gradient(90deg, #071739, #E3C39D)',
                '--anim-delay': `${i * 90}ms`,
              }}
            />
          </div>
          <span style={{ textAlign: 'right' }}><AnimatedNumber value={Number(r[valueKey]) || 0} duration={500} /></span>
        </div>
      ))}
    </div>
  )
}
