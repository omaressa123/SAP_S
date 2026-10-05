import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Overview' },
  { to: '/passengers', label: 'Passengers' },
  { to: '/flights', label: 'Flights' },
  { to: '/baggage', label: 'Baggage' },
  { to: '/monitoring', label: 'Security' },
  { to: '/ai', label: 'AI Center' },
  { to: '/iot', label: 'IoT Center' },
  { to: '/digital-twin', label: 'Digital Twin' },
  { to: '/reports', label: 'Reports' },
]

export default function Navbar() {
  return (
    <nav>
      <strong className="brand">Smart Airport Operations</strong>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'}>
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}
