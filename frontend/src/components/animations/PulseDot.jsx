const MAP = {
  online: 'online', ok: 'online', operational: 'online', active: 'online',
  warning: 'warning', degraded: 'warning', medium: 'warning',
  offline: 'offline', down: 'offline', critical: 'offline', high: 'offline',
}

/** Animated status indicator. `status` uses real backend values; unknown -> gray. */
export default function PulseDot({ status = '', pulse = true, label }) {
  const key = MAP[String(status).toLowerCase()] || ''
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={`status-dot ${key}${pulse ? ' pulse' : ''}`} aria-hidden />
      {label && <span>{label}</span>}
    </span>
  )
}
