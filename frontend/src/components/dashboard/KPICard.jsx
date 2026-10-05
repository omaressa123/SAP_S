import { useEffect, useRef, useState } from 'react'
import Card from '../Card'
import AnimatedNumber from '../animations/AnimatedNumber'

/** KPI card: count-up value, subtle tick + icon motion on value change. */
export default function KPICard({ icon: Icon, label, value, sub, decimals = 0, suffix = '' }) {
  const [tick, setTick] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setTick(true)
      const t = setTimeout(() => setTick(false), 350)
      return () => clearTimeout(t)
    }
  }, [value])
  return (
    <Card className="lift" title={label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {Icon && (
          <span className="kpi-icon anim-fade-in" style={{ color: '#071739' }}>
            <Icon size={24} aria-hidden />
          </span>
        )}
        <span className={tick ? 'kpi-value tick' : 'kpi-value'} style={{ fontSize: '1.8rem', fontWeight: 800 }}>
          <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
        </span>
      </div>
      {sub && <div style={{ color: '#4a5a75', marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}
