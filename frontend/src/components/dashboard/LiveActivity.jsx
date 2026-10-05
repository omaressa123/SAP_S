import { useEffect, useState } from 'react'
import Card from '../Card'
import PulseDot from '../animations/PulseDot'
import { api } from '../../services/api'

function fmt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleTimeString()
}

/** Live operations feed built ONLY from existing report endpoints.
 *  Polls every 15s; new items slide+fade in. Empty -> honest empty state. */
export default function LiveActivity() {
  const [items, setItems] = useState([])
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [ops, bag] = await Promise.all([
          api('/api/v1/reports/operations'),
          api('/api/v1/reports/baggage'),
        ])
        if (cancelled) return
        const events = []
        for (const a of (ops.alerts || []).slice(0, 5)) {
          events.push({
            id: `alert-${a.alert_id}`, ts: a.timestamp,
            text: `Monitoring: ${a.behavior_type} (${a.severity})`,
            status: a.severity,
          })
        }
        for (const e of (ops.emergencies || []).slice(0, 4)) {
          events.push({
            id: `emg-${e.event_id}`, ts: e.detected_time,
            text: `Emergency: ${e.event_type} — ${e.status}`,
            status: e.status === 'resolved' ? 'online' : 'critical',
          })
        }
        for (const i of (bag.recent_inspections || []).slice(0, 4)) {
          events.push({
            id: `insp-${i.inspection_id}`, ts: i.scan_time,
            text: `Bag ${i.bag_id} inspection: ${i.result}`,
            status: i.result === 'SAFE' ? 'online' : 'warning',
          })
        }
        events.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
        setItems(events.slice(0, 9))
        setEmpty(events.length === 0)
      } catch {
        if (!cancelled) setEmpty(true)
      }
    }
    load()
    const t = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  return (
    <Card className="lift" title="Live Operations Feed">
      {!items.length ? (
        <p>{empty ? 'No recent activity — events from monitoring, baggage AI and emergencies will appear here.' : 'Listening for airport events…'}</p>
      ) : (
        <div>
          {items.map((it) => (
            <div className="live-item" key={it.id}>
              <PulseDot status={it.status} />
              <div style={{ flex: 1 }}>{it.text}</div>
              <span className="live-time">{fmt(it.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
