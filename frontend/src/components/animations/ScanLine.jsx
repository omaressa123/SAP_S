/** Professional scanning frame. Render ONLY while a real request is in flight. */
export default function ScanLine({ label = 'SCANNING…' }) {
  return (
    <div className="scan-frame" role="status" aria-label={label}>
      <div className="scan-line" aria-hidden />
      <span style={{ fontWeight: 800, letterSpacing: '0.12em', fontSize: '0.85rem' }}>{label}</span>
    </div>
  )
}
