import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [theme, setTheme] = useState(() => localStorage.getItem('airport-theme') || 'light')
  const [workspaceView, setWorkspaceView] = useState('overview')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.setItem('airport-theme', theme)
  }, [theme])

  useEffect(() => {
    const requestedView = location.state?.workspaceView
    if (location.pathname === '/' && requestedView) {
      setWorkspaceView(requestedView)
    }
  }, [location.pathname, location.state])

  const handleWorkspaceNavigate = (view) => {
    setWorkspaceView(view)
    if (location.pathname !== '/') {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <Header theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />
      <div className={`app-body ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={setCollapsed}
          workspaceView={location.pathname === '/' ? workspaceView : null}
          onWorkspaceNavigate={handleWorkspaceNavigate}
        />
        <main className="app-main">
          <Outlet context={{ workspaceView }} />
        </main>
      </div>
    </div>
  )
}
