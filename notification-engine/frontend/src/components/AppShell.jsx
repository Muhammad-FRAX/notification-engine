import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Bell,
  Users,
  Hash,
  Layers,
  FileCode,
  GitBranch,
  Settings,
  ChevronRight,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { ProxyAccountChip } from './ProxyAccountChip'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/sources', label: 'Sources', icon: Hash },
  { to: '/recipients/users', label: 'Users', icon: Users },
  { to: '/recipients/channels', label: 'Channels', icon: Layers },
  { to: '/groups', label: 'Groups', icon: GitBranch },
  { to: '/templates', label: 'Templates', icon: FileCode },
  { to: '/rules', label: 'Rules', icon: ChevronRight },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SidebarLink({ to, label, icon: Icon, exact }) {
  return (
    <NavLink
      to={to}
      end={exact}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        height: 32,
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        fontFamily: 'var(--font-sans)',
        fontWeight: isActive ? 500 : 400,
        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
        background: isActive ? 'var(--accent-soft)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 120ms, color 120ms',
        cursor: 'pointer',
        userSelect: 'none',
      })}
      onMouseEnter={e => {
        if (!e.currentTarget.classList.contains('active')) {
          e.currentTarget.style.background = 'var(--accent-soft)'
          e.currentTarget.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.getAttribute('aria-current')) {
          e.currentTarget.style.background = ''
          e.currentTarget.style.color = ''
        }
      }}
    >
      <Icon size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
      <span>{label}</span>
    </NavLink>
  )
}

export function AppShell({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 'var(--sidebar-w)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-elev)',
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Logo / brand */}
        <div
          style={{
            height: 'var(--topbar-h)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
            }}
          >
            Notification Engine
          </span>
        </div>

        {/* Nav */}
        <nav
          style={{
            flex: 1,
            padding: '8px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
          }}
          className="scrollbar-thin"
        >
          {NAV.map(item => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header
          style={{
            height: 'var(--topbar-h)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '0 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elev)',
            flexShrink: 0,
          }}
        >
          <ProxyAccountChip />
          <ThemeToggle />
        </header>

        {/* Content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            maxWidth: 1280,
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
          className="scrollbar-thin"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
