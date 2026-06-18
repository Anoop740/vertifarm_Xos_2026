import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { zonesApi, farmsApi, sensorsApi } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Thermometer, Wind, Droplets, RefreshCw, Settings,
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Play, Pause, ChevronDown, ChevronUp, Zap
} from 'lucide-react'

// ─── Mock realtime readings ───────────────────────────────────────
const genReading = (base: number, spread: number) =>
  Math.round((base + (Math.random() - 0.5) * spread * 2) * 10) / 10

function mockZoneClimate(zoneCode: string) {
  return {
    temp_c: genReading(22.4, 1.5),
    humidity_pct: genReading(64, 8),
    co2_ppm: genReading(1100, 120),
    vpd: genReading(0.9, 0.2),
    temp_trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
    humidity_trend: Math.random() > 0.5 ? 'up' : 'stable',
    hvac_status: Math.random() > 0.2 ? 'active' : 'idle',
    dehumidifier: Math.random() > 0.5,
    circulation_fans: true,
    last_updated: new Date().toISOString(),
  }
}

const MOCK_ZONES = [
  { id:'z1', name:'Zone A1 — Leafy Greens', code:'A1', farm_id:'f1', status:'active', target_temp:22, target_humidity:65, target_co2:1000, target_ph:6.0, target_ec:1.8, target_ppfd:200, rack_count:8, level_count:6, area_sqm:48 },
  { id:'z2', name:'Zone A2 — Herbs', code:'A2', farm_id:'f1', status:'active', target_temp:24, target_humidity:60, target_co2:1200, target_ph:5.8, target_ec:2.0, target_ppfd:250, rack_count:6, level_count:5, area_sqm:36 },
  { id:'z3', name:'Zone B1 — Microgreens', code:'B1', farm_id:'f1', status:'active', target_temp:21, target_humidity:70, target_co2:800, target_ph:6.1, target_ec:1.4, target_ppfd:150, rack_count:10, level_count:4, area_sqm:40 },
  { id:'z4', name:'Zone B2 — Tomatoes', code:'B2', farm_id:'f1', status:'active', target_temp:25, target_humidity:58, target_co2:1300, target_ph:6.2, target_ec:2.4, target_ppfd:350, rack_count:4, level_count:3, area_sqm:32 },
]

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={12} color="#f59e0b" />
  if (trend === 'down') return <TrendingDown size={12} color="#3b82f6" />
  return <Minus size={12} color="#64748b" />
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#10b981' : '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
}

function SensorValue({ label, value, unit, target, tolerance = 2, trend }: any) {
  const diff = Math.abs(value - target)
  const ok = diff <= tolerance
  const warn = diff > tolerance && diff <= tolerance * 2
  const color = ok ? '#10b981' : warn ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{unit}</span>
        {trend && <TrendIcon trend={trend} />}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Target: {target}{unit}</div>
    </div>
  )
}

