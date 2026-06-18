import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Key, Plus, Trash2, Copy, CheckCircle2, Eye, EyeOff,
  Shield, Zap, Globe, Code2, Webhook, ExternalLink, RefreshCw, X
} from 'lucide-react'

const S = {
  page: { padding: '32px', maxWidth: 1100 } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 } as React.CSSProperties,
  title: { fontSize: 26, fontWeight: 700, color: '#e8f4f0', margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 14, color: '#6b8f7e', marginTop: 4 } as React.CSSProperties,
  btn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 } as React.CSSProperties,
  btnPrimary: { background: 'linear-gradient(135deg,#00d4aa,#00b894)', color: '#003d29' } as React.CSSProperties,
  btnDanger: { background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.25)' } as React.CSSProperties,
  btnGhost: { background: 'rgba(255,255,255,0.06)', color: '#a0c4b4', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(0,212,170,0.1)', borderRadius: 14, padding: 24, marginBottom: 16 } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
  input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e8f4f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
  tag: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 } as React.CSSProperties,
  modal: { position: 'fixed' as const, top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' },
  modalBox: { background: '#0d1f17', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 18, padding: 32, width: 520, maxWidth: '95vw' } as React.CSSProperties,
}

const SCOPES = [
  { id: 'farms:read',    label: 'Farms Read',    desc: 'List and view farms' },
  { id: 'farms:write',   label: 'Farms Write',   desc: 'Create and update farms' },
  { id: 'zones:read',    label: 'Zones Read',    desc: 'View zones and sensors' },
  { id: 'zones:write',   label: 'Zones Write',   desc: 'Manage zone settings' },
  { id: 'crops:read',    label: 'Crops Read',    desc: 'View crop batches' },
  { id: 'crops:write',   label: 'Crops Write',   desc: 'Create and update crops' },
  { id: 'alerts:read',   label: 'Alerts Read',   desc: 'View active alerts' },
  { id: 'harvests:read', label: 'Harvests Read', desc: 'View harvest logs' },
  { id: 'harvests:write',label: 'Harvests Write',desc: 'Log harvests' },
]

const WEBHOOK_EVENTS = ['alert_fired', 'harvest_completed', 'device_offline', 'threshold_breached']

