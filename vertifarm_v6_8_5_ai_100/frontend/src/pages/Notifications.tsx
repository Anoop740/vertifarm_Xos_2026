import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Bell, CheckCheck, Mail, MessageSquare, Phone,
  Smartphone, ChevronRight, AlertTriangle, Leaf,
  Wifi, BarChart3, Coffee, Info
} from 'lucide-react'

const S = {
  page: { padding: '32px', maxWidth: 1100 } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 } as React.CSSProperties,
  title: { fontSize: 26, fontWeight: 700, color: '#e8f4f0', margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 14, color: '#6b8f7e', marginTop: 4 } as React.CSSProperties,
  btn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 } as React.CSSProperties,
  btnPrimary: { background: 'linear-gradient(135deg,#00d4aa,#00b894)', color: '#003d29' } as React.CSSProperties,
  btnGhost: { background: 'rgba(255,255,255,0.06)', color: '#a0c4b4', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(0,212,170,0.1)', borderRadius: 14, marginBottom: 8, overflow: 'hidden' } as React.CSSProperties,
  sectionTitle: { fontSize: 17, fontWeight: 700, color: '#e8f4f0', margin: '32px 0 16px', display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  tag: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 } as React.CSSProperties,
  toggle: { position: 'relative' as const, width: 40, height: 22, flexShrink: 0 },
}

const ALERT_TYPES = [
  { key: 'critical_alert',   label: 'Critical Alerts',   icon: AlertTriangle, color: '#ff4d6d', desc: 'Immediate action required — sensor out of range, equipment failure' },
  { key: 'harvest_ready',    label: 'Harvest Ready',     icon: Leaf,          color: '#00d4aa', desc: 'Crops ready for harvest based on growth schedule' },
  { key: 'device_offline',   label: 'Device Offline',    icon: Wifi,          color: '#ffb547', desc: 'Sensor or controller lost connection' },
  { key: 'threshold_breach', label: 'Threshold Breach',  icon: BarChart3,     color: '#7c6fff', desc: 'Environmental parameter crossed configured threshold' },
  { key: 'daily_digest',     label: 'Daily Digest',      icon: Coffee,        color: '#00bfff', desc: '07:00 summary — yield, active alerts, upcoming harvests' },
]

const CHANNELS = [
  { key: 'inapp_enabled',    label: 'In-App',    icon: Bell },
  { key: 'email_enabled',    label: 'Email',     icon: Mail },
  { key: 'sms_enabled',      label: 'SMS',       icon: Phone },
  { key: 'whatsapp_enabled', label: 'WhatsApp',  icon: MessageSquare },
  { key: 'push_enabled',     label: 'Push',      icon: Smartphone },
]

