import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zonesApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Sun, Zap, Activity, Clock, ChevronDown, ChevronUp, Settings, RefreshCw } from 'lucide-react'

const MOCK_ZONES = [
  { id:'z1', name:'Zone A1 — Leafy Greens', code:'A1', target_ppfd:200, status:'active' },
  { id:'z2', name:'Zone A2 — Herbs',        code:'A2', target_ppfd:250, status:'active' },
  { id:'z3', name:'Zone B1 — Microgreens',  code:'B1', target_ppfd:150, status:'active' },
  { id:'z4', name:'Zone B2 — Tomatoes',     code:'B2', target_ppfd:350, status:'active' },
]
const LIGHT_SPECTRUMS = [
  { value:'full_spectrum', label:'Full Spectrum (Veg + Bloom)' },
  { value:'veg',           label:'Vegetative (Blue-dominant)' },
  { value:'bloom',         label:'Bloom (Red-dominant)' },
  { value:'seedling',      label:'Seedling (Low intensity)' },
  { value:'custom',        label:'Custom RGB mix' },
]
function genLightReading(targetPpfd: number) {
  return {
    ppfd:            Math.round(targetPpfd + (Math.random() - 0.5) * 30),
    dli:             Math.round((targetPpfd * 16 * 3600 / 1_000_000) * 10) / 10,
    power_w:         Math.round(targetPpfd * 0.6),
    efficacy_umol_j: Math.round((targetPpfd / (targetPpfd * 0.6)) * 10) / 10,
    photoperiod_h:   16,
    lights_on:       '06:00',
    lights_off:      '22:00',
    dimmer_pct:      Math.round(80 + Math.random() * 20),
    spectrum:        'full_spectrum',
    temp_c:          Math.round((35 + Math.random() * 10) * 10) / 10,
  }
}

function LightZoneCard({ zone }: { zone: any }) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [settings, setSettings] = useState({ ppfd: zone.target_ppfd, photoperiod: 16, lights_on: '06:00', spectrum: 'full_spectrum', dimmer: 100 })
  const qc = useQueryClient()
  const r = genLightReading(zone.target_ppfd)

  const handleSave = async () => {
    setSaving(true)
    try {
      await zonesApi.update(zone.id, { target_ppfd: settings.ppfd })
      toast.success(`Lighting updated for Zone ${zone.code}`)
      qc.invalidateQueries({ queryKey: ['zones'] })
      setEditing(false)
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="card mb-3 overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.25)' }}>
          <Sun className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--text)]">{zone.name}</div>
          <div className="text-xs text-muted">Photoperiod: {r.photoperiod_h}h · ON {r.lights_on}–{r.lights_off} · {r.spectrum.replace(/_/g,' ')}</div>
        </div>
        <div className="flex gap-5 mr-2">
          {[
            { val: r.ppfd,        unit:'μmol/m²/s', color:'text-amber-400' },
            { val: r.dli,         unit:'DLI mol/d',  color:'text-[var(--accent)]' },
            { val:`${r.dimmer_pct}%`, unit:'Dimmer', color:'text-muted' },
          ].map(({ val, unit, color }) => (
            <div key={unit} className="text-center">
              <div className={`text-base font-bold ${color}`}>{val}</div>
              <div className="text-[10px] text-muted">{unit}</div>
            </div>
          ))}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] p-4">
          <div className="grid grid-cols-5 gap-2 mb-4">
            {[
              { label:'PPFD',         value:`${r.ppfd} μmol/m²/s`, color:'text-amber-400' },
              { label:'DLI',          value:`${r.dli} mol/day`,     color:'text-[var(--accent)]' },
              { label:'Power Draw',   value:`${r.power_w} W`,       color:'text-blue-500' },
              { label:'Efficacy',     value:`${r.efficacy_umol_j} μmol/J`, color:'text-purple-500' },
              { label:'Fixture Temp', value:`${r.temp_c}°C`,        color: r.temp_c > 45 ? 'text-red-500' : 'text-muted' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-2.5 text-center" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
                <div className="text-[10px] text-muted mb-1">{label}</div>
                <div className={`text-xs font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted">Dimmer Level</span>
              <span className="font-semibold text-amber-400">{r.dimmer_pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background:'var(--surface)' }}>
              <div className="h-full rounded-full" style={{ width:`${r.dimmer_pct}%`, background:'linear-gradient(90deg,#92400e,#fbbf24)' }} />
            </div>
          </div>

          {editing ? (
            <div className="rounded-xl p-4" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  { label:'PPFD Target (μmol/m²/s)', key:'ppfd',       type:'number', min:50,  max:800, step:10 },
                  { label:'Photoperiod (hours)',      key:'photoperiod', type:'number', min:8,   max:24,  step:0.5 },
                  { label:'Lights ON',                key:'lights_on',  type:'time' },
                  { label:'Dimmer (%)',               key:'dimmer',     type:'number', min:10,  max:100, step:5 },
                ].map(({ label, key, type, min, max, step }) => (
                  <div key={key}>
                    <label className="text-[11px] text-muted block mb-1">{label}</label>
                    <input type={type} min={min} max={max} step={step} value={(settings as any)[key]}
                      onChange={e => setSettings(s => ({ ...s, [key]: type==='number' ? parseFloat(e.target.value) : e.target.value }))}
                      className="input text-xs py-1.5 w-full" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-[11px] text-muted block mb-1">Spectrum</label>
                  <select value={settings.spectrum} onChange={e => setSettings(s => ({ ...s, spectrum:e.target.value }))} className="input text-xs py-1.5 w-full">
                    {LIGHT_SPECTRUMS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="btn-ghost btn-sm text-xs">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm text-xs">
                  {saving ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary btn-sm flex items-center gap-1.5 text-xs">
              <Settings className="w-3.5 h-3.5" /> Configure Lighting
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function LightingPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: zones = MOCK_ZONES } = useQuery({
    queryKey: ['zones-lighting', refreshKey],
    queryFn: () => zonesApi.list().catch(() => MOCK_ZONES),
    refetchInterval: 60000,
  })
  const displayZones = (zones as any[]).length ? zones as any[] : MOCK_ZONES
  const totalPower = displayZones.reduce((s, z) => s + Math.round(z.target_ppfd * 0.6), 0)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sun className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold text-[var(--text)]">Lighting Control</h1>
          </div>
          <p className="text-xs text-muted">Manage PPFD targets, photoperiods, dimmer levels, and spectrums</p>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)} className="btn-secondary btn-sm flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Avg PPFD',     value:`${Math.round(displayZones.reduce((s,z)=>s+z.target_ppfd,0)/displayZones.length)} μmol`, color:'text-amber-400', icon:Sun },
          { label:'Total Power',  value:`${totalPower} W`, color:'text-blue-500', icon:Zap },
          { label:'Active Zones', value:displayZones.length, color:'text-[var(--accent)]', icon:Activity },
          { label:'Photoperiod',  value:'16h / day', color:'text-purple-500', icon:Clock },
        ].map(({ label, value, color, icon:Icon }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-1.5 text-muted text-xs mb-2"><Icon className="w-3.5 h-3.5" />{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div>{displayZones.map(zone => <LightZoneCard key={zone.id} zone={zone} />)}</div>
    </div>
  )
}
