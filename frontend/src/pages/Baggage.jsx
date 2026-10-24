import { useState } from 'react'
import { Check, Circle, Luggage, MapPin, Radio, Search, ShieldCheck } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { api } from '../services/api'
import { AiModuleLayout, Pipeline, StatusBadge, KvGrid, EventTimeline } from '../components/ai/AiVisuals'

const JOURNEY = ['CHECK-IN', 'SECURITY SCAN', 'SORTING', 'LOADED', 'DELIVERED']
const JOURNEY_LABELS = ['Checked In', 'TSA Screened', 'Sortation', 'Loaded to Flight', 'On Carousel']

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
  const [recentSearches, setRecentSearches] = useState([])

  const trackBag = async (id = bagId) => {
    if (!id.trim()) return
    setBagId(id)
    setBusy(true)
    try {
      const out = await api(`/api/v1/baggage-tracking/history/${encodeURIComponent(id.trim())}`)
      setHistory(out)
      setError(null)
      setRecentSearches((previous) => [id.trim(), ...previous.filter((item) => item !== id.trim())].slice(0, 6))
    } catch (err) {
      setHistory(null)
      setError(err.message)
    } finally { setBusy(false) }
  }

  const track = (e) => {
    e.preventDefault()
    trackBag()
  }

  const timeline = history?.timeline || []
  const furthest = timeline.reduce((a, t) => Math.max(a, stageIndex(t.type)), 0)

  return (
    <div className="baggage-page">
      <AiModuleLayout
        icon={<Luggage size={22} />}
        title="Baggage Tracking — Bag Journey"
        description="Follow a bag checkpoint by checkpoint along its conveyor journey."
        aiStatus="online"
        systemNote="RFID + checkpoint logs"
        stats={history ? [
          { label: 'Bag', value: `#${history.bagId}`, sub: history.rfidTag },
          { label: 'Status', value: (history.currentStatus || '—').toUpperCase(), sub: history.currentLocation },
          { label: 'Weight', value: `${history.weightKg ?? '—'} kg`, sub: `${timeline.length} checkpoints` },
        ] : []}
      >
        <div className="baggage-layout">
          <Card className="ops-glass-card baggage-search-card">
            <div className="ops-card-heading">
              <div>
                <span className="ops-eyebrow">BAGGAGE SERVICES</span>
                <h2>Baggage ID Tracker</h2>
                <p>Search a tag to view its latest checkpoint.</p>
              </div>
              <span className="ops-heading-icon"><Search size={19} /></span>
            </div>
            <form className="ops-form baggage-search-form" onSubmit={track}>
              <label htmlFor="baggage-id">Bag ID</label>
              <div className="ops-input-wrap">
                <Luggage size={17} aria-hidden="true" />
                <input
                  id="baggage-id"
                  placeholder="e.g., BAG-8849-TRX"
                  value={bagId}
                  onChange={(e) => setBagId(e.target.value)}
                />
              </div>
              <Button className="ops-gradient-button">
                <Search size={16} aria-hidden="true" />
                {busy ? 'Tracking…' : 'Track baggage'}
              </Button>
            </form>
            {error && <p className="error ops-error" role="alert">{error}</p>}

            <div className="baggage-recent">
              <div className="baggage-section-title">
                <h3>Recent searches</h3>
                <span>{recentSearches.length ? `${recentSearches.length} saved` : 'Your searches'}</span>
              </div>
              {recentSearches.length ? (
                <div className="baggage-search-chips">
                  {recentSearches.map((id) => (
                    <button key={id} type="button" className="baggage-search-chip" onClick={() => trackBag(id)} disabled={busy}>
                      <Luggage size={14} /> {id}
                      {id === history?.bagId && <span className="baggage-chip-status">{history.currentStatus || 'Tracked'}</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ops-empty-note">Successfully tracked bag IDs will appear here for quick access.</p>
              )}
            </div>
          </Card>

          <Card className="ops-glass-card baggage-journey-card">
            <div className="ops-card-heading">
              <div>
                <span className="ops-eyebrow">LIVE TRACKING</span>
                <h2>Baggage Journey Log</h2>
                <p>{history ? `Bag ${history.bagId} · ${timeline.length} recorded checkpoints` : 'Checkpoint-by-checkpoint transit status'}</p>
              </div>
              <span className="baggage-live-indicator"><span /> {history ? 'TRACKING' : 'AWAITING BAG'}</span>
            </div>

            {history && (
              <div className="baggage-route-summary">
                <div className="baggage-suitcase-art"><Luggage size={33} /><span><Radio size={15} /></span></div>
                <div className="baggage-status-box">
                  <span>Transit status</span><strong>{history.currentStatus || 'Unknown'}</strong>
                  <span>Last checkpoint</span><strong>{history.currentLocation || '—'}</strong>
                  <span>RFID tag</span><strong>{history.rfidTag || '—'}</strong>
                </div>
              </div>
            )}

            {history ? (
              <div className="baggage-journey-list">
                {JOURNEY_LABELS.map((label, index) => {
                  const checkpoint = timeline.find((item) => stageIndex(item.type) === index)
                  const complete = index < furthest
                  const active = index === furthest && timeline.length > 0
                  return (
                    <div className={`baggage-journey-step ${complete ? 'is-complete' : ''} ${active ? 'is-active' : ''}`} key={label}>
                      <span className="baggage-journey-marker">{complete ? <Check size={13} /> : active ? <span /> : <Circle size={10} />}</span>
                      <div>
                        <strong>{label}</strong>
                        <span>{checkpoint?.location || (active ? history.currentLocation || 'Current checkpoint' : 'Pending')}</span>
                        {checkpoint?.time && <time>{checkpoint.time}</time>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="baggage-journey-list baggage-journey-empty">
                {JOURNEY_LABELS.map((label, index) => (
                  <div className="baggage-journey-step" key={label}>
                    <span className="baggage-journey-marker"><Circle size={10} /></span>
                    <div>
                      <strong>{label}</strong>
                      <span>{index === 0 ? 'Search a bag to begin tracking' : 'Waiting for bag scan'}</span>
                    </div>
                  </div>
                ))}
                <div className="baggage-empty-help"><MapPin size={15} /> Live checkpoints will appear as the bag moves through the airport.</div>
              </div>
            )}
          </Card>
        </div>

        {history && (
          <>
            <div className="baggage-pipeline"><Pipeline stages={JOURNEY} activeIndex={Math.min(furthest + 1, JOURNEY.length)} failedIndex={-1} /></div>
            <div className="ai-grid-2 baggage-history-details">
              <Card className="ops-glass-card">
              <KvGrid items={[
                { k: 'Bag ID', v: history.bagId },
                { k: 'RFID', v: history.rfidTag },
                { k: 'Current status', v: history.currentStatus },
                { k: 'Current location', v: history.currentLocation },
                { k: 'Weight', v: `${history.weightKg} kg` },
              ]} />
              <p style={{ marginTop: 8 }}><StatusBadge tone="good">{(history.currentStatus || 'TRACKED').toUpperCase()}</StatusBadge></p>
              </Card>
              <Card className="ops-glass-card">
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
    </div>
  )
}
