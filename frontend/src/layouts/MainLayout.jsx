import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const toggleDrawer = () => setDrawerOpen((open) => !open)
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className="app-shell">
      <Header onToggleDrawer={toggleDrawer} />
      {drawerOpen && <div className="sidebar-drawer-backdrop" onClick={closeDrawer} />}
      <div className={`app-body ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={setCollapsed}
          drawerOpen={drawerOpen}
          onCloseDrawer={closeDrawer}
        />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
