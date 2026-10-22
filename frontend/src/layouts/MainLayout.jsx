import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(max-width: 900px)').matches)

  return (
    <div className="app-shell">
      <Header />
      <div className={`app-body ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={setCollapsed}
        />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