const TYPE_ICONS: Record<string, React.ReactNode> = {
  critical_alert:   <AlertTriangle size={15} style={{ color: '#ff4d6d' }} />,
  harvest_ready:    <Leaf size={15} style={{ color: '#00d4aa' }} />,
  device_offline:   <Wifi size={15} style={{ color: '#ffb547' }} />,
  threshold_breach: <BarChart3 size={15} style={{ color: '#7c6fff' }} />,
  daily_digest:     <Coffee size={15} style={{ color: '#00bfff' }} />,
  system:           <Info size={15} style={{ color: '#6b8f7e' }} />,
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        position: 'relative', width: 40, height: 22, borderRadius: 11,
        background: checked ? 'linear-gradient(135deg,#00d4aa,#00b894)' : 'rgba(255,255,255,0.1)',
        border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
        outline: 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? '#003d29' : 'rgba(255,255,255,0.4)',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function NotifItem({ notif, onRead }: { notif: any; onRead: (id: string) => void }) {
  const isUnread = !notif.read_at
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: isUnread ? 'rgba(0,212,170,0.04)' : 'transparent',
      transition: 'background 0.2s',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {TYPE_ICONS[notif.type] ?? <Bell size={15} style={{ color: '#6b8f7e' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontWeight: isUnread ? 700 : 500, color: '#e8f4f0', fontSize: 14 }}>{notif.title}</span>
          {isUnread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d4aa', flexShrink: 0, display: 'inline-block' }} />}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#6b8f7e', lineHeight: 1.5 }}>{notif.body}</p>
        {notif.action_url && (
          <a href={notif.action_url} style={{ fontSize: 12, color: '#00d4aa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            View details <ChevronRight size={12} />
          </a>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#6b8f7e', marginBottom: 6 }}>
          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          <br />
          {new Date(notif.created_at).toLocaleDateString()}
        </div>
        {isUnread && (
          <button
            onClick={() => onRead(notif.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b8f7e', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <CheckCheck size={12} /> Mark read
          </button>
        )}
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<'inbox' | 'settings'>('inbox')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const qc = useQueryClient()

  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => api.get(`/api/v1/notifications?unread_only=${unreadOnly}`).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: count } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/api/v1/notifications/count').then(r => r.data),
    refetchInterval: 10000,
  })

  const { data: prefs = [] } = useQuery({
    queryKey: ['notif-prefs'],
    queryFn: () => api.get('/api/v1/notifications/preferences').then(r => r.data),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: () => api.post('/api/v1/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notif-count'] })
      toast.success('All notifications marked as read')
    },
  })

  const updatePref = useMutation({
    mutationFn: ({ type, channel, val }: { type: string; channel: string; val: boolean }) =>
      api.patch(`/api/v1/notifications/preferences/${type}`, { [channel]: val }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-prefs'] }),
    onError: () => toast.error('Failed to update preference'),
  })

  const getPref = (alertType: string, channel: string): boolean => {
    const p = (prefs as any[]).find((p: any) => p.alert_type === alertType)
    if (!p) return channel === 'inapp_enabled' || channel === 'email_enabled' || channel === 'push_enabled'
    return !!p[channel]
  }

  const unreadCount = (count as any)?.unread ?? 0

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={{ ...S.title, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Bell size={24} style={{ color: '#00d4aa' }} />
            Notification Centre
            {unreadCount > 0 && (
              <span style={{ background: '#ff4d6d', color: '#fff', fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 20, marginLeft: 4 }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p style={S.subtitle}>Multi-channel alerts and escalation management</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {(['inbox', 'settings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 22px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              background: tab === t ? 'rgba(0,212,170,0.15)' : 'transparent',
              color: tab === t ? '#00d4aa' : '#6b8f7e',
              textTransform: 'capitalize',
            }}
          >
            {t === 'inbox' ? `Inbox${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'Preferences'}
          </button>
        ))}
      </div>

      {tab === 'inbox' && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#a0c4b4' }}>
              <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} style={{ accentColor: '#00d4aa' }} />
              Unread only
            </label>
            <div style={{ flex: 1 }} />
            {unreadCount > 0 && (
              <button style={{ ...S.btn, ...S.btnGhost, padding: '8px 16px', fontSize: 13 }} onClick={() => markAll.mutate()}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ ...S.card, overflow: 'hidden' }}>
            {(notifs as any[]).length === 0 ? (
              <div style={{ padding: 56, textAlign: 'center' as const }}>
                <Bell size={40} style={{ color: '#2a4a3a', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ color: '#6b8f7e', margin: 0 }}>
                  {unreadOnly ? 'No unread notifications — all caught up!' : 'No notifications yet.'}
                </p>
              </div>
            ) : (
              (notifs as any[]).map((n: any) => (
                <NotifItem key={n.id} notif={n} onRead={(id) => markRead.mutate(id)} />
              ))
            )}
          </div>
        </>
      )}

      {tab === 'settings' && (
        <>
          {/* Escalation info banner */}
          <div style={{ background: 'rgba(255,181,71,0.08)', border: '1px solid rgba(255,181,71,0.2)', borderRadius: 12, padding: '14px 20px', marginBottom: 28, display: 'flex', gap: 14, alignItems: 'center' }}>
            <AlertTriangle size={18} style={{ color: '#ffb547', flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#a0c4b4' }}>
              <strong style={{ color: '#ffb547' }}>Escalation Rules:</strong> Unacknowledged critical alerts escalate to Farm Manager after <strong style={{ color: '#e8f4f0' }}>15 min</strong> and to Org Admin after <strong style={{ color: '#e8f4f0' }}>30 min</strong>.
            </div>
          </div>

          {/* Channel legend */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' as const }}>
            {CHANNELS.map(({ key, label, icon: Icon }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#6b8f7e' }}>
                <Icon size={14} style={{ color: '#00d4aa' }} /> {label}
              </div>
            ))}
          </div>

          {/* Preferences grid */}
          {ALERT_TYPES.map(({ key, label, icon: Icon, color, desc }) => (
            <div key={key} style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} style={{ color }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#e8f4f0', fontSize: 14 }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#6b8f7e', marginTop: 2 }}>{desc}</div>
                </div>
              </div>
              <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                {CHANNELS.map(({ key: ch, label: chLabel, icon: ChIcon }) => {
                  const enabled = getPref(key, ch)
                  return (
                    <div key={ch} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                      borderRadius: 10, border: `1px solid ${enabled ? 'rgba(0,212,170,0.25)' : 'rgba(255,255,255,0.07)'}`,
                      background: enabled ? 'rgba(0,212,170,0.06)' : 'rgba(255,255,255,0.02)',
                      minWidth: 140, flex: '1 1 140px',
                    }}>
                      <ChIcon size={14} style={{ color: enabled ? '#00d4aa' : '#4a6a5a' }} />
                      <span style={{ flex: 1, fontSize: 13, color: enabled ? '#e8f4f0' : '#6b8f7e', fontWeight: enabled ? 600 : 400 }}>
                        {chLabel}
                      </span>
                      <Toggle
                        checked={enabled}
                        onChange={() => updatePref.mutate({ type: key, channel: ch, val: !enabled })}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Daily digest timing note */}
          <div style={{ background: 'rgba(0,191,255,0.06)', border: '1px solid rgba(0,191,255,0.15)', borderRadius: 12, padding: '14px 20px', display: 'flex', gap: 14, alignItems: 'center', marginTop: 8 }}>
            <Coffee size={18} style={{ color: '#00bfff', flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: '#a0c4b4' }}>
              <strong style={{ color: '#00bfff' }}>Daily Digest</strong> is sent every day at <strong style={{ color: '#e8f4f0' }}>07:00 local time</strong> and includes yesterday's yield summary, active alerts, and upcoming harvest schedule.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
