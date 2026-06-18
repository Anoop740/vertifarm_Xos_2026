import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Plug, CheckCircle2, XCircle, RefreshCw, Settings,
  X, ExternalLink, Clock, AlertCircle, Search
} from 'lucide-react'

const S = {
  page:     { padding: '32px', maxWidth: 1200 } as React.CSSProperties,
  header:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 } as React.CSSProperties,
  title:    { fontSize: 26, fontWeight: 700, color: '#e8f4f0', margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 14, color: '#6b8f7e', marginTop: 4 } as React.CSSProperties,
  btn:      { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 } as React.CSSProperties,
  btnP:     { background: 'linear-gradient(135deg,#00d4aa,#00b894)', color: '#003d29' } as React.CSSProperties,
  btnG:     { background: 'rgba(255,255,255,0.06)', color: '#a0c4b4', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties,
  btnD:     { background: 'rgba(255,77,109,0.1)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.2)' } as React.CSSProperties,
  card:     { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(0,212,170,0.1)', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
  label:    { fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
  input:    { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e8f4f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
  modal:    { position: 'fixed' as const, top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' },
  modalBox: { background: '#0d1f17', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 18, padding: 32, width: 500, maxWidth: '95vw' } as React.CSSProperties,
}

const CATEGORY_COLORS: Record<string, string> = {
  ERP: '#7c6fff', Logistics: '#ffb547', Weather: '#00bfff',
  Certifications: '#00d4aa', Communication: '#ff9e64', LIMS: '#ff4d6d',
}

function ConnectModal({
  item, onClose
}: {
  item: any
  onClose: () => void
}) {
  const [apiKey, setApiKey]   = useState('')
  const [secret, setSecret]   = useState('')
  const [config, setConfig]   = useState<Record<string, string>>({})
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (d: any) => api.post('/api/v1/integrations', d).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] })
      toast.success(`${item.name} connected!`)
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? 'Connection failed'),
  })

  const isOAuth = item.auth === 'oauth2'

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>{item.logo}</span>
            <div>
              <h3 style={{ margin: 0, color: '#e8f4f0', fontSize: 17, fontWeight: 700 }}>{item.name}</h3>
              <span style={{ fontSize: 11, color: CATEGORY_COLORS[item.category] ?? '#6b8f7e', fontWeight: 600 }}>{item.category}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b8f7e' }}><X size={20} /></button>
        </div>

        <p style={{ fontSize: 13, color: '#6b8f7e', marginBottom: 24, lineHeight: 1.6 }}>{item.description}</p>

        {isOAuth ? (
          <div style={{ textAlign: 'center' as const, padding: '24px 0' }}>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#a0c4b4' }}>
              This integration uses OAuth 2.0. Click below to authorise via {item.name}'s login page.
            </div>
            <button
              style={{ ...S.btn, ...S.btnP, justifyContent: 'center', width: '100%' }}
              onClick={() => mut.mutate({ type: item.type, name: item.name, config })}
            >
              <ExternalLink size={15} /> Authorise with {item.name}
            </button>
          </div>
        ) : (
          <>
            <label style={S.label}>API Key</label>
            <input
              style={{ ...S.input, marginBottom: 16 }}
              type="password"
              placeholder={`Paste your ${item.name} API key`}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            {item.type === 'delhivery' || item.type === 'shiprocket' ? (
              <>
                <label style={S.label}>API Secret / Token</label>
                <input
                  style={{ ...S.input, marginBottom: 16 }}
                  type="password"
                  placeholder="API secret or token"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                />
              </>
            ) : null}
            {item.type === 'openweathermap' && (
              <>
                <label style={S.label}>Default City (optional)</label>
                <input
                  style={{ ...S.input, marginBottom: 16 }}
                  placeholder="e.g. Mumbai, IN"
                  value={config.city ?? ''}
                  onChange={e => setConfig(c => ({ ...c, city: e.target.value }))}
                />
              </>
            )}
            <button
              style={{ ...S.btn, ...S.btnP, justifyContent: 'center', width: '100%', marginTop: 8 }}
              disabled={!apiKey || mut.isPending}
              onClick={() => mut.mutate({ type: item.type, name: item.name, api_key: apiKey, api_secret: secret || undefined, config })}
            >
              {mut.isPending ? 'Connecting…' : `Connect ${item.name}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function IntegrationCard({
  catalogItem, connected, onConnect, onDisconnect, onSync
}: {
  catalogItem: any
  connected?: any
  onConnect: () => void
  onDisconnect: (id: string) => void
  onSync: (id: string) => void
}) {
  const isActive = connected?.is_active
  const catColor = CATEGORY_COLORS[catalogItem.category] ?? '#6b8f7e'

  return (
    <div style={{ ...S.card, display: 'flex', flexDirection: 'column' as const }}>
      {/* Top */}
      <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${catColor}15`, border: `1px solid ${catColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
          {catalogItem.logo}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: '#e8f4f0', fontSize: 15 }}>{catalogItem.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: catColor, background: `${catColor}15`, border: `1px solid ${catColor}25`, padding: '2px 8px', borderRadius: 20 }}>
              {catalogItem.category}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#6b8f7e', lineHeight: 1.5 }}>{catalogItem.description}</p>
        </div>
      </div>

      {/* Status + Actions */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {connected ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              {isActive
                ? <><CheckCircle2 size={14} style={{ color: 'var(--accent)' }} /><span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Connected</span></>
                : <><XCircle size={14} style={{ color: '#ff4d6d' }} /><span style={{ fontSize: 12, color: '#ff4d6d', fontWeight: 600 }}>Disconnected</span></>
              }
              {connected.last_synced_at && (
                <span style={{ fontSize: 11, color: '#4a6a5a', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> {new Date(connected.last_synced_at).toLocaleString()}
                </span>
              )}
              {connected.last_error && (
                <span style={{ fontSize: 11, color: '#ff4d6d', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} /> Error
                </span>
              )}
            </div>
            <button style={{ ...S.btn, ...S.btnG, padding: '6px 12px', fontSize: 12 }} onClick={() => onSync(connected.id)}>
              <RefreshCw size={12} /> Sync
            </button>
            <button style={{ ...S.btn, ...S.btnD, padding: '6px 12px', fontSize: 12 }} onClick={() => onDisconnect(connected.id)}>
              <X size={12} /> Disconnect
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: '#4a6a5a', flex: 1 }}>
              {catalogItem.auth === 'oauth2' ? '🔐 OAuth 2.0' : '🔑 API Key'}
            </span>
            <button style={{ ...S.btn, ...S.btnP, padding: '7px 18px', fontSize: 13 }} onClick={onConnect}>
              <Plug size={13} /> Connect
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const [search, setSearch]   = useState('')
  const [category, setCategory] = useState('All')
  const [connecting, setConnecting] = useState<any>(null)
  const qc = useQueryClient()

  const { data: catalog = [] } = useQuery({
    queryKey: ['integrations-catalog'],
    queryFn: () => api.get('/api/v1/integrations/catalog').then(r => r.data),
  })
  const { data: connected = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/api/v1/integrations').then(r => r.data),
  })

  const disconnect = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/integrations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations'] }); toast.success('Disconnected') },
    onError: () => toast.error('Failed to disconnect'),
  })
  const sync = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/integrations/${id}/sync`),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: ['integrations'] }); toast.success(data?.data?.message ?? 'Sync triggered') },
    onError: () => toast.error('Sync failed'),
  })

  const categories = ['All', ...Array.from(new Set((catalog as any[]).map((i: any) => i.category)))]
  const connectedMap = Object.fromEntries((connected as any[]).map((c: any) => [c.type, c]))
  const connectedCount = (connected as any[]).filter((c: any) => c.is_active).length

  const filtered = (catalog as any[]).filter((item: any) => {
    const matchCat = category === 'All' || item.category === category
    const matchSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Integration Hub</h1>
          <p style={S.subtitle}>One-click connections to ERP, logistics, weather, certifications, and more</p>
        </div>
        <div style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 10, padding: '10px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{connectedCount}</div>
          <div style={{ fontSize: 11, color: '#6b8f7e', fontWeight: 600 }}>ACTIVE</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b8f7e' }} />
          <input style={{ ...S.input, paddingLeft: 38 }} placeholder="Search integrations…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: category === cat ? `${CATEGORY_COLORS[cat] ?? '#00d4aa'}25` : 'rgba(255,255,255,0.05)',
                color: category === cat ? (CATEGORY_COLORS[cat] ?? '#00d4aa') : '#6b8f7e',
                borderColor: category === cat ? `${CATEGORY_COLORS[cat] ?? '#00d4aa'}40` : 'transparent',
                borderStyle: 'solid', borderWidth: 1,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
        {filtered.map((item: any) => (
          <IntegrationCard
            key={item.type}
            catalogItem={item}
            connected={connectedMap[item.type]}
            onConnect={() => setConnecting(item)}
            onDisconnect={(id) => disconnect.mutate(id)}
            onSync={(id) => sync.mutate(id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: '#6b8f7e' }}>
          <Plug size={40} style={{ display: 'block', margin: '0 auto 16px', color: '#2a4a3a' }} />
          <p style={{ margin: 0 }}>No integrations found for "{search}"</p>
        </div>
      )}

      {connecting && <ConnectModal item={connecting} onClose={() => setConnecting(null)} />}
    </div>
  )
}
