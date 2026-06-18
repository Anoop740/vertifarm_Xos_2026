import React, { useState, useRef, useEffect } from 'react'
import CommandPalette from '@/components/CommandPalette'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { billingApi, api } from '@/lib/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, Leaf, Thermometer, Droplets, Zap, AlertTriangle, Layers,
  Settings, LogOut, Bell, Cpu, BarChart3,
  ShoppingBag, BookOpen, Bot, Radio, Sun, Wind, Building2,
  ChevronLeft, Search, Activity, Users2, CreditCard,
  Key, Plug, QrCode, CheckCheck, ChevronRight,
  BrainCircuit, FileBarChart2, LayoutGrid, Store, ShieldCheck, GitBranch, ShoppingCart,
} from 'lucide-react'

const NAV = [
  { group: 'Operations', items: [
    { to:'/dashboard', icon:LayoutDashboard, label:'Overview' },
    { to:'/farms',     icon:Building2,       label:'Farms & Zones' },
    { to:'/zones',     icon:Layers,          label:'Zones' },
    { to:'/crops',     icon:Leaf,            label:'Crops & Recipes' },
    { to:'/harvests',    icon:QrCode,          label:'Harvests & Trace' },
    { to:'/grow-journal', icon:BookOpen,       label:'Grow Journal' },
    { to:'/alerts',    icon:AlertTriangle,   label:'Alerts', badge:'live', badgeRed: true },
  ]},
  { group: 'Control', items: [
    { to:'/climate',    icon:Thermometer, label:'Climate' },
    { to:'/irrigation', icon:Droplets,    label:'Irrigation' },
    { to:'/lighting',   icon:Sun,         label:'Lighting' },
    { to:'/co2',        icon:Wind,        label:'CO₂ & Air' },
    { to:'/automation', icon:Radio,       label:'Automation' },
  ]},
  { group: 'Intelligence', items: [
    { to:'/ai',          icon:Bot,           label:'AI Insights' },
    { to:'/ai/advanced', icon:BrainCircuit,  label:'Advanced AI', badge:'NEW', badgeRed: false },
    { to:'/devices',     icon:Cpu,           label:'Devices' },
    { to:'/energy',      icon:Zap,           label:'Energy' },
    { to:'/analytics',   icon:BarChart3,     label:'Analytics' },
    { to:'/reports',     icon:FileBarChart2, label:'Reports', badge:'NEW', badgeRed: false },
  ]},
  { group: 'Management', items: [
    { to:'/dashboard/builder',       icon:LayoutGrid,  label:'Dashboard Builder', badge:'NEW', badgeRed: false },
    { to:'/inventory',               icon:ShoppingBag, label:'Inventory' },
    { to:'/sop',                     icon:BookOpen,    label:'SOPs' },
    { to:'/integrations',            icon:Plug,        label:'Integrations' },
    { to:'/team',                    icon:Users2,      label:'Team' },
    { to:'/billing',                 icon:CreditCard,  label:'Billing' },
    { to:'/settings',                icon:Settings,    label:'Settings' },
    { to:'/settings/api-keys',       icon:Key,         label:'API Keys' },
  ]},
  { group: 'Ecosystem', items: [
    { to:'/resellers',  icon:Store,       label:'Reseller Program', badge:'NEW', badgeRed: false },
    { to:'/compliance', icon:ShieldCheck, label:'Compliance',       badge:'NEW', badgeRed: false },
    { to:'/franchise',  icon:GitBranch,   label:'Franchise Sites',  badge:'NEW', badgeRed: false },
    { to:'/marketplace', icon:ShoppingCart, label:'B2B Marketplace',  badge:'NEW', badgeRed: false },
  ]},
]

