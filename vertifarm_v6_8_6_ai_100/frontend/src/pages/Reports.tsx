import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  BarChart3, TrendingUp, DollarSign, Leaf, Shield,
  Plus, Play, Trash2, Calendar, Mail, Download,
  CheckCircle, Clock, RefreshCw, Settings2, X,
  LayoutGrid, ChevronDown, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from 'recharts'

const C = {
  accent: '#00d4aa', amber: '#ffb547', red: '#ff4d6d',
  blue: '#3b82f6', purple: '#8b5cf6', muted: '#64748b',
  green: '#10b981',
}
const TS = {
  contentStyle: { background: '#0c1525', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8, fontSize: 11, color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8', fontSize: 11 },
}

type ReportTab = 'reports' | 'yield' | 'cost' | 'sustainability' | 'compliance'

const REPORT_TYPES = [
  { id: 'yield_performance',  label: 'Yield Performance',   icon: TrendingUp,  color: C.accent },
  { id: 'cost_of_production', label: 'Cost of Production',  icon: DollarSign,  color: C.amber },
  { id: 'sustainability',     label: 'Sustainability',       icon: Leaf,        color: C.green },
  { id: 'compliance',         label: 'Compliance',           icon: Shield,      color: C.blue },
]

/* ─── Small helpers ─────────────────────────────────────── */
function fmt(n: number, prefix = '') {
  if (n >= 1_00_000) return `${prefix}${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000)    return `${prefix}${(n / 1_000).toFixed(1)}K`
  return `${prefix}${n.toFixed(0)}`
}

function Kpi({ label, value, sub, color = C.accent, icon: Icon }: any) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 15, height: 15, color }} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>{label}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14, marginTop: 0 }}>{children}</h3>
}

function DaySelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {[7, 30, 90].map(d => (
        <button key={d} onClick={() => onChange(d)}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${value === d ? C.accent : 'rgba(148,163,184,0.2)'}`, background: value === d ? 'rgba(0,212,170,0.1)' : 'transparent', color: value === d ? C.accent : C.muted }}>
          {d}d
        </button>
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('reports')

  const TABS: { id: ReportTab; label: string; icon: any }[] = [
    { id: 'reports',        label: 'Scheduled Reports', icon: Calendar },
    { id: 'yield',          label: 'Yield Performance', icon: TrendingUp },
    { id: 'cost',           label: 'Cost of Production', icon: DollarSign },
    { id: 'sustainability', label: 'Sustainability',    icon: Leaf },
    { id: 'compliance',     label: 'Compliance',        icon: Shield },
  ]

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,rgba(59,130,246,0.2),rgba(139,92,246,0.2))', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 style={{ width: 22, height: 22, color: C.blue }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Analytics & Reports</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Phase 3 · Board-level and operational reporting</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
              borderBottom: tab === t.id ? `2px solid ${C.blue}` : '2px solid transparent',
              color: tab === t.id ? C.blue : C.muted,
              fontSize: 12, fontWeight: tab === t.id ? 700 : 500, transition: 'all 0.15s',
            }}>
            <t.icon style={{ width: 13, height: 13 }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reports'        && <ScheduledReports />}
      {tab === 'yield'          && <YieldPerformanceTab />}
      {tab === 'cost'           && <CostProductionTab />}
      {tab === 'sustainability' && <SustainabilityTab />}
      {tab === 'compliance'     && <ComplianceTab />}
    </div>
  )
}

