import { useState } from 'react'
import { Luggage } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { api } from '../services/api'
import { AiModuleLayout, Pipeline, StatusBadge, KvGrid, EventTimeline } from '../components/ai/AiVisuals'

const JOURNEY = ['CHECK-IN', 'SECURITY SCAN', 'SORTING', 'LOADED', 'DELIVERED']

function stageIndex(type = '') {
  const t = type.toLowerCase()
  if (/deliver|claim|arriv/.test(t)) return 4
  if (/load|aircraft|cargo/.test(t)) return 3
  if (/sort|conveyor/.test(t)) return 2
  if (/secur|scan/.test(t)) return 1
  return 0
}

export default function Baggage() {
  const [bagId, setBagId] = useState('')
  const [history, setHistory] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const track = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const out = await api(`/api/v1/baggage-tracking/history/${bagId}`)
      setHistory(out)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  const timeline = history?.timeline || []
  const furthest = timeline.reduce((a, t) => Math.max(a, stageIndex(t.type)), 0)

  return (
    <AiModuleLayout
      icon={<Luggage size={22} />}
      title="Baggage Tracking — Bag Journey"
      description="Follow a bag checkpoint by checkpoint along the conveyor journey, rendered from the live tracking API."
      aiStatus="online"
      systemNote="RFID + checkpoint logs"
      stats={history ? [
        { label: 'Bag', value: `#${history.bagId}`, sub: history.rfidTag },
        { label: 'Status', value: (history.currentStatus || '—').toUpperCase(), sub: history.currentLocation },
        { label: 'Weight', value: `${history.weightKg ?? '—'} kg`, sub: `${timeline.length} checkpoints` },
      ] : []}
    >
      <Card title="Track bag">
        <form onSubmit={track}>
          <input placeholder="Bag ID" value={bagId} onChange={(e) => setBagId(e.target.value)} />
          <Button>{busy ? 'Tracking…' : 'Track'}</Button>
        </form>
        {error && <p className="error">{error}</p>}
      </Card>

      {history && (
        <>
          <Pipeline stages={JOURNEY} activeIndex={Math.min(furthest + 1, JOURNEY.length)} failedIndex={-1} />
          <div className="ai-grid-2">
            <Card title="Journey progress">
              <KvGrid items={[
                { k: 'Bag ID', v: history.bagId },
                { k: 'RFID', v: history.rfidTag },
                { k: 'Current status', v: history.currentStatus },
                { k: 'Current location', v: history.currentLocation },
                { k: 'Weight', v: `${history.weightKg} kg` },
              ]} />
              <p style={{ marginTop: 8 }}><StatusBadge tone="good">{(history.currentStatus || 'TRACKED').toUpperCase()}</StatusBadge></p>
            </Card>
            <Card title="Checkpoint timeline">
              <EventTimeline
                emptyHint="No checkpoints for this bag."
                events={timeline.map((t) => ({
                  title: t.type?.replace(/_/g, ' ').toUpperCase(), detail: t.location, time: t.time,
                  severity: 'low', badge: '✓', tone: 'good',
                }))}
              />
            </Card>
          </div>
        </>
      )}
    </AiModuleLayout>
  )
}
