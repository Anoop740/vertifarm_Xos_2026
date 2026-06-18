import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { widgetsApi, phase3AiApi, reportsApi } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  LayoutGrid, Plus, X, GripVertical, Eye, EyeOff,
  TrendingUp, Activity, Zap, AlertTriangle, Calendar,
  BarChart3, Leaf, Bell, Cpu, DollarSign, Settings2,
  ChevronUp, ChevronDown, Save,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const C = { accent: '#00d4aa', amber: '#ffb547', red: '#ff4d6d', blue: '#3b82f6', purple: '#8b5cf6', muted: '#64748b', green: '#10b981' }
const TS = {
  contentStyle: { background: 'var(--card)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8, fontSize: 10, color: 'var(--text)' },
  labelStyle: { color: 'var(--text2)', fontSize: 10 },
}

/* ── Widget type metadata ───────────────────────────────── */
const WIDGET_META: Record<string, { icon: any; color: string; defaultH: number }> = {
  yield_chart:        { icon: TrendingUp,  color: C.accent,  defaultH: 200 },
  sensor_heatmap:     { icon: Activity,    color: C.blue,    defaultH: 200 },
  ai_forecast_card:   { icon: BarChart3,   color: C.purple,  defaultH: 180 },
  energy_donut:       { icon: Zap,         color: C.amber,   defaultH: 200 },
  anomaly_feed:       { icon: AlertTriangle, color: C.red,   defaultH: 220 },
  harvest_timeline:   { icon: Calendar,    color: C.green,   defaultH: 200 },
  sustainability_kpi: { icon: Leaf,        color: C.green,   defaultH: 160 },
  alert_summary:      { icon: Bell,        color: C.red,     defaultH: 140 },
  crop_status_grid:   { icon: Cpu,         color: C.accent,  defaultH: 200 },
  cost_per_kg:        { icon: DollarSign,  color: C.amber,   defaultH: 180 },
}

/* ── Live widget content renderers ──────────────────────── */
function WidgetContent({ type }: { type: string }) {
  const { data: forecast } = useQuery({
    queryKey: ['wb-forecast'],
    queryFn: () => phase3AiApi.yieldForecast({ days_ahead: 7 }),
    enabled: ['yield_chart', 'ai_forecast_card'].includes(type),
    staleTime: 60_000,
  })
  const { data: anomalies = [] } = useQuery({
    queryKey: ['wb-anomalies'],
    queryFn: () => phase3AiApi.anomalies({ resolved: false, limit: 5 }),
    enabled: type === 'anomaly_feed',
    staleTime: 30_000,
  })
  const { data: harvest = [] } = useQuery({
    queryKey: ['wb-harvest'],
    queryFn: () => phase3AiApi.harvestSchedule(),
    enabled: type === 'harvest_timeline',
    staleTime: 60_000,
  })
  const { data: energy } = useQuery({
    queryKey: ['wb-energy'],
    queryFn: () => phase3AiApi.energyOptimize(),
    enabled: ['energy_donut', 'cost_per_kg'].includes(type),
    staleTime: 120_000,
  })
  const { data: sustain } = useQuery({
    queryKey: ['wb-sustain'],
    queryFn: () => reportsApi.sustainability({ days: 30 }),
    enabled: type === 'sustainability_kpi',
    staleTime: 300_000,
  })

  const mini = { top: 4, right: 8, bottom: 0, left: 0 }

  switch (type) {
    case 'yield_chart':
      return forecast?.daily_series ? (
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={forecast.daily_series.slice(0, 7)} margin={mini}>
            <defs>
              <linearGradient id={`wbg-${type}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.accent} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 8, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 8, fill: C.muted }} width={28} axisLine={false} tickLine={false} />
            <Tooltip {...TS} />
            <Area type="monotone" dataKey="forecast_kg" fill={`url(#wbg-${type})`} stroke={C.accent} strokeWidth={1.5} name="kg" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <SkeletonChart />

    case 'ai_forecast_card':
      return forecast ? (
        <div style={{ padding: '8px 0' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.accent, lineHeight: 1 }}>{forecast.total_forecast_kg?.toFixed(1)} <span style={{ fontSize: 14 }}>kg</span></div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>7-day forecast · {forecast.confidence_pct?.toFixed(1)}% confidence</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            {(forecast.zones || []).slice(0, 3).map((z: any) => (
              <div key={z.zone_id} style={{ flex: 1, padding: '6px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>{z.forecast_kg}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{z.zone_name}</div>
              </div>
            ))}
          </div>
        </div>
      ) : <SkeletonText />

    case 'anomaly_feed':
      return (anomalies as any[]).length > 0 ? (
        <div className="space-y-2" style={{ paddingTop: 4 }}>
          {(anomalies as any[]).slice(0, 3).map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.severity === 'critical' ? C.red : a.severity === 'warning' ? C.amber : C.blue, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sensor_type} — {a.zone_name}</div>
                <div style={{ fontSize: 10, color: C.muted }}>Score {a.anomaly_score?.toFixed(2)}</div>
              </div>
              <span style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 700, color: a.severity === 'critical' ? C.red : C.amber }}>{a.severity}</span>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={AlertTriangle} text="No active anomalies" />

    case 'harvest_timeline':
      return (harvest as any[]).length > 0 ? (
        <div className="space-y-2" style={{ paddingTop: 4 }}>
          {(harvest as any[]).slice(0, 4).map((h: any) => (
            <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(0,212,170,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: C.accent, lineHeight: 1 }}>{h.days_until_optimal}</span>
                <span style={{ fontSize: 8, color: C.muted }}>days</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.crop_name}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{h.zone_name} · {h.predicted_yield_kg} kg</div>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={Calendar} text="No upcoming harvests" />

    case 'energy_donut':
      return energy ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 11, color: C.muted }}>Daily cost</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>₹{energy.optimized_daily_cost_inr?.toFixed(0)}</span>
          </div>
          <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.12)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>Saving ₹{energy.savings_per_day_inr?.toFixed(0)}/day</div>
            <div style={{ fontSize: 10, color: C.muted }}>₹{(energy.savings_per_month_inr || 0).toLocaleString()}/month · {energy.savings_pct}% optimised</div>
          </div>
        </div>
      ) : <SkeletonText />

    case 'sustainability_kpi':
      return sustain ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Water saved', value: `${((sustain as any).water_saved_litres / 1000).toFixed(0)}KL`, color: C.accent },
            { label: 'Pesticide-free', value: `${(sustain as any).pesticide_free_days}d`, color: C.green },
            { label: 'Renewable', value: `${(sustain as any).renewable_energy_pct}%`, color: C.blue },
            { label: 'Score', value: `${(sustain as any).sustainability_score}`, color: C.purple },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: C.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : <SkeletonText />

    case 'cost_per_kg':
      return energy ? (
        <div style={{ paddingTop: 4 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.amber }}>₹48.20<span style={{ fontSize: 13, color: C.muted }}>/kg</span></div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Cost of production</div>
          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.1)' }}>
            <div style={{ height: '100%', width: '72%', background: C.amber, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>72% of target efficiency</div>
        </div>
      ) : <SkeletonText />

    case 'sensor_heatmap':
    case 'crop_status_grid':
    case 'alert_summary':
    default:
      return <ComingSoon type={type} />
  }
}

function SkeletonChart() {
  return <div style={{ height: 130, borderRadius: 8, background: 'rgba(148,163,184,0.05)', animation: 'pulse 1.5s infinite' }} />
}
function SkeletonText() {
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ height: 24, width: '60%', borderRadius: 6, background: 'rgba(148,163,184,0.08)', marginBottom: 8 }} />
      <div style={{ height: 14, width: '80%', borderRadius: 5, background: 'rgba(148,163,184,0.05)' }} />
    </div>
  )
}
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, color: C.muted }}>
      <Icon style={{ width: 24, height: 24, marginBottom: 6, opacity: 0.4 }} />
      <span style={{ fontSize: 11 }}>{text}</span>
    </div>
  )
}
function ComingSoon({ type }: { type: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, color: C.muted }}>
      <LayoutGrid style={{ width: 20, height: 20, marginBottom: 6, opacity: 0.3 }} />
      <span style={{ fontSize: 10 }}>{type.replace(/_/g, ' ')}</span>
    </div>
  )
}

