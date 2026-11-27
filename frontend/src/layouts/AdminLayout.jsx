import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Plane, Luggage, BarChart3, Activity, GitBranch,
  Moon, Sun, ChevronLeft, ChevronRight, LayoutGrid,
  ExternalLink, ShieldCheck
} from 'lucide-react'

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('airport-theme') || 'light')
  const navigate = useNavigate()
  const location = useLocation()

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    localStorage.setItem('airport-theme', nextTheme)
  }

  const ADMIN_NAV = [
    {
      group: 'Executive Command',
      items: [
        { path: '/admin/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'Operational Analytics',
      items: [
        { path: '/admin/reports/passengers', label: 'Passengers', icon: Users },
        { path: '/admin/reports/flights', label: 'Flights', icon: Plane },
        { path: '/admin/reports/baggage', label: 'Baggage', icon: Luggage },
        { path: '/admin/reports/operations', label: 'Operations', icon: BarChart3 },
      ],
    },
    {
      group: 'AI Systems & Observability',
      items: [
        { path: '/admin/ai-monitor', label: 'AI Live Monitoring', icon: Activity, badge: 'Realtime' },
        { path: '/admin/workflows', label: 'Multi-Agent Workflows', icon: GitBranch },
      ],
    },
  ]

  return (
    <div className="app-shell" data-theme={theme}>
      {/* Admin Header */}
      <header className="app-header" style={{ borderBottom: '2px solid #071739' }}>
        <div className="header-left">
          <div className="brand">
            <div className="brand-mark" style={{ background: '#071739', color: '#E3C39D' }}>⚡</div>
            <div className="brand-text">
              <span className="brand-name">Executive Command & AI Intelligence</span>
              <span className="brand-sub">Airport Governance & Multi-Agent Oversight</span>
            </div>
          </div>
        </div>

        <div className="header-spacer" />

        <div className="header-right">
          <div className="system-chip">
            <span className="chip-dot chip-dot-online" />
            <span className="chip-label">Multi-Agent Grid Online</span>
          </div>

          <button
            type="button"
            className="icon-btn theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate('/')}
            title="Return to Central Portal"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', width: 'auto', padding: '0 12px', fontSize: '0.8rem' }}
          >
            <LayoutGrid size={16} />
            <span>Portal</span>
          </button>

          <div className="user-profile">
            <div className="user-avatar" style={{ background: '#071739', color: '#E3C39D' }}>AD</div>
            <div className="user-info">
              <div className="user-name">System Administrator</div>
              <div className="user-role">Control Center</div>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Body */}
      <div className={`app-body ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-workspace">
              <span className="sidebar-brand-mark">⚡</span>
              {!collapsed && (
                <span className="sidebar-workspace-copy">
                  <span className="sidebar-workspace-name">Admin Control</span>
                  <span className="sidebar-workspace-subtitle">Command Center</span>
                </span>
              )}
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Toggle sidebar"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <nav className="sidebar-nav">
            {ADMIN_NAV.map((section) => (
              <div key={section.group} className="nav-group">
                {!collapsed && <h6 className="nav-group-label">{section.group}</h6>}
                <ul className="nav-list">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    return (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          className={`nav-item ${isActive ? 'active' : ''}`}
                          title={collapsed ? item.label : undefined}
                        >
                          <Icon size={18} className="nav-icon" />
                          {!collapsed && (
                            <>
                              <span className="nav-label">{item.label}</span>
                              {item.badge && (
                                <span className="nav-badge">
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

            {/* Quick Cross-Module Jump */}
            {!collapsed && (
              <div className="nav-group" style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <h6 className="nav-group-label">Cross-Module Switcher</h6>
                <ul className="nav-list">
                  <li>
                    <button
                      type="button"
                      className="nav-item"
                      onClick={() => navigate('/staff/monitoring')}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <ShieldCheck size={16} className="nav-icon" />
                      <span className="nav-label">Staff Operations Desk</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="nav-item"
                      onClick={() => navigate('/terminals/kiosk')}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <ExternalLink size={16} className="nav-icon" />
                      <span className="nav-label">Terminal Kiosk Display</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </nav>
        </aside>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
