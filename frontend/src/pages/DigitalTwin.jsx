import { useState } from 'react'

export default function DigitalTwin() {
  const [ready, setReady] = useState(false)

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        minHeight: 600,
        background: '#050a14',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '10px 18px',
          background: '#0b1121',
          borderBottom: '1px solid #1f2a44',
          color: '#e8eef7',
          fontSize: '1rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#22d3ee' }}>
          ⬢
        </span>
        Digital Twin — Live 3D Airport
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#8b9bb5', fontWeight: 500 }}>
          Powered by Babylon.js · wss://localhost:8100/ws/twin
        </span>
      </header>

      <iframe
        src="/twin/"
        title="Smart Airport Digital Twin"
        style={{
          flex: 1,
          width: '100%',
          border: 0,
          background: '#050a14',
          display: 'block',
        }}
        onLoad={() => setReady(true)}
      />

      {!ready && (
        <p style={{ padding: '12px 18px', color: '#6e7a97', fontSize: '0.85rem' }}>
          Loading 3D airport environment…
        </p>
      )}
    </div>
  )
}
