import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Zap, TrendingDown, TrendingUp, RefreshCw, Battery, Sun, BarChart2, DollarSign, AlertTriangle, Clock } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const TS = {
  contentStyle: { background: '#0c1525', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, fontSize: 11, color: '#f0f6ff' },
  labelStyle: { color: '#64748b' },
}
const AX = { tick: { fontSize: 10, fill: '#94a3b8' }, axisLine: false, tickLine: false }

function genDailyData(days: number) {
  const arr = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    arr.push({
      date: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      lighting_kwh: Math.round(170 + (Math.random() - 0.5) * 40),
      hvac_kwh: Math.round(75 + (Math.random() - 0.5) * 20),
      irrigation_kwh: Math.round(28 + (Math.random() - 0.5) * 8),
      co2_kwh: Math.round(18 + (Math.random() - 0.5) * 6),
      other_kwh: Math.round(12 + (Math.random() - 0.5) * 4),
      cost_inr: 0,
    })
  }
  return arr.map(d => ({
    ...d,
    total_kwh: d.lighting_kwh + d.hvac_kwh + d.irrigation_kwh + d.co2_kwh + d.other_kwh,
    cost_inr: Math.round((d.lighting_kwh + d.hvac_kwh + d.irrigation_kwh + d.co2_kwh + d.other_kwh) * 8.5),
  }))
}

function genZoneEnergy() {
  const zones = [
    { code: 'A1', name: 'Zone A1 — Leafy Greens', area: 48 },
    { code: 'A2', name: 'Zone A2 — Herbs', area: 36 },
    { code: 'B1', name: 'Zone B1 — Microgreens', area: 40 },
    { code: 'B2', name: 'Zone B2 — Tomatoes', area: 32 },
  ]
  return zones.map(z => ({
    ...z,
    kwh_day: Math.round(60 + Math.random() * 80),
    kwh_per_m2: Math.round((3 + Math.random() * 3) * 10) / 10,
    lighting_w: Math.round(800 + Math.random() * 600),
    hvac_w: Math.round(300 + Math.random() * 300),
    status: Math.random() > 0.15 ? 'normal' : 'high',
  }))
}

const TARIFF_TIMES = [
  { label: 'Peak (09:00–23:00)', rate: 9.5, color: '#ef4444' },
  { label: 'Off-Peak (23:00–09:00)', rate: 5.2, color: '#10b981' },
]

export default function EnergyPage() {
  const [period, setPeriod] = useState(7)
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: apiData } = useQuery({
    queryKey: ['energy', period, refreshKey],
    queryFn: () => api.get(`/api/v1/energy/overview?days=${period}`).then(r => r.data).catch(() => null),
  })

  const daily = genDailyData(period)
  const zoneEnergy = genZoneEnergy()

  const totalKwh = daily.reduce((s, d) => s + d.total_kwh, 0)
  const totalCost = daily.reduce((s, d) => s + d.cost_inr, 0)
  const avgKwhDay = Math.round(totalKwh / period)
  const highZones = zoneEnergy.filter(z => z.status === 'high')

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Zap size={20} color="#f59e0b" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Energy Management</h1>
            </div>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Monitor power consumption, costs, and efficiency across all zones</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#060d19', borderRadius: 8, padding: 3 }}>
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setPeriod(d)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: period === d ? '#0c1525' : 'transparent', color: period === d ? '#f0f6ff' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: period === d ? 600 : 400 }}>
                  {d}d
                </button>
              ))}
            </div>
            <button onClick={() => setRefreshKey(k => k + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: `Total (${period}d)`, value: `${totalKwh.toLocaleString()} kWh`, color: '#f59e0b', icon: Zap },
          { label: 'Avg per Day', value: `${avgKwhDay} kWh`, color: '#3b82f6', icon: BarChart2 },
          { label: `Cost (${period}d)`, value: `₹${(totalCost / 100).toFixed(0)}`, color: '#10b981', icon: DollarSign },
          { label: 'Today Peak', value: `${daily[daily.length - 1].total_kwh} kWh`, color: '#8b5cf6', icon: TrendingUp },
          { label: 'High-Use Zones', value: highZones.length, color: highZones.length > 0 ? '#ef4444' : '#10b981', icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, marginBottom: 6 }}><Icon size={12} />{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Daily consumption chart */}
        <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 16 }}>Daily Consumption (kWh)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
              <XAxis dataKey="date" {...AX} />
              <YAxis {...AX} />
              <Tooltip {...TS} />
              <Bar dataKey="lighting_kwh" name="Lighting" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
              <Bar dataKey="hvac_kwh" name="HVAC" stackId="a" fill="#3b82f6" />
              <Bar dataKey="irrigation_kwh" name="Irrigation" stackId="a" fill="#06b6d4" />
              <Bar dataKey="co2_kwh" name="CO₂" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="other_kwh" name="Other" stackId="a" fill="#475569" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            {[['Lighting', '#fbbf24'], ['HVAC', '#3b82f6'], ['Irrigation', '#06b6d4'], ['CO₂', '#8b5cf6'], ['Other', '#475569']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Tariff info + breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} color="#f59e0b" /> Tariff Schedule
            </div>
            {TARIFF_TIMES.map(t => (
              <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.label}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.color }}>₹{t.rate}/kWh</div>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: 11, color: '#f59e0b' }}>💡 Schedule heavy loads (irrigation, HVAC) during off-peak hours to save ~45%</div>
            </div>
          </div>

          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 14, padding: '16px 18px', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff', marginBottom: 12 }}>Today's Breakdown</div>
            {[
              { label: 'Lighting', kwh: daily[daily.length - 1].lighting_kwh, pct: 58, color: '#fbbf24' },
              { label: 'HVAC', kwh: daily[daily.length - 1].hvac_kwh, pct: 24, color: '#3b82f6' },
              { label: 'Irrigation', kwh: daily[daily.length - 1].irrigation_kwh, pct: 9, color: '#06b6d4' },
              { label: 'CO₂', kwh: daily[daily.length - 1].co2_kwh, pct: 6, color: '#8b5cf6' },
              { label: 'Other', kwh: daily[daily.length - 1].other_kwh, pct: 3, color: '#475569' },
            ].map(({ label, kwh, pct, color }) => (
              <div key={label} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>{kwh} kWh <span style={{ color: '#475569', fontWeight: 400 }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zone-level energy table */}
      <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(148,163,184,0.08)', fontSize: 14, fontWeight: 600, color: '#f0f6ff' }}>
          Zone Energy Breakdown
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
              {['Zone', 'kWh/day', 'kWh/m²', 'Lighting (W)', 'HVAC (W)', 'Efficiency'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zoneEnergy.map((z, i) => (
              <tr key={z.code} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff' }}>{z.name}</div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: z.status === 'high' ? '#ef4444' : '#f0f6ff' }}>{z.kwh_day}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{z.kwh_per_m2}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#fbbf24' }}>{z.lighting_w} W</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#3b82f6' }}>{z.hvac_w} W</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: z.status === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: z.status === 'high' ? '#ef4444' : '#10b981', textTransform: 'capitalize' }}>
                    {z.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
