import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { zonesApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Wind, Plus, Play, Pause, Settings, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Zap, Activity } from 'lucide-react'

const MOCK_ZONES = [
  { id:'z1', name:'Zone A1 — Leafy Greens', code:'A1', target_co2:1000, status:'active' },
  { id:'z2', name:'Zone A2 — Herbs',        code:'A2', target_co2:1200, status:'active' },
  { id:'z3', name:'Zone B1 — Microgreens',  code:'B1', target_co2:800,  status:'active' },
  { id:'z4', name:'Zone B2 — Tomatoes',     code:'B2', target_co2:1300, status:'active' },
]

const CYCLE_MODES = [
  { value: 'continuous', label: 'Continuous — maintain ppm target' },
  { value: 'photoperiod', label: 'Photoperiod — inject during light hours only' },
  { value: 'scheduled', label: 'Scheduled — custom time windows' },
  { value: 'demand', label: 'Demand-based — inject when below threshold' },
]

function genCO2Reading(target: number) {
  return {
    co2_ppm: Math.round(target + (Math.random() - 0.5) * 150),
    injection_active: Math.random() > 0.4,
    tank_pct: Math.round(60 + Math.random() * 35),
    flow_rate_lpm: Math.round((0.8 + Math.random() * 1.2) * 10) / 10,
    daily_usage_kg: Math.round((0.5 + Math.random() * 1.5) * 10) / 10,
    cycle_mode: 'photoperiod',
    vent_status: Math.random() > 0.7 ? 'open' : 'closed',
  }
}

function CO2ZoneCard({ zone }: { zone: any }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [target, setTarget] = useState(zone.target_co2)
  const [mode, setMode] = useState('photoperiod')
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()
  const reading = genCO2Reading(zone.target_co2)
  const diff = reading.co2_ppm - zone.target_co2
  const statusColor = Math.abs(diff) < 80 ? '#10b981' : Math.abs(diff) < 150 ? '#f59e0b' : '#ef4444'

  const handleSave = async () => {
    setSaving(true)
    try {
      await zonesApi.update(zone.id, { target_co2: target })
      toast.success(`CO₂ target updated for ${zone.code}`)
      qc.invalidateQueries({ queryKey: ['zones'] })
      setEditing(false)
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${Math.abs(diff) > 150 ? 'rgba(239,68,68,0.3)' : 'rgba(148,163,184,0.12)'}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${statusColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Wind size={16} color={statusColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{zone.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mode: {reading.cycle_mode} · Tank: {reading.tank_pct}%</div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginRight: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: statusColor }}>{reading.co2_ppm}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>ppm</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: reading.injection_active ? '#10b981' : '#64748b' }}>
              {reading.injection_active ? 'INJECT' : 'IDLE'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Status</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: 'Current CO₂', value: `${reading.co2_ppm} ppm`, color: statusColor },
              { label: 'Target', value: `${zone.target_co2} ppm`, color: 'var(--text2)' },
              { label: 'Flow Rate', value: `${reading.flow_rate_lpm} L/min`, color: '#3b82f6' },
              { label: 'Daily Usage', value: `${reading.daily_usage_kg} kg`, color: '#f59e0b' },
              { label: 'Tank Level', value: `${reading.tank_pct}%`, color: reading.tank_pct < 20 ? '#ef4444' : '#10b981' },
              { label: 'Vent', value: reading.vent_status, color: reading.vent_status === 'open' ? '#10b981' : '#64748b' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color, textTransform: 'capitalize' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Injection indicator */}
          {reading.injection_active && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 12, color: '#10b981' }}>CO₂ injection active — {reading.flow_rate_lpm} L/min at {reading.co2_ppm} ppm</span>
            </div>
          )}

          {/* Tank warning */}
          {reading.tank_pct < 25 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 14 }}>
              <AlertTriangle size={12} color="#ef4444" />
              <span style={{ fontSize: 12, color: '#ef4444' }}>CO₂ tank low ({reading.tank_pct}%) — schedule refill</span>
            </div>
          )}

          {editing ? (
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>CO₂ Target (ppm)</label>
                  <input type="number" min={400} max={2000} step={50} value={target} onChange={e => setTarget(parseInt(e.target.value))}
                    style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Injection Mode</label>
                  <select value={mode} onChange={e => setMode(e.target.value)} style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 13 }}>
                    {CYCLE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(0,212,170,0.3)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <Settings size={12} /> Configure CO₂
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function CO2Page() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: zones = MOCK_ZONES } = useQuery({
    queryKey: ['zones-co2', refreshKey],
    queryFn: () => zonesApi.list().catch(() => MOCK_ZONES),
    refetchInterval: 30000,
  })
  const displayZones = (zones as any[]).length ? zones : MOCK_ZONES
  const avgCO2 = Math.round(displayZones.reduce((s: number, z: any) => s + genCO2Reading(z.target_co2).co2_ppm, 0) / displayZones.length)
  const injecting = Math.round(displayZones.length * 0.6)

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Wind size={20} color="#00d4aa" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>CO₂ & Air Management</h1>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>Monitor CO₂ enrichment, air circulation, and ventilation across all zones</p>
          </div>
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Avg CO₂', value: `${avgCO2} ppm`, color: 'var(--accent)', icon: Wind },
          { label: 'Injecting', value: `${injecting} zones`, color: '#10b981', icon: Activity },
          { label: 'Zones', value: displayZones.length, color: 'var(--text)', icon: CheckCircle2 },
          { label: 'Optimal Range', value: '800–1500 ppm', color: 'var(--text3)', icon: Zap },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 12, marginBottom: 6 }}><Icon size={12} />{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {(displayZones as any[]).map(zone => <CO2ZoneCard key={zone.id} zone={zone} />)}
    </div>
  )
}
