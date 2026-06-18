import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  GitBranch, MapPin, BarChart2, Upload, Plus, Trash2,
  ArrowUp, ArrowDown, Minus, Wifi, WifiOff, Send,
  Building2, Users, Zap, Leaf, Trophy, Settings,
  ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react'

// ─── API ─────────────────────────────────────────────────────────
const franchiseApi = {
  getGroups: () => api.get('/api/v1/franchise/groups').then(r => r.data),
  createGroup: (d: any) => api.post('/api/v1/franchise/groups', d).then(r => r.data),
  deleteGroup: (id: string) => api.delete(`/api/v1/franchise/groups/${id}`).then(r => r.data),
  getSites: (gid: string) => api.get(`/api/v1/franchise/groups/${gid}/sites`).then(r => r.data),
  addSite: (gid: string, d: any) => api.post(`/api/v1/franchise/groups/${gid}/sites`, d).then(r => r.data),
  removeSite: (gid: string, sid: string) => api.delete(`/api/v1/franchise/groups/${gid}/sites/${sid}`).then(r => r.data),
  getBenchmarks: (gid: string) => api.get(`/api/v1/franchise/groups/${gid}/benchmarks`).then(r => r.data),
  getMapData: (gid: string) => api.get(`/api/v1/franchise/groups/${gid}/map`).then(r => r.data),
  getDashboard: (gid: string) => api.get(`/api/v1/franchise/groups/${gid}/dashboard`).then(r => r.data),
  getRecipePushes: (gid: string) => api.get(`/api/v1/franchise/groups/${gid}/recipe-pushes`).then(r => r.data),
  pushRecipe: (gid: string, d: any) => api.post(`/api/v1/franchise/groups/${gid}/recipe-pushes`, d).then(r => r.data),
  getConfigPushes: (gid: string) => api.get(`/api/v1/franchise/groups/${gid}/config-pushes`).then(r => r.data),
  pushConfig: (gid: string, d: any) => api.post(`/api/v1/franchise/groups/${gid}/config-pushes`, d).then(r => r.data),
}

// ─── Helpers ─────────────────────────────────────────────────────
const PUSH_STATUS_COLORS: Record<string, string> = {
  pushed: '#3b82f6', acknowledged: '#f59e0b', applied: '#10b981', pending: '#64748b',
}

function ScoreBadge({ score, label, icon: Icon, unit = '' }: any) {
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{score}{unit}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: '#64748b', marginTop: 2 }}>
        <Icon size={10} /> {label}
      </div>
    </div>
  )
}