/* ── Dashboard Widget card ──────────────────────────────── */
function WidgetCard({ widget, onRemove, onMoveUp, onMoveDown, editMode }: {
  widget: any; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void; editMode: boolean
}) {
  const meta = WIDGET_META[widget.widget_type] || { icon: LayoutGrid, color: C.muted, defaultH: 160 }
  const Icon = meta.icon

  return (
    <div className="card" style={{
      padding: 0, overflow: 'hidden', position: 'relative',
      outline: editMode ? `1px dashed rgba(0,212,170,0.4)` : 'none',
      transition: 'outline 0.2s',
    }}>
      {/* Card header */}
      <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        {editMode && <GripVertical style={{ width: 14, height: 14, color: C.muted, cursor: 'grab', flexShrink: 0 }} />}
        <div style={{ width: 22, height: 22, borderRadius: 6, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ width: 11, height: 11, color: meta.color }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{widget.title || widget.widget_type.replace(/_/g, ' ')}</span>
        {editMode && (
          <div className="flex items-center gap-1">
            <button onClick={onMoveUp} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2 }}>
              <ChevronUp style={{ width: 12, height: 12 }} />
            </button>
            <button onClick={onMoveDown} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 2 }}>
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>
            <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 2 }}>
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>
        )}
      </div>

      {/* Card content */}
      <div style={{ padding: '10px 14px 14px' }}>
        <WidgetContent type={widget.widget_type} />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════ */