/* ── Scheduled Reports ──────────────────────────────────── */
function ScheduledReports() {
  const qc = useQueryClient()
  const { data: reports = [] } = useQuery({ queryKey: ['reports-list'], queryFn: reportsApi.list })
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'yield_performance', schedule: 'monthly', recipients: '', filters: '' })

  const createMut = useMutation({
    mutationFn: (d: any) => reportsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports-list'] }); setShowCreate(false); toast.success('Report created') },
    onError: () => toast.error('Failed to create report'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports-list'] }); toast.success('Report deleted') },
  })
  const genMut = useMutation({
    mutationFn: (id: string) => reportsApi.generate(id),
    onSuccess: () => toast.success('Report generation queued — PDF will be emailed'),
    onError: () => toast.error('Failed to trigger generation'),
  })

  const SCHED_COLOR: Record<string, string> = { once: C.muted, daily: C.blue, weekly: C.accent, monthly: C.purple }
  const TYPE_META: Record<string, { icon: any; color: string }> = {
    yield_performance:  { icon: TrendingUp, color: C.accent },
    cost_of_production: { icon: DollarSign, color: C.amber },
    sustainability:     { icon: Leaf,       color: C.green },
    compliance:         { icon: Shield,     color: C.blue },
    custom:             { icon: Settings2,  color: C.purple },
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Schedule automated PDF reports for stakeholders</p>
        <button onClick={() => setShowCreate(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: C.blue, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          <Plus style={{ width: 14, height: 14 }} /> New Report
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>New Scheduled Report</h4>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'name', label: 'Report Name', type: 'text', placeholder: 'e.g. Monthly Yield Summary' },
              { key: 'recipients', label: 'Recipients (comma-separated emails)', type: 'text', placeholder: 'ceo@farm.com, board@farm.com' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} type="text"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            ))}
            {[
              { key: 'type', label: 'Report Type', options: REPORT_TYPES.map(r => ({ v: r.id, l: r.label })) },
              { key: 'schedule', label: 'Schedule', options: [{ v: 'once', l: 'Once' }, { v: 'daily', l: 'Daily' }, { v: 'weekly', l: 'Weekly' }, { v: 'monthly', l: 'Monthly' }] },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <select value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--text)', fontSize: 12 }}>
                  {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => createMut.mutate({
                name: form.name, type: form.type, schedule: form.schedule,
                recipients: form.recipients.split(',').map(s => s.trim()).filter(Boolean),
                filters: {}, widgets: [],
              })}
              style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: C.blue, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
              Create Report
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '8px 20px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Report list */}
      <div className="space-y-3">
        {(reports as any[]).length === 0 && !showCreate && (
          <div className="card p-10" style={{ textAlign: 'center' }}>
            <BarChart3 style={{ width: 40, height: 40, color: C.muted, margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ color: C.muted, fontSize: 13 }}>No reports yet. Create your first scheduled report.</p>
          </div>
        )}
        {(reports as any[]).map((r: any) => {
          const meta = TYPE_META[r.type] || TYPE_META.custom
          const Icon = meta.icon
          return (
            <div key={r.id} className="card p-4">
              <div className="flex items-center gap-4">
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 17, height: 17, color: meta.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.name}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span style={{ fontSize: 11, color: C.muted, textTransform: 'capitalize' }}>{r.type?.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 12, background: `${(SCHED_COLOR as any)[r.schedule] || C.muted}18`, color: (SCHED_COLOR as any)[r.schedule] || C.muted, fontWeight: 600 }}>
                      {r.schedule}
                    </span>
                    {(r.recipients || []).length > 0 && (
                      <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail style={{ width: 10, height: 10 }} />
                        {(r.recipients || []).slice(0, 2).join(', ')}
                        {(r.recipients || []).length > 2 && ` +${(r.recipients || []).length - 2}`}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {r.last_generated_at ? (
                    <div style={{ fontSize: 11, color: C.muted }}>
                      <Clock style={{ display: 'inline', width: 10, height: 10, marginRight: 4 }} />
                      {new Date(r.last_generated_at).toLocaleDateString()}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.muted }}>Never generated</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => genMut.mutate(r.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', color: C.accent, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                    <Play style={{ width: 10, height: 10 }} /> Generate
                  </button>
                  <button onClick={() => deleteMut.mutate(r.id)}
                    style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', color: C.red, cursor: 'pointer' }}>
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Yield Performance ──────────────────────────────────── */
function YieldPerformanceTab() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useQuery({
    queryKey: ['rpt-yield', days],
    queryFn: () => reportsApi.yieldPerformance({ days }),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Yield Performance Report</h2>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Actual vs target per farm, per crop type, trend over selected period</p>
        </div>
        <DaySelect value={days} onChange={setDays} />
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading report…</div>}
      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <Kpi label="Total Yield" value={`${data.total_yield_kg?.toFixed(0)} kg`} sub={`Target: ${data.total_target_kg?.toFixed(0)} kg`} icon={TrendingUp} color={C.accent} />
            <Kpi label="Achievement" value={`${data.achievement_pct?.toFixed(1)}%`} sub={data.achievement_pct >= 100 ? '✓ On target' : 'Below target'} icon={BarChart3} color={data.achievement_pct >= 95 ? C.accent : C.amber} />
            <Kpi label="Top Zone" value={data.top_zones?.[0]?.zone?.split('—')[0]?.trim() || '—'} sub={`${data.top_zones?.[0]?.score}% efficiency`} icon={ArrowUpRight} color={C.green} />
            <Kpi label="Needs Attention" value={data.bottom_zones?.[0]?.zone?.split('—')[0]?.trim() || '—'} sub={data.bottom_zones?.[0]?.issue || 'Low performer'} icon={ArrowDownRight} color={C.red} />
          </div>

          {/* Trend chart */}
          <div className="card p-4">
            <SectionTitle>Weekly Yield Trend (Actual vs Target)</SectionTitle>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.trend || []} margin={{ top: 5, right: 15, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="yg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.accent} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.muted }} width={40} axisLine={false} tickLine={false} />
                <Tooltip {...TS} />
                <Area type="monotone" dataKey="yield_kg" fill="url(#yg)" stroke={C.accent} strokeWidth={2} name="Actual kg" dot={false} />
                <Line type="monotone" dataKey="target_kg" stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3" name="Target kg" dot={false} />
                <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} iconSize={10} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* By farm */}
            <div className="card p-4">
              <SectionTitle>By Farm</SectionTitle>
              <div className="space-y-3">
                {(data.by_farm || []).map((f: any) => (
                  <div key={f.farm_id}>
                    <div className="flex justify-between mb-1">
                      <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{f.farm_name}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{f.yield_kg} / {f.target_kg} kg · <b style={{ color: f.achievement_pct >= 95 ? C.accent : C.amber }}>{f.achievement_pct}%</b></span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(148,163,184,0.1)' }}>
                      <div style={{ height: '100%', width: `${Math.min(f.achievement_pct, 100)}%`, background: f.achievement_pct >= 95 ? C.accent : C.amber, borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By crop */}
            <div className="card p-4">
              <SectionTitle>By Crop Type</SectionTitle>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.by_crop_type || []} layout="vertical" margin={{ top: 0, right: 15, bottom: 0, left: 60 }}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="crop_type" type="category" tick={{ fontSize: 10, fill: C.muted }} width={60} axisLine={false} tickLine={false} />
                  <Tooltip {...TS} />
                  <Bar dataKey="yield_kg" fill={C.accent} radius={[0, 4, 4, 0]} name="Yield kg" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom zones */}
          <div className="card p-4">
            <SectionTitle>⚠ Bottom Performing Zones — Needs Action</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {(data.bottom_zones || []).map((z: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,77,109,0.05)', border: '1px solid rgba(255,77,109,0.15)' }}>
                  <ArrowDownRight style={{ width: 16, height: 16, color: C.red, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{z.zone}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{z.yield_kg} kg · Score {z.score}%</div>
                    {z.issue && <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>Issue: {z.issue}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Cost of Production ─────────────────────────────────── */
function CostProductionTab() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useQuery({
    queryKey: ['rpt-cost', days],
    queryFn: () => reportsApi.costOfProduction({ days }),
  })

  const PIE_COLORS = [C.red, C.amber, C.blue, C.purple, C.green, C.muted]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Cost of Production Report</h2>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Energy + water + nutrients + labour per kg of yield</p>
        </div>
        <DaySelect value={days} onChange={setDays} />
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading cost data…</div>}
      {data && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Kpi label="Total Cost" value={`₹${fmt(data.total_cost_inr)}`} sub={`Last ${days} days`} icon={DollarSign} color={C.amber} />
            <Kpi label="Cost per kg" value={`₹${data.cost_per_kg_inr?.toFixed(2)}`} sub="All in cost" icon={BarChart3} color={C.blue} />
            <Kpi label="Total Yield" value={`${data.total_yield_kg?.toFixed(0)} kg`} sub="Actual produced" icon={TrendingUp} color={C.accent} />
            <Kpi label="Biggest Cost" value={data.by_category?.[0]?.category || '—'} sub={`${data.by_category?.[0]?.pct}% of total`} icon={ArrowUpRight} color={C.red} />
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Pie breakdown */}
            <div className="card p-4">
              <SectionTitle>Cost Breakdown by Category</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.by_category || []} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="cost_inr" nameKey="category">
                    {(data.by_category || []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TS} formatter={(v: any) => [`₹${fmt(v)}`, 'Cost']} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: C.muted }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category table */}
            <div className="card p-4">
              <SectionTitle>Category Detail</SectionTitle>
              <div className="space-y-2">
                {(data.by_category || []).map((c: any, i: number) => (
                  <div key={c.category} className="flex items-center gap-3">
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{c.category}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>₹{fmt(c.cost_inr)}</span>
                    <span style={{ fontSize: 11, color: C.muted, minWidth: 38, textAlign: 'right' }}>{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cost/kg trend */}
          <div className="card p-4">
            <SectionTitle>Weekly Cost per kg Trend</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.trend || []} margin={{ top: 5, right: 15, bottom: 0, left: 0 }}>
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.muted }} width={45} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip {...TS} formatter={(v: any) => [`₹${v}`, 'Cost/kg']} />
                <Line type="monotone" dataKey="cost_per_kg" stroke={C.amber} strokeWidth={2} dot={false} name="₹/kg" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* By farm */}
          <div className="card p-4">
            <SectionTitle>Cost Efficiency by Farm</SectionTitle>
            <div className="space-y-2">
              {(data.by_farm || []).map((f: any) => (
                <div key={f.farm_name} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{f.farm_name}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{f.yield_kg} kg</span>
                  <span style={{ fontSize: 12, color: C.amber, fontWeight: 700 }}>₹{f.cost_per_kg}/kg</span>
                  <span style={{ fontSize: 12, color: C.muted }}>₹{fmt(f.total_cost_inr)} total</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Sustainability ──────────────────────────────────────── */
function SustainabilityTab() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useQuery({
    queryKey: ['rpt-sustain', days],
    queryFn: () => reportsApi.sustainability({ days }),
  })

  const RADIAL = data ? [
    { name: 'Score', value: data.sustainability_score, fill: C.accent },
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Sustainability Report</h2>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Water saved vs soil farming, carbon footprint, renewable energy %, water recycling</p>
        </div>
        <DaySelect value={days} onChange={setDays} />
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading sustainability data…</div>}
      {data && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Kpi label="Water Saved" value={`${(data.water_saved_litres / 1000).toFixed(0)}KL`} sub={`${data.vs_soil_farming_pct}% less than soil`} icon={Leaf} color={C.accent} />
            <Kpi label="Pesticide-Free" value={`${data.pesticide_free_days}d`} sub="100% pesticide-free" icon={CheckCircle} color={C.green} />
            <Kpi label="Renewable Energy" value={`${data.renewable_energy_pct}%`} sub="Of total consumption" icon={BarChart3} color={C.blue} />
            <Kpi label="Water Recycling" value={`${data.water_recycling_rate_pct}%`} sub="Recirculation rate" icon={RefreshCw} color={C.purple} />
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Score dial */}
            <div className="card p-4 flex flex-col items-center justify-center">
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>Sustainability Score</div>
              <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart cx="50%" cy="65%" innerRadius="60%" outerRadius="100%" startAngle={180} endAngle={0} data={RADIAL}>
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'rgba(148,163,184,0.1)' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 36, fontWeight: 900, color: C.accent, marginTop: -20 }}>{data.sustainability_score}</div>
              <div style={{ fontSize: 11, color: C.muted }}>/ 100</div>
            </div>

            {/* Metrics table */}
            <div className="card p-4 col-span-2">
              <SectionTitle>vs Industry Benchmarks</SectionTitle>
              <div className="space-y-3">
                {(data.by_metric || []).map((m: any) => (
                  <div key={m.metric} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.metric}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>+{m.improvement_pct}% better</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      <span style={{ color: C.accent, fontWeight: 700 }}>{m.value}</span>
                      <span style={{ margin: '0 8px', opacity: 0.5 }}>vs</span>
                      {m.benchmark}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Certifications */}
          <div className="card p-4">
            <SectionTitle>Certifications & Compliance Status</SectionTitle>
            <div className="flex flex-wrap gap-3">
              {(data.certifications || []).map((cert: string) => (
                <div key={cert} className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle style={{ width: 14, height: 14, color: C.green }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{cert}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Compliance ─────────────────────────────────────────── */
function ComplianceTab() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useQuery({
    queryKey: ['rpt-compliance', days],
    queryFn: () => reportsApi.compliance({ days }),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Compliance Report</h2>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>FSSAI-ready nutrient log, pesticide-free declaration, cold chain temperature log</p>
        </div>
        <DaySelect value={days} onChange={setDays} />
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Loading compliance data…</div>}
      {data && (
        <>
          {/* Status flags */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'FSSAI Compliant', ok: data.fssai_compliant, icon: Shield },
              { label: 'Pesticide-Free', ok: data.pesticide_free, icon: CheckCircle },
              { label: 'Cold Chain', ok: data.temperature_excursions < 3, icon: BarChart3 },
              { label: 'Batch Traceability', ok: data.batch_traceability_pct > 90, icon: BarChart3 },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <s.icon style={{ width: 16, height: 16, color: s.ok ? C.green : C.red }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.ok ? C.green : C.red }}>{s.ok ? 'COMPLIANT' : 'REVIEW'}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Certifications */}
            <div className="card p-4">
              <SectionTitle>Certifications</SectionTitle>
              <div className="space-y-3">
                {(data.certifications || []).map((cert: any) => (
                  <div key={cert.name} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cert.status === 'active' ? C.green : C.amber, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{cert.name}</div>
                      {cert.expires && <div style={{ fontSize: 11, color: C.muted }}>Expires {cert.expires}</div>}
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: cert.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(255,181,71,0.1)', color: cert.status === 'active' ? C.green : C.amber, textTransform: 'uppercase', fontWeight: 700 }}>{cert.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cold chain stats */}
            <div className="card p-4">
              <SectionTitle>Cold Chain Compliance</SectionTitle>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div style={{ textAlign: 'center', padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: data.cold_chain_compliance_pct > 95 ? C.accent : C.amber }}>{data.cold_chain_compliance_pct}%</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Compliance rate</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: data.temperature_excursions < 3 ? C.accent : C.red }}>{data.temperature_excursions}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Excursions</div>
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Recent Temperature Log</div>
              <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                {(data.temperature_log_sample || []).slice(0, 6).map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', fontSize: 11 }}>
                    <span style={{ color: C.muted }}>{t.zone}</span>
                    <span style={{ color: t.within_range ? C.accent : C.red, fontWeight: 600 }}>{t.temperature_c}°C</span>
                    <span style={{ color: t.within_range ? C.green : C.red }}>{t.within_range ? '✓' : '⚠'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Nutrient log */}
          <div className="card p-4">
            <SectionTitle>FSSAI Nutrient Log (Sample — {data.nutrient_logs_count} total records)</SectionTitle>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                    {['Date', 'Zone', 'EC (mS/cm)', 'pH', 'N (ppm)', 'Operator'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: C.muted, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.nutrient_log_sample || []).map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                      <td style={{ padding: '7px 12px', color: C.muted }}>{row.date}</td>
                      <td style={{ padding: '7px 12px', color: 'var(--text)', fontWeight: 600 }}>{row.zone}</td>
                      <td style={{ padding: '7px 12px', color: C.accent, fontWeight: 700 }}>{row.ec_mscm}</td>
                      <td style={{ padding: '7px 12px', color: C.blue, fontWeight: 700 }}>{row.ph}</td>
                      <td style={{ padding: '7px 12px', color: 'var(--text)' }}>{row.nitrogen_ppm}</td>
                      <td style={{ padding: '7px 12px', color: C.muted }}>{row.operator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', color: C.accent, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                <Download style={{ width: 12, height: 12 }} /> Export CSV
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: C.blue, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                <Download style={{ width: 12, height: 12 }} /> Export PDF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
