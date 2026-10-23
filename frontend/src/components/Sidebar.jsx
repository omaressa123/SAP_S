import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ChevronDown, ChevronLeft, LayoutDashboard, IdCard, Plane, Users, Luggage,
  ShieldCheck, BrainCircuit, Activity, Wifi, Bell, GitBranch, Monitor, FileText,
  User, Settings, AlertTriangle,
} from 'lucide-react'

const ICONS = {
  LayoutDashboard, IdCard, Plane, Users, Luggage, ShieldCheck, BrainCircuit,
  Activity, Wifi, Bell, GitBranch, Monitor, FileText, User, Settings, AlertTriangle,
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
      { to: '/disruption', label: 'Disruption Planner', icon: 'AlertTriangle' },
    ],
  },
]

export default function Sidebar({ collapsed, onToggleCollapse }) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  const closeAccountMenu = () => {
    setAccountMenuOpen(false)
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-workspace">
          {collapsed ? (
            <button
              className="sidebar-brand-trigger"
              onClick={() => onToggleCollapse(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <span className="sidebar-brand-mark" aria-hidden>✈</span>
            </button>
          ) : (
            <span className="sidebar-brand-mark" aria-hidden>✈</span>
          )}
          {!collapsed && (
            <span className="sidebar-workspace-copy">
              <span className="sidebar-workspace-name">Smart Green Airport</span>
              <span className="sidebar-workspace-subtitle">Airport Operations</span>
            </span>
          )}
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => onToggleCollapse(true)}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
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
                      title={collapsed ? item.label : undefined}
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
        <button
          className="sidebar-account"
          onClick={() => setAccountMenuOpen((open) => !open)}
          aria-label="Open account menu"
          aria-expanded={accountMenuOpen}
          title={collapsed ? 'Operations Officer' : undefined}
        >
          <span className="sidebar-account-avatar">OJ</span>
          {!collapsed && (
            <>
              <span className="sidebar-account-copy">
                <span className="sidebar-account-name">Operations Officer</span>
                <span className="sidebar-account-email">Airport Command</span>
              </span>
              <ChevronDown className="sidebar-account-chevron" size={16} aria-hidden />
            </>
          )}
        </button>
        {accountMenuOpen && (
          <div className="sidebar-account-menu">
            <button className="sidebar-account-action" onClick={closeAccountMenu}>
              <User size={16} aria-hidden />
              <span>Profile</span>
            </button>
            <button className="sidebar-account-action" onClick={closeAccountMenu}>
              <Settings size={16} aria-hidden />
              <span>Settings</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