/* ─── Live Notification Bell ────────────────────────────────── */
function NotificationBell() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: countData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/api/v1/notifications/count').then(r => r.data),
    refetchInterval: 10000,
  })
  const { data: notifs = [] } = useQuery({
    queryKey: ['notif-bell-preview'],
    queryFn: () => api.get('/api/v1/notifications?unread_only=false&limit=8').then(r => r.data),
    enabled: open,
  })

  const markAll = async () => {
    await api.post('/api/v1/notifications/read-all')
    qc.invalidateQueries({ queryKey: ['notif-count'] })
    qc.invalidateQueries({ queryKey: ['notif-bell-preview'] })
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = (countData as any)?.unread ?? 0
  const TYPE_ICONS: Record<string, string> = {
    critical_alert: '🔴', harvest_ready: '🌿', device_offline: '📡',
    threshold_breach: '⚠️', daily_digest: '☕', system: 'ℹ️',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        style={{ position:'relative', width:34, height:34, borderRadius:8, background:'none', border:'1px solid rgba(148,163,184,0.2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', transition:'all 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#f8fafc' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='none' }}
      >
        <Bell size={15} aria-hidden="true"/>
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{ position:'absolute', top:-3, right:-3, width:15, height:15, borderRadius:'50%', background:'#ef4444', fontSize:8, fontWeight:800, color:'white', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid white' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications panel"
          aria-modal="false"
          style={{ position:'absolute', top:42, right:0, width:340, background:'white', border:'1px solid rgba(148,163,184,0.2)', borderRadius:14, boxShadow:'0 12px 40px rgba(15,23,42,0.15)', zIndex:200, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid rgba(148,163,184,0.12)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Notifications {unread > 0 && <span style={{ fontSize:11, background:'#fee2e2', color:'#ef4444', borderRadius:20, padding:'1px 7px', marginLeft:6 }}>{unread}</span>}</span>
            {unread > 0 && (
              <button onClick={markAll} aria-label="Mark all notifications as read" style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#0d9488', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                <CheckCheck size={12} /> All read
              </button>
            )}
          </div>
          <div style={{ maxHeight:300, overflowY:'auto' }} role="list" aria-label="Recent notifications">
            {(notifs as any[]).length === 0 ? (
              <div role="listitem" style={{ padding:24, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                <Bell size={24} aria-hidden="true" style={{ display:'block', margin:'0 auto 8px', color:'#cbd5e1' }} />
                No notifications yet
              </div>
            ) : (
              (notifs as any[]).map((n: any) => (
                <div
                  key={n.id}
                  role="listitem"
                  aria-label={`${n.read_at ? 'Read' : 'Unread'}: ${n.title}`}
                  tabIndex={n.action_url ? 0 : undefined}
                  onKeyDown={e => { if (n.action_url && (e.key === 'Enter' || e.key === ' ')) { navigate(n.action_url); setOpen(false) } }}
                  style={{ padding:'11px 16px', borderBottom:'1px solid rgba(148,163,184,0.07)', background: n.read_at ? 'transparent' : 'rgba(13,148,136,0.03)', cursor: n.action_url ? 'pointer' : 'default' }}
                  onClick={() => { if (n.action_url) { navigate(n.action_url); setOpen(false) } }}
                >
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ fontSize:15, flexShrink:0, lineHeight:1 }}>{TYPE_ICONS[n.type] ?? 'ℹ️'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight: n.read_at ? 500 : 700, color:'#0f172a', marginBottom:2 }}>{n.title}</div>
                      <div style={{ fontSize:11, color:'#64748b', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.body}</div>
                    </div>
                    {!n.read_at && <span style={{ width:7, height:7, borderRadius:'50%', background:'#0d9488', flexShrink:0, marginTop:3 }} />}
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(148,163,184,0.12)' }}>
            <button
              onClick={() => { navigate('/notifications'); setOpen(false) }}
              style={{ width:'100%', padding:'8px', background:'#f8fafc', border:'none', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, color:'#0d9488', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
            >
              View all notifications <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Upgrade Banner ─────────────────────────────────────────── */
function UpgradeBanner() {
  const { data } = useQuery({
    queryKey: ['billing'],
    queryFn: billingApi.get,
    staleTime: 120_000,
  })
  const usage = (data as any)?.usage
  const sub   = (data as any)?.subscription
  if (!usage || !sub) return null

  const plan   = sub.plan   || 'starter'
  const status = sub.status || 'trialing'

  if (status === 'trialing' && sub.trial_ends_at) {
    const days = Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000)
    if (days <= 5 && days >= 0) {
      return (
        <div style={{ padding:'7px 24px', background:'rgba(255,181,71,0.08)', borderBottom:'1px solid rgba(255,181,71,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:12, color:'#ffb547', display:'flex', alignItems:'center', gap:7 }}>
            <span>⏳</span>
            <strong>Trial ends in {days} day{days !== 1 ? 's' : ''}</strong> — Upgrade to keep all features.
          </span>
          <a href="/billing" style={{ fontSize:11, fontWeight:700, color:'#ffb547', textDecoration:'none', padding:'4px 12px', borderRadius:6, border:'1px solid rgba(255,181,71,0.3)' }}>Upgrade →</a>
        </div>
      )
    }
  }

  if (status === 'past_due') {
    return (
      <div style={{ padding:'7px 24px', background:'rgba(255,77,109,0.08)', borderBottom:'1px solid rgba(255,77,109,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ fontSize:12, color:'#ff4d6d' }}>⚠ <strong>Payment failed.</strong> Update your payment method.</span>
        <a href="/billing" style={{ fontSize:11, fontWeight:700, color:'#ff4d6d', textDecoration:'none', padding:'4px 12px', borderRadius:6, border:'1px solid rgba(255,77,109,0.3)' }}>Update →</a>
      </div>
    )
  }

  const nearLimit = ['farms','zones','sensors','users'].find(k => {
    const r = (usage as any)[k]
    return r && r.limit !== -1 && r.limit > 0 && (r.used / r.limit) >= 0.85
  })
  if (nearLimit) {
    const r = (usage as any)[nearLimit]
    return (
      <div style={{ padding:'6px 24px', background:'rgba(255,181,71,0.06)', borderBottom:'1px solid rgba(255,181,71,0.15)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ fontSize:11, color:'#ffb547' }}>
          ⚠ {r.used}/{r.limit} {nearLimit} used on the {plan} plan.
        </span>
        <a href="/billing" style={{ fontSize:11, fontWeight:700, color:'#ffb547', textDecoration:'none', padding:'3px 10px', borderRadius:5, border:'1px solid rgba(255,181,71,0.25)' }}>Upgrade →</a>
      </div>
    )
  }

  return null
}

/* ─── Main Layout ────────────────────────────────────────────── */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [clock, setClock] = useState(new Date())

  // Unread count for sidebar Alerts badge — must live here so NAV render has access
  const { data: countData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/api/v1/notifications/count').then(r => r.data),
    refetchInterval: 10000,
  })
  const unread = (countData as any)?.unread ?? 0

  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const initials = user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || 'VF'

  const pageName = (() => {
    const p = location.pathname
    if (p === '/dashboard')          return 'Overview'
    if (p === '/farms' || p === '/zones') return 'Farms & Zones'
    if (p === '/co2')                return 'CO₂ & Air Quality'
    if (p === '/billing')            return 'Billing'
    if (p === '/team')               return 'Team'
    return p.slice(1).replace(/-/g,' ').replace(/\b\w/g, l => l.toUpperCase())
  })()

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f0f4f8' }}>

      {/* ── SIDEBAR ── */}
      <aside
        aria-label="Main navigation"
        aria-expanded={!collapsed}
        style={{
        width: collapsed ? 56 : 224,
        display:'flex', flexDirection:'column',
        background:'white',
        borderRight:'1px solid rgba(148,163,184,0.2)',
        boxShadow:'1px 0 8px rgba(15,23,42,0.05)',
        transition:'width 0.2s cubic-bezier(0.4,0,0.2,1)',
        flexShrink:0, zIndex:10, overflow:'hidden'
      }}>
        {/* Logo */}
        <div style={{ height:56, display:'flex', alignItems:'center', padding: collapsed ? '0 14px' : '0 16px', borderBottom:'1px solid rgba(148,163,184,0.15)', flexShrink:0 }}>
          <div style={{ width:30, height:30, borderRadius:8, flexShrink:0, background:'linear-gradient(135deg,#0d9488,#0f766e)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(13,148,136,0.3)' }}>
            <Leaf size={15} color="white"/>
          </div>
          {!collapsed && (
            <div style={{ marginLeft:10, overflow:'hidden', flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#0f172a', lineHeight:1.1, whiteSpace:'nowrap' }}>VertiFarm</div>
              <div style={{ fontSize:9, color:'#94a3b8', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>XOS v1.0</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            style={{ marginLeft: collapsed ? 'auto' : 4, width:24, height:24, borderRadius:6, border:'none', cursor:'pointer', background:'none', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', flexShrink:0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#f1f5f9'; (e.currentTarget as HTMLElement).style.color='#475569' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='none';   (e.currentTarget as HTMLElement).style.color='#94a3b8'  }}>
            <ChevronLeft size={14} aria-hidden="true" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}/>
          </button>
        </div>

        {/* Nav */}
        <nav aria-label="Sidebar navigation" style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'12px 8px' }}>
          {NAV.map(({ group, items }) => (
            <div key={group} role="group" aria-label={group} style={{ marginBottom:20 }}>
              {!collapsed && (
                <div aria-hidden="true" style={{ fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase', padding:'0 8px', marginBottom:4 }}>{group}</div>
              )}
              {items.map(({ to, icon: Icon, label, badge, badgeRed }) => (
                <NavLink key={to} to={to} end={to === '/dashboard'} style={{ textDecoration:'none' }}
                  aria-label={collapsed ? label : undefined}
                  children={({ isActive }) => (
                    <div
                      aria-current={isActive ? 'page' : undefined}
                      style={{
                      display:'flex', alignItems:'center', gap: collapsed ? 0 : 10,
                      padding: collapsed ? '9px 0' : '7px 10px',
                      borderRadius:8, marginBottom:2,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: isActive ? 'rgba(13,148,136,0.08)' : 'transparent',
                      borderLeft: isActive && !collapsed ? '2px solid #0d9488' : '2px solid transparent',
                      transition:'all 0.1s', cursor:'pointer',
                      color: isActive ? '#0d9488' : '#64748b',
                    }}
                    onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background='#f8fafc'; (e.currentTarget as HTMLElement).style.color='#0f172a' } }}
                    onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='#64748b' } }}>
                      <Icon size={15} aria-hidden="true" style={{ flexShrink:0 }}/>
                      {!collapsed && (
                        <>
                          <span style={{ fontSize:12, fontWeight: isActive ? 600 : 500, flex:1, whiteSpace:'nowrap' }}>{label}</span>
                          {badge && (
                            <span aria-label={badge === 'live' && unread > 0 ? `${unread} unread` : badge} style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:10, background: badgeRed ? 'rgba(220,38,38,0.1)' : 'rgba(13,148,136,0.1)', color: badgeRed ? '#ef4444' : '#0d9488', border:`1px solid ${badgeRed ? 'rgba(220,38,38,0.2)' : 'rgba(13,148,136,0.2)'}` }}>
                              {badge === 'live' ? (unread > 0 ? unread : '–') : badge}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        {!collapsed && (
          <div style={{ borderTop:'1px solid rgba(148,163,184,0.15)', padding:'10px 8px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:10, cursor:'pointer', transition:'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#f8fafc'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#0d9488,#0f766e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'white', flexShrink:0 }}>{initials}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.full_name}</div>
                <div style={{ fontSize:9, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textTransform:'capitalize' }}>{user?.role?.replace(/_/g,' ')}</div>
              </div>
              <button onClick={() => { logout(); navigate('/login') }}
                aria-label="Sign out"
                style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', flexShrink:0, padding:2, borderRadius:4, display:'flex' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#ef4444'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#94a3b8'}>
                <LogOut size={13} aria-hidden="true"/>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── MAIN ── */}
      <div style={{ display:'flex', flexDirection:'column', flex:1, minWidth:0, overflow:'hidden' }}>

        {/* Topbar */}
        <header role="banner" style={{ height:56, display:'flex', alignItems:'center', gap:16, padding:'0 24px', background:'white', borderBottom:'1px solid rgba(148,163,184,0.18)', boxShadow:'0 1px 4px rgba(15,23,42,0.05)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Activity size={14} color="#0d9488" aria-hidden="true"/>
            <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }} aria-label={`Current page: ${pageName}`}>{pageName}</span>
          </div>

          <div style={{ flex:1, maxWidth:280 }}>
            <div style={{ position:'relative' }}>
              {/* CommandPalette replaces search */}
              <CommandPalette/>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
            <div
              role="status"
              aria-label="System status: live"
              style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', fontSize:10, fontWeight:700, color:'#059669', letterSpacing:'0.04em' }}>
              <span aria-hidden="true" style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', display:'inline-block' }}/>
              LIVE
            </div>
            <span aria-label={`Current time: ${clock.toTimeString().slice(0,8)}`} style={{ fontSize:11, color:'#94a3b8', fontFamily:'DM Mono,monospace', fontWeight:500 }}>{clock.toTimeString().slice(0,8)}</span>
            <NotificationBell />
            <button onClick={() => navigate('/settings')} aria-label="Open account settings" style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#0d9488,#0f766e)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'white', boxShadow:'0 2px 6px rgba(13,148,136,0.3)' }}>{initials}</button>
          </div>
        </header>

        {/* Upgrade banner */}
        <UpgradeBanner/>

        {/* Page content */}
        <main id="main-content" role="main" aria-label={`${pageName} content`} style={{ flex:1, overflowY:'auto', background:'#f0f4f8' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