function ZoneClimateCard({ zone }: { zone: any }) {
  const [expanded, setExpanded] = useState(false)
  const [targets, setTargets] = useState({ temp: zone.target_temp, humidity: zone.target_humidity, co2: zone.target_co2 })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  const reading = mockZoneClimate(zone.code)
  const alerts = [
    reading.temp_c > zone.target_temp + 2 && `Temp ${reading.temp_c}°C — above target`,
    reading.humidity_pct > 80 && `Humidity ${reading.humidity_pct}% — high`,
  ].filter(Boolean)

  const handleSave = async () => {
    setSaving(true)
    try {
      await zonesApi.update(zone.id, { target_temp: targets.temp, target_humidity: targets.humidity, target_co2: targets.co2 })
      toast.success(`Zone ${zone.code} targets updated`)
      qc.invalidateQueries({ queryKey: ['zones'] })
      setEditing(false)
    } catch {
      toast.error('Failed to update targets')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${alerts.length ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.12)'}`, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <StatusDot ok={alerts.length === 0} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{zone.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>HVAC: <span style={{ color: reading.hvac_status === 'active' ? '#10b981' : '#64748b' }}>{reading.hvac_status}</span>
            {reading.dehumidifier && <span style={{ marginLeft: 8, color: '#3b82f6' }}>· Dehumidifier ON</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginRight: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: Math.abs(reading.temp_c - zone.target_temp) > 2 ? '#f59e0b' : '#10b981' }}>{reading.temp_c}°C</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Temp</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: reading.humidity_pct > 80 ? '#f59e0b' : '#10b981' }}>{reading.humidity_pct}%</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>RH</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text2)' }}>{reading.co2_ppm}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>ppm CO₂</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', borderTop: '1px solid rgba(245,158,11,0.15)', padding: '8px 18px', display: 'flex', gap: 12 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#f59e0b' }}>
              <AlertTriangle size={12} /> {a}
            </div>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <SensorValue label="Temperature" value={reading.temp_c} unit="°C" target={zone.target_temp} tolerance={1.5} trend={reading.temp_trend} />
            <SensorValue label="Humidity" value={reading.humidity_pct} unit="%" target={zone.target_humidity} tolerance={5} trend={reading.humidity_trend} />
            <SensorValue label="CO₂" value={reading.co2_ppm} unit=" ppm" target={zone.target_co2} tolerance={100} />
            <SensorValue label="VPD" value={reading.vpd} unit=" kPa" target={0.9} tolerance={0.2} />
          </div>

          {/* Equipment status */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'HVAC', status: reading.hvac_status === 'active', icon: Thermometer },
              { label: 'Dehumidifier', status: reading.dehumidifier, icon: Droplets },
              { label: 'Circulation Fans', status: reading.circulation_fans, icon: Wind },
            ].map(({ label, status, icon: Icon }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: status ? 'rgba(16,185,129,0.1)' : 'var(--surface)', border: `1px solid ${status ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.1)'}` }}>
                <Icon size={12} color={status ? '#10b981' : '#64748b'} />
                <span style={{ fontSize: 12, color: status ? '#10b981' : '#64748b' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Target editing */}
          {editing ? (
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>Update Setpoints</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  { label: 'Temp (°C)', key: 'temp', min: 15, max: 35, step: 0.5 },
                  { label: 'Humidity (%)', key: 'humidity', min: 40, max: 90, step: 1 },
                  { label: 'CO₂ (ppm)', key: 'co2', min: 400, max: 2000, step: 50 },
                ].map(({ label, key, min, max, step }) => (
                  <div key={key} style={{ flex: 1, minWidth: 120 }}>
                    <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type="number" min={min} max={max} step={step} value={(targets as any)[key]}
                      onChange={e => setTargets(t => ({ ...t, [key]: parseFloat(e.target.value) }))}
                      style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditing(false)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save Setpoints'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(0,212,170,0.3)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <Settings size={12} /> Adjust Setpoints
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClimatePage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: zones = MOCK_ZONES, isLoading } = useQuery({
    queryKey: ['zones', refreshKey],
    queryFn: () => zonesApi.list().catch(() => MOCK_ZONES),
    refetchInterval: 30000,
  })

  const displayZones = (zones as any[]).length ? zones : MOCK_ZONES

  const avgTemp = Math.round((displayZones as any[]).reduce((s, z) => s + mockZoneClimate(z.code).temp_c, 0) / displayZones.length * 10) / 10
  const avgHum = Math.round((displayZones as any[]).reduce((s, z) => s + mockZoneClimate(z.code).humidity_pct, 0) / displayZones.length)

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Thermometer size={20} color="#00d4aa" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Climate Control</h1>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>Monitor & control temperature, humidity, and VPD across all zones</p>
          </div>
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Avg Temperature', value: `${avgTemp}°C`, color: '#f59e0b', icon: Thermometer },
          { label: 'Avg Humidity', value: `${avgHum}%`, color: '#3b82f6', icon: Droplets },
          { label: 'Active Zones', value: displayZones.length, color: '#10b981', icon: CheckCircle2 },
          { label: 'HVAC Units', value: `${Math.ceil(displayZones.length * 0.75)} active`, color: '#8b5cf6', icon: Wind },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 12, marginBottom: 6 }}><Icon size={12} />{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--text3)', padding: 20 }}>Loading zones…</div>
      ) : (
        <div>
          {(displayZones as any[]).map(zone => (
            <ZoneClimateCard key={zone.id} zone={zone} />
          ))}
        </div>
      )}
    </div>
  )
}