// ─── Create Group Modal ───────────────────────────────────────────
function CreateGroupModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({ name: '', description: '', hq_location: '', brand_color: '#00d4aa' })
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16, width: '100%', maxWidth: 480, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f6ff', marginBottom: 20 }}>Create Franchise Group</div>
        {[
          { k: 'name', label: 'Group Name', ph: 'e.g. VertiFarm India Network' },
          { k: 'description', label: 'Description', ph: 'Brief description' },
          { k: 'hq_location', label: 'HQ Location', ph: 'e.g. Bengaluru, Karnataka' },
        ].map(({ k, label, ph }) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>{label}</label>
            <input value={(form as any)[k]} onChange={set(k)} placeholder={ph}
              style={{ width: '100%', background: '#060d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 12px', color: '#f0f6ff', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Brand Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={form.brand_color} onChange={set('brand_color')} style={{ width: 40, height: 36, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: 13, color: '#64748b' }}>{form.brand_color}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.name}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#00d4aa', color: '#060d19', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            Create Group
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Config Push Modal ────────────────────────────────────────────
function ConfigPushModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ config_type: 'zone_targets', description: '', target_temp: '22.0', target_humidity: '65.0', target_ph: '6.1', target_ec: '2.0' })
  const mutation = useMutation({
    mutationFn: (d: any) => franchiseApi.pushConfig(groupId, d),
    onSuccess: () => { toast.success('Configuration pushed to all sites'); qc.invalidateQueries({ queryKey: ['config-pushes', groupId] }); onClose() },
    onError: () => toast.error('Push failed'),
  })

  const handlePush = () => {
    mutation.mutate({
      config_type: form.config_type,
      description: form.description,
      target_site_ids: [],
      config_payload: {
        target_temp: parseFloat(form.target_temp),
        target_humidity: parseFloat(form.target_humidity),
        target_ph: parseFloat(form.target_ph),
        target_ec: parseFloat(form.target_ec),
      },
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16, width: '100%', maxWidth: 480, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f6ff', marginBottom: 4 }}>Push Configuration to All Sites</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Zone targets will be updated across all franchise sites.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { k: 'target_temp', label: 'Target Temp (°C)' },
            { k: 'target_humidity', label: 'Target Humidity (%)' },
            { k: 'target_ph', label: 'Target pH' },
            { k: 'target_ec', label: 'Target EC (mS/cm)' },
          ].map(({ k, label }) => (
            <div key={k}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{label}</label>
              <input type="number" step="0.1" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                style={{ width: '100%', background: '#060d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '8px 10px', color: '#f0f6ff', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Description (optional)</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Q3 2027 standard zone targets"
            style={{ width: '100%', background: '#060d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 12px', color: '#f0f6ff', fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={handlePush} disabled={mutation.isPending}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#00d4aa', color: '#060d19', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Send size={13} /> {mutation.isPending ? 'Pushing…' : 'Push to All Sites'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Group Detail View ────────────────────────────────────────────
function GroupDetail({ group }: { group: any }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'map' | 'benchmarks' | 'recipes' | 'config'>('map')
  const [configModal, setConfigModal] = useState(false)

  const { data: sites = [] } = useQuery({ queryKey: ['franchise-sites', group.id], queryFn: () => franchiseApi.getSites(group.id) })
  const { data: dash } = useQuery({ queryKey: ['franchise-dash', group.id], queryFn: () => franchiseApi.getDashboard(group.id) })
  const { data: benchmarks } = useQuery({ queryKey: ['franchise-benchmarks', group.id], queryFn: () => franchiseApi.getBenchmarks(group.id), enabled: tab === 'benchmarks' })
  const { data: recipePushes = [] } = useQuery({ queryKey: ['recipe-pushes', group.id], queryFn: () => franchiseApi.getRecipePushes(group.id), enabled: tab === 'recipes' })
  const { data: configPushes = [] } = useQuery({ queryKey: ['config-pushes', group.id], queryFn: () => franchiseApi.getConfigPushes(group.id), enabled: tab === 'config' })

  return (
    <div>
      {/* KPI row */}
      {dash && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Sites', value: dash.total_sites, color: '#f0f6ff', icon: Building2 },
            { label: 'Network Yield/mo', value: `${(dash.network_yield_kg_month / 1000).toFixed(1)}t`, color: '#10b981', icon: Leaf },
            { label: 'Energy/mo', value: `${(dash.network_energy_kwh_month / 1000).toFixed(1)}MWh`, color: '#f59e0b', icon: Zap },
            { label: 'Avg Quality', value: `${dash.avg_quality_score}%`, color: '#00d4aa', icon: Trophy },
            { label: 'Pending Pushes', value: dash.recipe_pushes_pending + dash.config_pushes_pending, color: '#3b82f6', icon: Send },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, marginBottom: 6 }}><Icon size={12} />{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, background: '#060d19', borderRadius: 10, padding: 4 }}>
          {(['map', 'benchmarks', 'recipes', 'config'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: tab === t ? '#0c1525' : 'transparent', color: tab === t ? '#f0f6ff' : '#64748b', fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t === 'map' ? 'Sites Map' : t === 'recipes' ? 'Recipe Pushes' : t === 'config' ? 'Config Pushes' : 'Benchmarks'}
            </button>
          ))}
        </div>
        {tab === 'config' && (
          <button onClick={() => setConfigModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#00d4aa', borderRadius: 8, border: 'none', color: '#060d19', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Send size={13} /> Push Config
          </button>
        )}
      </div>

      {/* Sites Map tab — list + pseudo-map */}
      {tab === 'map' && (
        <div>
          {/* Map placeholder */}
          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, marginBottom: 14, padding: '14px 18px', position: 'relative', overflow: 'hidden', minHeight: 200 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 40% 60%,rgba(0,212,170,0.04),transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={12} /> India Network — {(sites as any[]).length} sites</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(sites as any[]).map((s: any) => (
                <div key={s.id} style={{ background: '#0f1e36', border: `1px solid ${group.brand_color || '#00d4aa'}44`, borderRadius: 8, padding: '8px 12px', minWidth: 140 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: group.brand_color || '#00d4aa' }}>{s.site_code}</div>
                  <div style={{ fontSize: 12, color: '#f0f6ff', marginTop: 2 }}>{s.display_name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.city}, {s.state}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                    {s.is_active ? <Wifi size={10} color="#10b981" /> : <WifiOff size={10} color="#ef4444" />}
                    <span style={{ fontSize: 10, color: s.is_active ? '#10b981' : '#ef4444' }}>{s.is_active ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Benchmarks tab */}
      {tab === 'benchmarks' && benchmarks && (
        <div>
          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 10 }}>Network Averages</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div><span style={{ fontSize: 12, color: '#64748b' }}>Yield Efficiency</span><div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{benchmarks.network_averages.yield_efficiency}%</div></div>
              <div><span style={{ fontSize: 12, color: '#64748b' }}>Energy Use</span><div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{benchmarks.network_averages.energy_use_kwh_kg} kWh/kg</div></div>
              <div><span style={{ fontSize: 12, color: '#64748b' }}>Quality Score</span><div style={{ fontSize: 18, fontWeight: 700, color: '#00d4aa' }}>{benchmarks.network_averages.quality_score}%</div></div>
            </div>
          </div>
          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  {['Rank', 'Site', 'Yield Efficiency', 'Energy (kWh/kg)', 'Quality', 'Overall'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {benchmarks.ranking.map((r: any, i: number) => {
                  const medalColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#c97c3a' : '#475569'
                  return (
                    <tr key={r.site_id} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: medalColor }}>#{r.rank}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff' }}>{r.display_name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{r.city}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 60, height: 6, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${r.yield_efficiency}%`, background: '#10b981', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>{r.yield_efficiency}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>{r.energy_use_kwh_kg}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#00d4aa', fontWeight: 600 }}>{r.quality_score}%</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#f0f6ff' }}>{r.overall_score}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recipe Pushes tab */}
      {tab === 'recipes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(recipePushes as any[]).map((push: any) => (
            <div key={push.id} style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 4 }}>
                  {push.recipe_name || push.recipe_id}
                </div>
                {push.push_notes && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{push.push_notes}</div>}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>{new Date(push.pushed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>ACK: {push.acknowledged_count}/{push.target_site_ids.length || group.site_count || '—'}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Applied: {push.applied_count}</span>
                </div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${PUSH_STATUS_COLORS[push.status] || '#64748b'}22`, color: PUSH_STATUS_COLORS[push.status] || '#64748b', textTransform: 'capitalize' }}>
                {push.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Config Pushes tab */}
      {tab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(configPushes as any[]).map((push: any) => (
            <div key={push.id} style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 2 }}>
                    {push.description || push.config_type}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{new Date(push.pushed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(push.config_payload || {}).map(([k, v]: any) => (
                      <span key={k} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: '#1e293b', color: '#94a3b8' }}>
                        {k.replace('target_', '')}: <b style={{ color: '#f0f6ff' }}>{v}</b>
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Applied: {push.applied_count}</span>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${PUSH_STATUS_COLORS[push.status] || '#64748b'}22`, color: PUSH_STATUS_COLORS[push.status] || '#64748b', textTransform: 'capitalize' }}>
                    {push.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {configModal && <ConfigPushModal groupId={group.id} onClose={() => setConfigModal(false)} />}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function FranchisePage() {
  const qc = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)

  const { data: groups = [], isLoading } = useQuery({ queryKey: ['franchise-groups'], queryFn: franchiseApi.getGroups })

  const createMutation = useMutation({
    mutationFn: franchiseApi.createGroup,
    onSuccess: (g) => { toast.success('Franchise group created'); qc.invalidateQueries({ queryKey: ['franchise-groups'] }); setSelectedGroup(g); setCreateModal(false) },
    onError: () => toast.error('Failed to create group'),
  })
  const deleteMutation = useMutation({
    mutationFn: franchiseApi.deleteGroup,
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['franchise-groups'] }); setSelectedGroup(null) },
  })

  // Auto-select first group
  React.useEffect(() => {
    if (!selectedGroup && (groups as any[]).length > 0) {
      setSelectedGroup((groups as any[])[0])
    }
  }, [groups])

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <GitBranch size={20} color="#00d4aa" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Franchise / Multi-Site</h1>
            </div>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Centralised control for franchise operators running 10–50 farm sites.</p>
          </div>
          <button onClick={() => setCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#00d4aa', borderRadius: 10, border: 'none', color: '#060d19', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <Plus size={15} /> New Franchise Group
          </button>
        </div>
      </div>

      {isLoading && <div style={{ color: '#64748b', padding: 20 }}>Loading…</div>}

      {/* Group selector */}
      {(groups as any[]).length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(groups as any[]).map((g: any) => (
            <button key={g.id} onClick={() => setSelectedGroup(g)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, border: `1px solid ${selectedGroup?.id === g.id ? g.brand_color || '#00d4aa' : 'rgba(148,163,184,0.2)'}`, background: selectedGroup?.id === g.id ? `${g.brand_color || '#00d4aa'}18` : 'transparent', color: selectedGroup?.id === g.id ? g.brand_color || '#00d4aa' : '#94a3b8', fontWeight: selectedGroup?.id === g.id ? 600 : 400, fontSize: 13, cursor: 'pointer' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.brand_color || '#00d4aa', flexShrink: 0 }} />
              {g.name}
              <span style={{ fontSize: 11, opacity: 0.7 }}>({g.site_count} sites)</span>
            </button>
          ))}
        </div>
      )}

      {/* Group detail */}
      {selectedGroup ? (
        <div>
          {/* Group header */}
          <div style={{ background: '#0c1525', border: `1px solid ${selectedGroup.brand_color || '#00d4aa'}33`, borderRadius: 14, padding: '18px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${selectedGroup.brand_color || '#00d4aa'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GitBranch size={20} color={selectedGroup.brand_color || '#00d4aa'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f6ff' }}>{selectedGroup.name}</div>
              {selectedGroup.description && <div style={{ fontSize: 13, color: '#64748b' }}>{selectedGroup.description}</div>}
              {selectedGroup.hq_location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569', marginTop: 2 }}>
                  <MapPin size={10} /> HQ: {selectedGroup.hq_location}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${selectedGroup.brand_color || '#00d4aa'}18`, color: selectedGroup.brand_color || '#00d4aa' }}>
                {selectedGroup.site_count} sites
              </span>
              <button onClick={() => deleteMutation.mutate(selectedGroup.id)}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <GroupDetail group={selectedGroup} />
        </div>
      ) : !isLoading && (groups as any[]).length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <GitBranch size={48} style={{ margin: '0 auto 16px', opacity: 0.3, display: 'block' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>No franchise groups yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Create a franchise group to manage multiple farm sites from a central dashboard.</div>
          <button onClick={() => setCreateModal(true)} style={{ padding: '10px 24px', background: '#00d4aa', borderRadius: 10, border: 'none', color: '#060d19', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Create First Group
          </button>
        </div>
      )}

      {createModal && <CreateGroupModal onClose={() => setCreateModal(false)} onSave={d => createMutation.mutate(d)} />}
    </div>
  )
}
