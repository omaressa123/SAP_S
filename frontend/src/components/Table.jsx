export default function Table({ columns, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={{ textAlign: 'left', padding: '8px 4px', borderBottom: '2px solid var(--color-muted)' }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--color-muted)' }}>
            {columns.map((c) => (
              <td key={c.key} style={{ padding: '8px 4px' }}>{row[c.key] ?? '—'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
