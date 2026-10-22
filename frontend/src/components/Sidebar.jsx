import { NavLink } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, LayoutDashboard, IdCard, Plane, Users, Luggage,
  ShieldCheck, BrainCircuit, Activity, Wifi, Bell, GitBranch, Monitor, FileText,
  User, Settings,
} from 'lucide-react'

const ICONS = {
  LayoutDashboard, IdCard, Plane, Users, Luggage, ShieldCheck, BrainCircuit,
  Activity, Wifi, Bell, GitBranch, Monitor, FileText, User, Settings,
}

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [{ to: '/', label: 'Overview', icon: 'LayoutDashboard' }],
  },
  {
    label: 'Airport Operations',
    items: [
      { to: '/egate', label: 'E-Gate Kiosk', icon: 'IdCard' },
      { to: '/gate-boarding', label: 'Gate B22 Boarding', icon: 'Plane' },
      { to: '/passengers', label: 'Passengers', icon: 'Users' },
      { to: '/flights', label: 'Flights', icon: 'Plane' },
      { to: '/baggage', label: 'Baggage', icon: 'Luggage' },
      { to: '/monitoring', label: 'Security', icon: 'ShieldCheck' },
    ],
  },
  {
    label: 'AI & Infrastructure',
    items: [
      { to: '/ai', label: 'AI Center', icon: 'BrainCircuit' },
      { to: '/ai-monitor', label: 'AI Monitoring', icon: 'Activity' },
      { to: '/iot', label: 'IoT Center', icon: 'Wifi' },
      { to: '/events', label: 'Event Center', icon: 'Bell' },
      { to: '/workflows', label: 'Workflows', icon: 'GitBranch' },
      { to: '/digital-twin', label: 'Digital Twin', icon: 'Monitor' },
      { to: '/reports', label: 'Reports', icon: 'FileText' },
    ],
  },
]

export default function Sidebar({ collapsed, onToggleCollapse, drawerOpen, onCloseDrawer }) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${drawerOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">✈</span>
          {!collapsed && <span className="brand-text">Smart Green Airport</span>}
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => onToggleCollapse(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="nav-group">
            {!collapsed && (
              <h6 className="nav-group-label">{group.label}</h6>
            )}
            <ul className="nav-list">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon]
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? 'nav-item-active' : ''}`
                      }
                    >
                      <span className="nav-icon">
                        <Icon size={20} aria-hidden />
                      </span>
                      {!collapsed && <span className="nav-label">{item.label}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item nav-item-outline" onClick={onCloseDrawer} aria-label="User profile">
          <span className="nav-icon"><User size={20} aria-hidden /></span>
          {!collapsed && <span className="nav-label">Profile</span>}
        </button>
        <button className="nav-item nav-item-outline" onClick={onCloseDrawer} aria-label="Settings">
          <span className="nav-icon"><Settings size={20} aria-hidden /></span>
          {!collapsed && <span className="nav-label">Settings</span>}
        </button>
      </div>
    </aside>
  )
}
