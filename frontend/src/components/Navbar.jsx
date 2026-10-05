import { NavLink, useNavigate } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/flights', label: 'Flights' },
  { to: '/passengers', label: 'Passengers' },
  { to: '/baggage', label: 'Baggage' },
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/digital-twin', label: 'Digital Twin' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const logout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }
  return (
    <nav>
      <strong className="brand">✈ Smart Airport</strong>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'}>
          {l.label}
        </NavLink>
      ))}
      <button onClick={logout}>Logout</button>
    </nav>
  )
}