export default function DashboardBuilderPage() {
  const qc = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [showCatalogue, setShowCatalogue] = useState(false)

  const { data: widgetLayout = [], isLoading } = useQuery({
    queryKey: ['dashboard-widgets'],
    queryFn: widgetsApi.list,
  })
  const { data: available } = useQuery({
    queryKey: ['dashboard-available'],
    queryFn: widgetsApi.available,
    enabled: showCatalogue,
  })

  // local state for optimistic reordering
  const [localWidgets, setLocalWidgets] = useState<any[] | null>(null)
  const widgets: any[] = localWidgets ?? (widgetLayout as any[])

  const addMut = useMutation({
    mutationFn: (d: any) => widgetsApi.add(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-widgets'] })
      setLocalWidgets(null)
      toast.success('Widget added')
    },
    onError: () => toast.error('Failed to add widget'),
  })
  const removeMut = useMutation({
    mutationFn: (id: string) => widgetsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard-widgets'] }); setLocalWidgets(null) },
    onError: () => toast.error('Failed to remove widget'),
  })
  const saveMut = useMutation({
    mutationFn: (updates: any[]) => widgetsApi.bulkLayout(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-widgets'] })
      setEditMode(false)
      toast.success('Layout saved')
    },
    onError: () => toast.error('Failed to save layout'),
  })

  const handleRemove = useCallback((id: string) => {
    setLocalWidgets(prev => (prev ?? (widgetLayout as any[])).filter((w: any) => w.id !== id))
    removeMut.mutate(id)
  }, [widgetLayout])

  const handleMove = useCallback((idx: number, dir: 'up' | 'down') => {
    const list = [...(localWidgets ?? (widgetLayout as any[]))]
    const newIdx = dir === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= list.length) return
    const tmp = list[idx]; list[idx] = list[newIdx]; list[newIdx] = tmp
    setLocalWidgets(list)
  }, [localWidgets, widgetLayout])

  const handleSave = () => {
    const updates = widgets.map((w: any, i: number) => ({ id: w.id, position_y: i, position_x: 0 }))
    saveMut.mutate(updates)
  }

  const handleAddWidget = (type: string, label: string) => {
    addMut.mutate({ widget_type: type, title: label, config: {}, position_x: 0, position_y: widgets.length, width: 2, height: 2 })
    setShowCatalogue(false)
  }

  const COLUMNS = 3

  // Split into rows of COLUMNS
  const rows: any[][] = []
  for (let i = 0; i < widgets.length; i += COLUMNS) {
    rows.push(widgets.slice(i, i + COLUMNS))
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(59,130,246,0.2))', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LayoutGrid style={{ width: 22, height: 22, color: C.purple }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Custom Dashboard</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Drag-and-drop widget system — pick which charts appear on your Overview</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {editMode && (
            <>
              <button onClick={handleSave}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                <Save style={{ width: 13, height: 13 }} /> Save Layout
              </button>
              <button onClick={() => { setShowCatalogue(v => !v) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: C.purple, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                <Plus style={{ width: 13, height: 13 }} /> Add Widget
              </button>
            </>
          )}
          <button onClick={() => { setEditMode(v => !v); setShowCatalogue(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: editMode ? 'rgba(255,77,109,0.08)' : 'rgba(148,163,184,0.08)', border: `1px solid ${editMode ? 'rgba(255,77,109,0.3)' : 'rgba(148,163,184,0.2)'}`, color: editMode ? C.red : C.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {editMode ? <><X style={{ width: 13, height: 13 }} /> Cancel</> : <><Settings2 style={{ width: 13, height: 13 }} /> Customise</>}
          </button>
        </div>
      </div>

      {/* Widget catalogue */}
      {showCatalogue && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Widget Catalogue</h4>
            <button onClick={() => setShowCatalogue(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {((available as any)?.widgets || Object.keys(WIDGET_META).map(k => ({ type: k, label: k.replace(/_/g, ' ') }))).map((w: any) => {
              const meta = WIDGET_META[w.type] || { icon: LayoutGrid, color: C.muted }
              const Icon = meta.icon
              const alreadyAdded = widgets.some((ww: any) => ww.widget_type === w.type)
              return (
                <button key={w.type} onClick={() => !alreadyAdded && handleAddWidget(w.type, w.label)}
                  disabled={alreadyAdded}
                  style={{
                    padding: '14px', borderRadius: 10, cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                    background: alreadyAdded ? 'rgba(148,163,184,0.04)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${alreadyAdded ? 'rgba(148,163,184,0.1)' : `${meta.color}30`}`,
                    opacity: alreadyAdded ? 0.5 : 1, textAlign: 'center', transition: 'all 0.15s',
                  }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                    <Icon style={{ width: 15, height: 15, color: meta.color }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: alreadyAdded ? C.muted : 'var(--text)', textTransform: 'capitalize' }}>{w.label || w.type.replace(/_/g, ' ')}</div>
                  {alreadyAdded && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Added</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Edit mode banner */}
      {editMode && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', fontSize: 12, color: C.accent, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings2 style={{ width: 14, height: 14 }} />
          Edit mode active — use ↑↓ arrows to reorder widgets, ✕ to remove. Click <b>Save Layout</b> when done.
        </div>
      )}

      {/* Widget grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Loading your dashboard…</div>
      ) : widgets.length === 0 ? (
        <div className="card p-16" style={{ textAlign: 'center' }}>
          <LayoutGrid style={{ width: 48, height: 48, color: C.muted, margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Your dashboard is empty</p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Click Customise, then Add Widget to build your personalised dashboard.</p>
          <button onClick={() => { setEditMode(true); setShowCatalogue(true) }}
            style={{ padding: '10px 24px', borderRadius: 8, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: C.accent, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            + Build my dashboard
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`, gap: 16 }}>
          {widgets.map((widget: any, idx: number) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              editMode={editMode}
              onRemove={() => handleRemove(widget.id)}
              onMoveUp={() => handleMove(idx, 'up')}
              onMoveDown={() => handleMove(idx, 'down')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
