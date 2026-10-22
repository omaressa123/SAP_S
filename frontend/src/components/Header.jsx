import { Bell } from 'lucide-react'

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand">
          <div className="brand-mark">✈</div>
          <div className="brand-text">
            <span className="brand-name">Smart Green Airport</span>
            <span className="brand-sub">Multi-Agent Operations</span>
          </div>
        </div>
      </div>

      <div className="header-spacer" />

      <div className="header-right">
        <div className="system-chip">
          <span className="chip-dot chip-dot-online" aria-hidden />
          <span className="chip-label">System operational</span>
        </div>

        <div className="notif-wrap">
          <button className="icon-btn notif-btn" aria-label="Notifications">
            <Bell size={20} />
            <span className="notif-badge">3</span>
          </button>
        </div>

        <div className="user-profile">
          <div className="user-avatar">OJ</div>
          <div className="user-info">
            <div className="user-name">Operations Officer</div>
            <div className="user-role">Airport Command</div>
          </div>
        </div>
      </div>
    </header>
  )
}
