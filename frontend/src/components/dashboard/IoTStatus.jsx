import Card from '../Card'
import PulseDot from '../animations/PulseDot'

/** Device/module status list from /reports/iot. Real values only. */
export default function IoTStatus({ byStatus = [], devices = [] }) {
  const online = byStatus.find((r) => /online|operational|ok/i.test(r.status))?.count ?? 0
  const warn = byStatus.filter((r) => /warning|degraded/i.test(r.status)).reduce((s, r) => s + r.count, 0)
  const off = byStatus.filter((r) => /offline|down|fault/i.test(r.status)).reduce((s, r) => s + r.count, 0)
  return (
    <Card className="lift" title="IoT Status">
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <PulseDot status="online" label={`Online · ${online}`} />
          <PulseDot status="warning" label={`Warning · ${warn}`} />
          <PulseDot status="offline" label={`Offline · ${off}`} />
        </div>
        {devices.slice(0, 6).map((d, i) => (
          <div key={d.equipment_id ?? i} className="anim-fade-in" style={{ display: 'flex', gap: 8, alignItems: 'center', '--anim-delay': `${i * 60}ms` }}>
            <PulseDot status={d.status} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label || d.serial_number || `Device ${d.equipment_id}`}</span>
            <span style={{ color: '#4a5a75', fontSize: '0.85rem' }}>{d.status}</span>
          </div>
        ))}
        {!devices.length && !byStatus.length && <p>No device data — connect the MQTT bridge to see live status.</p>}
      </div>
    </Card>
  )
}
