import Card from '../Card'

const CLASS = {
  scheduled: 'scheduled', boarding: 'boarding', departed: 'departed',
  delayed: 'delayed', cancelled: 'cancelled',
}

/** Active flights with honest per-status animation. Real backend rows only. */
export default function FlightStrip({ flights = [] }) {
  if (!flights.length) return null
  return (
    <Card className="lift" title="Active Flights">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {flights.slice(0, 8).map((f) => {
          const s = String(f.status || 'scheduled').toLowerCase()
          return (
            <span key={f.flight_id} className={`flight-pill ${CLASS[s] || 'scheduled'}`} title={`Flight ${f.flight_number} — ${f.status}`}>
              {s === 'cancelled' && <span className="status-dot offline" aria-hidden />}
              {s === 'departed' && <span aria-hidden>✓</span>}
              <span>{f.flight_number}</span>
              {s === 'boarding' && <span className="bar" aria-hidden />}
              <span style={{ opacity: 0.75 }}>{f.status}</span>
            </span>
          )
        })}
      </div>
    </Card>
  )
}