function ScopeTag({ scope }: { scope: string }) {
  const colors: Record<string, string> = { read: '#00d4aa', write: '#ffb547' }
  const type = scope.includes('write') ? 'write' : 'read'
  return (
    <span style={{ ...S.tag, background: `${colors[type]}18`, color: colors[type], border: `1px solid ${colors[type]}30` }}>
      {scope}
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#00d4aa' : '#6b8f7e', padding: '2px 6px' }}>
      {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
    </button>
  )
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (secret: string) => void }) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['farms:read'])
  const [expDays, setExpDays] = useState('')
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (d: any) => api.post('/api/v1/api-keys', d).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      onCreated(data.secret)
    },
    onError: () => toast.error('Failed to create key'),
  })

  const toggle = (s: string) =>
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, color: '#e8f4f0', fontSize: 18, fontWeight: 700 }}>Create API Key</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b8f7e' }}><X size={20} /></button>
        </div>

        <label style={S.label}>Key Name</label>
        <input style={{ ...S.input, marginBottom: 20 }} placeholder="e.g. Production Integration" value={name} onChange={e => setName(e.target.value)} />

        <label style={S.label}>Scopes</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {SCOPES.map(sc => (
            <label key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${scopes.includes(sc.id) ? 'rgba(0,212,170,0.4)' : 'rgba(255,255,255,0.08)'}`, background: scopes.includes(sc.id) ? 'rgba(0,212,170,0.08)' : 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
              <input type="checkbox" checked={scopes.includes(sc.id)} onChange={() => toggle(sc.id)} style={{ accentColor: '#00d4aa' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e8f4f0' }}>{sc.label}</div>
                <div style={{ fontSize: 11, color: '#6b8f7e' }}>{sc.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <label style={S.label}>Expiry (days, blank = never)</label>
        <input style={{ ...S.input, marginBottom: 24 }} type="number" placeholder="e.g. 90" value={expDays} onChange={e => setExpDays(e.target.value)} />

        <button
          style={{ ...S.btn, ...S.btnPrimary, width: '100%', justifyContent: 'center' }}
          disabled={!name || scopes.length === 0 || mut.isPending}
          onClick={() => mut.mutate({ name, scopes, expires_days: expDays ? parseInt(expDays) : null })}
        >
          {mut.isPending ? 'Creating…' : 'Create API Key'}
        </button>
      </div>
    </div>
  )
}

function SecretRevealModal({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={S.modal}>
      <div style={{ ...S.modalBox, textAlign: 'center' as const }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
        <h3 style={{ color: 'var(--accent)', margin: '0 0 8px', fontSize: 20 }}>Your Secret Key</h3>
        <p style={{ color: '#6b8f7e', fontSize: 13, marginBottom: 24 }}>Copy this now — it will <strong style={{ color: '#ffb547' }}>never be shown again</strong>.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
          <code style={{ flex: 1, fontSize: 13, color: '#e8f4f0', wordBreak: 'break-all', fontFamily: 'monospace', filter: visible ? 'none' : 'blur(5px)', transition: 'filter 0.2s' }}>
            {secret}
          </code>
          <button onClick={() => setVisible(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b8f7e', flexShrink: 0 }}>
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <CopyBtn text={secret} />
        </div>
        <button onClick={onClose} style={{ ...S.btn, ...S.btnPrimary, justifyContent: 'center', width: '100%' }}>
          Done, I've Saved It
        </button>
      </div>
    </div>
  )
}

function CreateWebhookModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(WEBHOOK_EVENTS)
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (d: any) => api.post('/api/v1/webhooks', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); onClose(); toast.success('Webhook registered') },
    onError: () => toast.error('Failed to register webhook'),
  })

  const toggle = (e: string) =>
    setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, color: '#e8f4f0', fontSize: 18, fontWeight: 700 }}>Register Webhook</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b8f7e' }}><X size={20} /></button>
        </div>
        <label style={S.label}>Name</label>
        <input style={{ ...S.input, marginBottom: 16 }} placeholder="e.g. Slack Alert Bot" value={name} onChange={e => setName(e.target.value)} />
        <label style={S.label}>URL</label>
        <input style={{ ...S.input, marginBottom: 20 }} placeholder="https://hooks.example.com/..." value={url} onChange={e => setUrl(e.target.value)} />
        <label style={S.label}>Events to Subscribe</label>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 24 }}>
          {WEBHOOK_EVENTS.map(ev => (
            <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20, border: `1px solid ${events.includes(ev) ? 'rgba(0,212,170,0.4)' : 'rgba(255,255,255,0.1)'}`, background: events.includes(ev) ? 'rgba(0,212,170,0.1)' : 'transparent', cursor: 'pointer', fontSize: 12, color: events.includes(ev) ? '#00d4aa' : '#6b8f7e', fontWeight: 600 }}>
              <input type="checkbox" checked={events.includes(ev)} onChange={() => toggle(ev)} style={{ display: 'none' }} />
              {ev.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
        <button
          style={{ ...S.btn, ...S.btnPrimary, width: '100%', justifyContent: 'center' }}
          disabled={!name || !url || events.length === 0 || mut.isPending}
          onClick={() => mut.mutate({ name, url, events })}
        >
          {mut.isPending ? 'Registering…' : 'Register Webhook'}
        </button>
      </div>
    </div>
  )
}

export default function ApiKeysPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [showWebhook, setShowWebhook] = useState(false)
  const qc = useQueryClient()

  const { data: keys = [] } = useQuery({ queryKey: ['api-keys'], queryFn: () => api.get('/api/v1/api-keys').then(r => r.data) })
  const { data: hooks = [] } = useQuery({ queryKey: ['webhooks'], queryFn: () => api.get('/api/v1/webhooks').then(r => r.data) })

  const revokeKey = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Key revoked') },
    onError: () => toast.error('Failed to revoke key'),
  })

  const deleteHook = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/webhooks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('Webhook removed') },
    onError: () => toast.error('Failed to remove webhook'),
  })

  const testHook = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/webhooks/${id}/test`),
    onSuccess: () => toast.success('Test ping sent!'),
    onError: () => toast.error('Test failed'),
  })

  const planRpm = (keys as any[])[0]?.rate_limit_rpm ?? 60

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Developer Portal & API Keys</h1>
          <p style={S.subtitle}>Manage API access, rate limits, and webhook integrations</p>
        </div>
        <a
          href="/docs"
          target="_blank"
          style={{ ...S.btn, ...S.btnGhost, textDecoration: 'none', color: '#a0c4b4' }}
        >
          <ExternalLink size={16} /> API Docs
        </a>
      </div>

      {/* Rate limit banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { icon: Zap, label: 'Rate Limit', value: `${planRpm} req/min`, color: '#ffb547' },
          { icon: Shield, label: 'Auth Method', value: 'Bearer Token', color: 'var(--accent)' },
          { icon: Globe, label: 'Base URL', value: '/api/v1', color: '#7c6fff' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16, margin: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b8f7e', marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 700, color: '#e8f4f0', fontSize: 15 }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* API Keys Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: '#e8f4f0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={18} style={{ color: 'var(--accent)' }} /> API Keys
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b8f7e' }}>{(keys as any[]).length} key{(keys as any[]).length !== 1 ? 's' : ''} active</p>
        </div>
        <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Key
        </button>
      </div>

      {(keys as any[]).length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center' as const, padding: 48 }}>
          <Key size={40} style={{ color: '#2a4a3a', margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#6b8f7e', margin: 0 }}>No API keys yet. Create one to start building integrations.</p>
        </div>
      ) : (
        (keys as any[]).map((key: any) => (
          <div key={key.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Key size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: '#e8f4f0', fontSize: 15 }}>{key.name}</span>
                <span style={{ ...S.tag, background: key.is_active ? 'rgba(0,212,170,0.12)' : 'rgba(255,77,109,0.12)', color: key.is_active ? '#00d4aa' : '#ff4d6d', border: `1px solid ${key.is_active ? 'rgba(0,212,170,0.3)' : 'rgba(255,77,109,0.3)'}` }}>
                  {key.is_active ? 'Active' : 'Revoked'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <code style={{ fontSize: 13, color: '#6b8f7e', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>
                  {key.key_prefix}••••••••
                </code>
                <CopyBtn text={key.key_prefix} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {(key.scopes || []).map((s: string) => <ScopeTag key={s} scope={s} />)}
              </div>
            </div>
            <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: '#6b8f7e', marginBottom: 4 }}>
                {key.rate_limit_rpm} req/min
              </div>
              <div style={{ fontSize: 11, color: '#6b8f7e', marginBottom: 12 }}>
                {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}` : 'Never used'}
              </div>
              <button
                style={{ ...S.btn, ...S.btnDanger, padding: '6px 14px', fontSize: 12 }}
                onClick={() => revokeKey.mutate(key.id)}
              >
                <Trash2 size={13} /> Revoke
              </button>
            </div>
          </div>
        ))
      )}

      {/* Webhooks Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '40px 0 16px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#e8f4f0', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Webhook size={18} style={{ color: '#7c6fff' }} /> Webhooks
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b8f7e' }}>Receive real-time events at your endpoints</p>
        </div>
        <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => setShowWebhook(true)}>
          <Plus size={16} /> Add Webhook
        </button>
      </div>

      {(hooks as any[]).length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center' as const, padding: 48 }}>
          <Webhook size={40} style={{ color: '#2a4a3a', margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#6b8f7e', margin: 0 }}>No webhooks registered yet.</p>
        </div>
      ) : (
        (hooks as any[]).map((wh: any) => (
          <div key={wh.id} style={{ ...S.card, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(124,111,255,0.1)', border: '1px solid rgba(124,111,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Webhook size={18} style={{ color: '#7c6fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#e8f4f0', fontSize: 15, marginBottom: 4 }}>{wh.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <code style={{ fontSize: 12, color: '#6b8f7e', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>{wh.url}</code>
                <CopyBtn text={wh.url} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {(wh.events || []).map((ev: string) => (
                  <span key={ev} style={{ ...S.tag, background: 'rgba(124,111,255,0.1)', color: '#7c6fff', border: '1px solid rgba(124,111,255,0.2)' }}>
                    {ev.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button style={{ ...S.btn, ...S.btnGhost, padding: '7px 14px', fontSize: 12 }} onClick={() => testHook.mutate(wh.id)}>
                <RefreshCw size={13} /> Test
              </button>
              <button style={{ ...S.btn, ...S.btnDanger, padding: '7px 14px', fontSize: 12 }} onClick={() => deleteHook.mutate(wh.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))
      )}

      {/* Docs callout */}
      <div style={{ ...S.card, background: 'linear-gradient(135deg,rgba(0,212,170,0.06),rgba(124,111,255,0.06))', borderColor: 'rgba(0,212,170,0.15)', marginTop: 32, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Code2 size={32} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#e8f4f0', fontSize: 15, marginBottom: 4 }}>Interactive API Documentation</div>
          <div style={{ fontSize: 13, color: '#6b8f7e' }}>Full OpenAPI / Swagger docs with live try-it-out, request examples, and schema explorer.</div>
        </div>
        <a href="/docs" target="_blank" style={{ ...S.btn, ...S.btnPrimary, textDecoration: 'none', flexShrink: 0 }}>
          Open Docs <ExternalLink size={14} />
        </a>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(secret) => { setShowCreate(false); setNewSecret(secret) }}
        />
      )}
      {newSecret && <SecretRevealModal secret={newSecret} onClose={() => setNewSecret(null)} />}
      {showWebhook && <CreateWebhookModal onClose={() => setShowWebhook(false)} />}
    </div>
  )
}
