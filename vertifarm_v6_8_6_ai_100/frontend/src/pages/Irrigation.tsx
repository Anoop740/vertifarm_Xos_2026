import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { farmsApi, zonesApi } from '@/lib/api'
import { Button, Badge, StatCard, Modal, Input, Select } from '@/components/ui'
import {
  Droplets, Plus, Clock, Zap, Activity, Settings,
  Play, Pause, StopCircle, RefreshCw, Info,
  CheckCircle2, AlertTriangle, BarChart3, Waves
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface IrrigationSchedule {
  id: string; zone_id: string; zone_code: string; zone_name: string;
  farm_id: string; farm_name: string; farm_type: string;
  mode: 'timer' | 'sensor' | 'mist_cycle' | 'continuous' | 'ebb_flow';
  status: 'active' | 'paused' | 'completed' | 'scheduled';
  frequency_label: string; duration_min: number;
  flow_rate_lpm: number; ec_target: number; ph_target: number;
  next_run: string; last_run: string;
  water_used_today_L: number; daily_budget_L: number;
  notes: string;
}

// ─── Farm-type irrigation defaults ───────────────────────────────────────────
const IRRIGATION_CONFIGS: Record<string, {
  mode: string; mode_label: string; description: string;
  duration_min: number; frequency_label: string; flow_rate_lpm: number;
  ec_target: number; ph_target: number; daily_budget_L: number;
  icon: string; color: string; bg: string;
  tips: string[];
}> = {
  hydroponic: {
    mode: 'continuous', mode_label: 'Continuous Recirculation',
    description: 'Nutrient solution recirculates 24/7 through raft beds. Top-up for evaporation.',
    duration_min: 0, frequency_label: 'Continuous / 24h', flow_rate_lpm: 8.0,
    ec_target: 1.8, ph_target: 6.2, daily_budget_L: 450,
    icon: '💧', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',
    tips: ['Top up reservoir every 2 days','Monitor EC drift — add nutrients if EC drops >0.2 mS','Check DO levels — target >7 mg/L','Flush system with plain water between crops']
  },
  nft: {
    mode: 'timer', mode_label: 'NFT Timed Pump Cycle',
    description: 'Pump runs nutrient film continuously during daytime, off at night to reduce algae.',
    duration_min: 720, frequency_label: '14h on / 10h off (day cycle)', flow_rate_lpm: 1.5,
    ec_target: 1.6, ph_target: 6.0, daily_budget_L: 180,
    icon: '🌊', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',
    tips: ['Flow rate 1–2 L/min/channel','Check drain EC — should be ≤0.5 above feed EC','Slope: 1:30 to 1:40 for uniform film','Inspect channels weekly for root blockage']
  },
  aeroponic: {
    mode: 'mist_cycle', mode_label: 'Aeroponic Mist Cycle',
    description: 'High-pressure mist bursts every few minutes. Precise timing critical for root O₂.',
    duration_min: 0.25, frequency_label: '15s ON / 4min OFF (continuous)', flow_rate_lpm: 3.2,
    ec_target: 2.0, ph_target: 5.8, daily_budget_L: 120,
    icon: '☁️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',
    tips: ['Mist cycle: 15s on / 4min off (adjust by crop stage)','Pressure: 80–100 PSI for 50-micron droplets','Clean nozzles every 2 weeks — blockages = root death','Increase mist frequency in germination phase']
  },
  dwc: {
    mode: 'continuous', mode_label: 'Continuous Aeration (DWC)',
    description: 'Roots submerged in oxygenated nutrient solution at all times. Air pump runs 24/7.',
    duration_min: 0, frequency_label: 'Continuous / Air pump 24h', flow_rate_lpm: 0,
    ec_target: 1.6, ph_target: 5.9, daily_budget_L: 320,
    icon: '🏊', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)',
    tips: ['Air stone output: 1 L/min per 10L solution','Water level: keep roots submerged 2–3 cm minimum','pH drift is rapid in DWC — check 2× daily','Top up with plain RO water between full reservoir changes']
  },
  tower: {
    mode: 'timer', mode_label: 'Drip / Flood Timer',
    description: 'Pump floods tower channels on a timer. Gravity drains back to reservoir.',
    duration_min: 15, frequency_label: 'Every 2 hours (12×/day)', flow_rate_lpm: 2.0,
    ec_target: 1.8, ph_target: 6.0, daily_budget_L: 200,
    icon: '🗼', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',
    tips: ['Flood duration: 15min every 2h standard','Increase frequency in hot/dry conditions','Clean grow channels with H₂O₂ between cycles','Root zone temp: keep below 22°C']
  },
  rack: {
    mode: 'timer', mode_label: 'Drip Irrigation Timer',
    description: 'Top-fed drip lines deliver nutrient solution per rack. Timed with reservoir return.',
    duration_min: 20, frequency_label: 'Every 3h (8×/day)', flow_rate_lpm: 1.8,
    ec_target: 2.0, ph_target: 6.2, daily_budget_L: 240,
    icon: '🗄️', color: '#10b981', bg: 'rgba(16,185,129,0.08)',
    tips: ['Drip emitters: 2 per plant site','Runoff target: 20–30% to prevent salt build-up','Flush with 0.5 EC water every 2 weeks','Check timer alignment with light cycle']
  },
  greenhouse: {
    mode: 'sensor', mode_label: 'Sensor-Triggered Irrigation',
    description: 'Soil/substrate moisture sensors trigger irrigation when VWC drops below threshold.',
    duration_min: 10, frequency_label: 'Sensor-triggered (VWC < 55%)', flow_rate_lpm: 4.5,
    ec_target: 2.2, ph_target: 6.3, daily_budget_L: 600,
    icon: '🏡', color: '#22c55e', bg: 'rgba(34,197,94,0.08)',
    tips: ['VWC trigger: 50–60% (substrate-dependent)','Place sensors at 50% root depth','Combine with weather data for predictive irrigation','Drain to waste — collect leachate for analysis']
  },
  container: {
    mode: 'timer', mode_label: 'Automated Timed Drip',
    description: 'Fully automated drip system with daily timer and reservoir top-up float valve.',
    duration_min: 12, frequency_label: 'Every 4h (6×/day)', flow_rate_lpm: 1.2,
    ec_target: 1.8, ph_target: 6.0, daily_budget_L: 80,
    icon: '📦', color: '#f97316', bg: 'rgba(249,115,22,0.08)',
    tips: ['Container sealing prevents evaporation loss','Monitor reservoir level 2× daily','Check condensation drainage line for blockage','CO₂ enrichment + irrigation scheduling in sync']
  }
}

const MODE_OPTIONS = [
  { value:'timer',      label:'Timer-Based Cycle' },
  { value:'sensor',     label:'Sensor-Triggered (VWC/Moisture)' },
  { value:'mist_cycle', label:'Mist Cycle (Aeroponic)' },
  { value:'continuous', label:'Continuous Recirculation' },
  { value:'ebb_flow',   label:'Ebb & Flow (Flood & Drain)' },
]

const STATUS_COLORS: Record<string,any> = { active:'green', paused:'amber', completed:'gray', scheduled:'blue' }

// ─── Generate demo schedules per farm type ────────────────────────────────────
function genSchedules(farms: any[], zones: any[]): IrrigationSchedule[] {
  const schedules: IrrigationSchedule[] = []
  let sid = 1
  for (const farm of farms) {
    const cfg = IRRIGATION_CONFIGS[farm.type] || IRRIGATION_CONFIGS.hydroponic
    const farmZones = zones.filter((z:any) => z.farm_id === farm.id)
    for (const zone of farmZones.slice(0, 6)) {
      const used = Math.floor(cfg.daily_budget_L * (0.4 + Math.random() * 0.5))
      schedules.push({
        id: `sch-${sid++}`,
        zone_id: zone.id, zone_code: zone.code, zone_name: zone.name,
        farm_id: farm.id, farm_name: farm.name, farm_type: farm.type,
        mode: cfg.mode as any,
        status: Math.random() > 0.85 ? 'paused' : Math.random() > 0.9 ? 'scheduled' : 'active',
        frequency_label: cfg.frequency_label,
        duration_min: cfg.duration_min,
        flow_rate_lpm: cfg.flow_rate_lpm,
        ec_target: zone.target_ec || cfg.ec_target,
        ph_target: zone.target_ph || cfg.ph_target,
        next_run: new Date(Date.now() + Math.floor(Math.random() * 7200000) + 900000).toISOString(),
        last_run: new Date(Date.now() - Math.floor(Math.random() * 3600000) - 300000).toISOString(),
        water_used_today_L: used,
        daily_budget_L: cfg.daily_budget_L,
        notes: cfg.description,
      })
    }
  }
  return schedules
}

// ─── Schedule Form Modal ──────────────────────────────────────────────────────
function ScheduleModal({ open, onClose, farms, zones, editSchedule }: {
  open: boolean; onClose: () => void; farms: any[]; zones: any[]; editSchedule?: IrrigationSchedule
}) {
  const [form, setForm] = useState({
    farm_id: editSchedule?.farm_id || '',
    zone_id: editSchedule?.zone_id || '',
    mode: editSchedule?.mode || 'timer',
    duration_min: String(editSchedule?.duration_min || 15),
    frequency_label: editSchedule?.frequency_label || 'Every 2 hours',
    flow_rate_lpm: String(editSchedule?.flow_rate_lpm || 2.0),
    ec_target: String(editSchedule?.ec_target || 1.8),
    ph_target: String(editSchedule?.ph_target || 6.0),
    daily_budget_L: String(editSchedule?.daily_budget_L || 200),
    notes: editSchedule?.notes || '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const selectedFarm = farms.find((f:any) => f.id === form.farm_id)
  const farmZones = zones.filter((z:any) => z.farm_id === form.farm_id)
  const cfg = selectedFarm ? (IRRIGATION_CONFIGS[selectedFarm.type] || IRRIGATION_CONFIGS.hydroponic) : null

  // Auto-fill defaults when farm selected
  const applyFarmDefaults = () => {
    if (!cfg) return
    setForm((f: any) => ({
      ...f,
      mode: cfg.mode,
      duration_min: String(cfg.duration_min),
      frequency_label: cfg.frequency_label,
      flow_rate_lpm: String(cfg.flow_rate_lpm),
      ec_target: String(cfg.ec_target),
      ph_target: String(cfg.ph_target),
      daily_budget_L: String(cfg.daily_budget_L),
      notes: cfg.description,
    }))
    toast.success(`Defaults applied for ${selectedFarm?.type} farm`)
  }

  const handleSubmit = () => {
    if (!form.farm_id || !form.zone_id) { toast.error('Select farm and zone'); return }
    toast.success(editSchedule ? 'Schedule updated' : 'Irrigation schedule created')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="xl"
      title={editSchedule ? `Edit Schedule — ${editSchedule.zone_code}` : 'New Irrigation Schedule'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleSubmit}>{editSchedule?'Save Changes':'Create Schedule'}</Button></>}>
      <div className="space-y-5">
        {/* Farm selector with auto-fill */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Farm *</label>
              {cfg && (
                <button type="button" onClick={applyFarmDefaults} className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5"/>Apply {selectedFarm?.type} defaults
                </button>
              )}
            </div>
            <Select options={[{value:'',label:'Select farm...'}, ...farms.map((f:any)=>({value:f.id,label:`${f.name} (${f.type})`}))]}
              value={form.farm_id} onChange={e=>{ set('farm_id',e.target.value); set('zone_id','') }}/>
          </div>
          <Select label="Zone *"
            options={[{value:'',label:form.farm_id?'Select zone..':'Select farm first'}, ...farmZones.map((z:any)=>({value:z.id,label:`${z.code} — ${z.name}`}))]}
            value={form.zone_id} onChange={e=>set('zone_id',e.target.value)}/>
        </div>

        {/* Farm type context */}
        {cfg && (
          <div className="flex items-start gap-3 p-3 rounded-xl text-xs" style={{background:cfg.bg, border:`1px solid ${cfg.color}30`}}>
            <span className="text-xl">{cfg.icon}</span>
            <div>
              <div className="font-bold" style={{color:cfg.color}}>{cfg.mode_label}</div>
              <div className="text-muted mt-0.5">{cfg.description}</div>
            </div>
          </div>
        )}

        {/* Mode & timing */}
        <div>
          <p className="text-xs font-semibold text-[var(--text)] mb-3 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[var(--accent)]"/> Irrigation Mode & Timing</p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Irrigation Mode" options={MODE_OPTIONS} value={form.mode} onChange={e=>set('mode',e.target.value)}/>
            <Input label="Schedule Description" placeholder="e.g. Every 2 hours (12×/day)" value={form.frequency_label} onChange={e=>set('frequency_label',e.target.value)}/>
            {form.mode !== 'continuous' && (
              <Input label={form.mode==='mist_cycle'?'Mist ON Duration (min)':'Irrigation Duration (min)'}
                type="number" step="0.25" placeholder="15" value={form.duration_min} onChange={e=>set('duration_min',e.target.value)}/>
            )}
            <Input label="Flow Rate (L/min)" type="number" step="0.1" value={form.flow_rate_lpm} onChange={e=>set('flow_rate_lpm',e.target.value)}/>
            <Input label="Daily Water Budget (L)" type="number" value={form.daily_budget_L} onChange={e=>set('daily_budget_L',e.target.value)}/>
          </div>
        </div>

        {/* Nutrient targets */}
        <div>
          <p className="text-xs font-semibold text-[var(--text)] mb-3 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-[var(--accent)]"/> Nutrient Solution Targets</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input label="EC Target (mS/cm)" type="number" step="0.1" value={form.ec_target} onChange={e=>set('ec_target',e.target.value)}/>
              <p className="text-[10px] text-muted mt-1">{form.mode==='mist_cycle'?'Aero: keep EC lower 1.5–2.5':form.mode==='continuous'?'DWC/hydro: 1.4–3.0 by crop stage':'1.4–3.5 depending on crop'}</p>
            </div>
            <div>
              <Input label="pH Target" type="number" step="0.1" value={form.ph_target} onChange={e=>set('ph_target',e.target.value)}/>
              <p className="text-[10px] text-muted mt-1">{form.mode==='mist_cycle'?'Aeroponic: 5.7–6.0 optimal':form.mode==='continuous'&&parseFloat(form.ec_target)<1.8?'DWC: 5.8–6.0':'NFT/Hydro: 6.0–6.5'}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes / Instructions</label>
          <textarea className="input" rows={2} placeholder="Special notes, flush schedule, nutrient brand..." value={form.notes} onChange={e=>set('notes',e.target.value)}/>
        </div>

        {/* Farm-type tips */}
        {cfg && (
          <div className="rounded-xl overflow-hidden border border-[var(--border)]">
            <div className="flex items-center gap-2 px-3 py-2" style={{background:'var(--bg3)'}}>
              <Info className="w-3.5 h-3.5 text-[var(--accent)]"/>
              <span className="text-xs font-semibold text-[var(--text)]">Best Practices — {selectedFarm?.type} irrigation</span>
            </div>
            <div className="px-3 pb-3 pt-2 space-y-1.5">
              {cfg.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <CheckCircle2 className="w-3 h-3 text-[var(--green)] mt-0.5 shrink-0"/>
                  <span className="text-muted">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Schedule Row Card ────────────────────────────────────────────────────────
function ScheduleCard({ schedule, onEdit, onToggle }: {
  schedule: IrrigationSchedule; onEdit: () => void; onToggle: () => void
}) {
  const cfg = IRRIGATION_CONFIGS[schedule.farm_type] || IRRIGATION_CONFIGS.hydroponic
  const pct = Math.min(100, Math.round(schedule.water_used_today_L / schedule.daily_budget_L * 100))
  const nextMins = Math.round((new Date(schedule.next_run).getTime() - Date.now()) / 60000)
  const nextLabel = nextMins < 1 ? 'Now' : nextMins < 60 ? `${nextMins}m` : `${Math.round(nextMins/60)}h ${nextMins%60}m`

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-4 hover:border-[var(--border2)] hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div style={{ width:38, height:38, borderRadius:10, background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
            {cfg.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text)]">{schedule.zone_code}</span>
              <span className="text-xs text-muted truncate max-w-[180px]">{schedule.zone_name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-muted">{schedule.farm_name}</span>
              <span className="text-muted">·</span>
              <Badge variant={STATUS_COLORS[schedule.status] as any}>{schedule.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onToggle} className={cn('btn-sm rounded-lg border font-semibold text-[10px] flex items-center gap-1 px-2 py-1.5',
            schedule.status==='active'?'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100':'border-[var(--border2)] text-muted hover:border-[var(--accent)]'
          )}>
            {schedule.status==='active'?<><Pause className="w-3 h-3"/>Pause</>:<><Play className="w-3 h-3"/>Resume</>}
          </button>
          <button onClick={onEdit} className="btn-ghost btn-sm p-1.5"><Settings className="w-3.5 h-3.5"/></button>
        </div>
      </div>

      {/* Mode badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`}}>
          {cfg.mode_label}
        </span>
        <span className="text-[10px] text-muted">{schedule.frequency_label}</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          ['EC', `${schedule.ec_target} mS`, '#3b82f6'],
          ['pH', String(schedule.ph_target), '#8b5cf6'],
          ['Flow', `${schedule.flow_rate_lpm} L/m`, '#06b6d4'],
          ['Next', nextLabel, schedule.status==='active'?'#059669':'#94a3b8'],
        ].map(([k,v,c])=>(
          <div key={k} className="text-center p-1.5 rounded-lg" style={{background:'var(--bg3)'}}>
            <div className="text-[9px] text-muted">{k}</div>
            <div className="text-xs font-bold" style={{color:c as string}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Water budget bar */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-muted">Water used today</span>
          <span className="font-semibold text-[var(--text)]">{schedule.water_used_today_L}L / {schedule.daily_budget_L}L</span>
        </div>
        <div className="progress-track">
          <div className={cn('progress-fill', pct>85?'':'progress-blue')} style={{width:`${pct}%`, background:pct>90?'#ef4444':pct>75?'#f59e0b':cfg.color}}/>
        </div>
        {pct > 85 && <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600"><AlertTriangle className="w-2.5 h-2.5"/>{pct}% of daily budget used</div>}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function IrrigationPage() {
  const [showModal, setShowModal] = useState(false)
  const [editSchedule, setEditSchedule] = useState<IrrigationSchedule|undefined>()
  const [filterFarm, setFilterFarm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const { data: farms=[] } = useQuery({ queryKey:['farms'], queryFn:farmsApi.list })
  const { data: allZones=[] } = useQuery({
    queryKey:['all-zones'],
    queryFn: async () => {
      if (!(farms as any[]).length) return []
      const results = await Promise.all((farms as any[]).map((f:any) => zonesApi.list(f.id)))
      return results.flat()
    },
    enabled: !!(farms as any[]).length,
    refetchInterval: false
  })

  const schedules = useMemo(() => {
    if (!(farms as any[]).length) return []
    return genSchedules(farms as any[], allZones as any[])
  }, [farms, allZones])

  const filtered = useMemo(() => schedules.filter(s => {
    if (filterFarm && s.farm_id !== filterFarm) return false
    if (filterStatus && s.status !== filterStatus) return false
    return true
  }), [schedules, filterFarm, filterStatus])

  const totalWater = schedules.reduce((a,s)=>a+s.water_used_today_L,0)
  const totalBudget = schedules.reduce((a,s)=>a+s.daily_budget_L,0)
  const activeCount = schedules.filter(s=>s.status==='active').length
  const alertCount = schedules.filter(s=>s.water_used_today_L/s.daily_budget_L>0.85).length

  const handleToggle = (s: IrrigationSchedule) => {
    toast.success(s.status==='active'?`Paused irrigation for ${s.zone_code}`:`Resumed irrigation for ${s.zone_code}`)
  }

  const openEdit = (s: IrrigationSchedule) => { setEditSchedule(s); setShowModal(true) }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Irrigation Scheduling</h1>
          <p className="text-xs text-muted mt-0.5">Farm-type-specific irrigation modes · Nutrient dosing · Water budgets · Per-zone schedules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary"><RefreshCw className="w-3.5 h-3.5"/>Refresh</Button>
          <Button variant="primary" onClick={()=>{ setEditSchedule(undefined); setShowModal(true) }}>
            <Plus className="w-3.5 h-3.5"/> New Schedule
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Schedules" value={activeCount} icon={Activity} accent="green" sub={`${schedules.length} total configured`}/>
        <StatCard label="Water Today" value={`${(totalWater/1000).toFixed(1)}kL`} icon={Droplets} accent="blue" sub={`${Math.round(totalWater/totalBudget*100)}% of daily budget`}/>
        <StatCard label="Farms Covered" value={(farms as any[]).length} icon={Waves} accent="purple" sub={`${[...new Set(schedules.map(s=>s.farm_type))].length} grow methods`}/>
        <StatCard label="Budget Alerts" value={alertCount} icon={AlertTriangle} accent={alertCount>0?'red':'green'} sub={alertCount>0?'Zones over 85% budget':'All within budget'}/>
      </div>

      {/* Farm-type summary row */}
      {(farms as any[]).length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(farms as any[]).map((farm:any) => {
            const cfg = IRRIGATION_CONFIGS[farm.type] || IRRIGATION_CONFIGS.hydroponic
            const farmSchedules = schedules.filter(s=>s.farm_id===farm.id)
            const farmWater = farmSchedules.reduce((a,s)=>a+s.water_used_today_L,0)
            return (
              <div key={farm.id} className="bg-white rounded-xl border border-[var(--border)] p-4 cursor-pointer hover:border-[var(--border2)] transition-all"
                onClick={()=>setFilterFarm(filterFarm===farm.id?'':farm.id)}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{cfg.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-[var(--text)] leading-tight">{farm.name}</div>
                    <div className="text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{background:cfg.bg,color:cfg.color}}>{cfg.mode_label}</div>
                  </div>
                </div>
                <div className="text-xs text-muted">{farmSchedules.length} zones · {farmWater}L today</div>
                <div className="progress-track mt-2">
                  <div className="progress-fill" style={{width:`${Math.min(100,farmWater/(farmSchedules.reduce((a,s)=>a+s.daily_budget_L,1)))*100}%`,background:cfg.color}}/>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select className="input text-xs py-1.5" style={{width:'auto'}} value={filterFarm} onChange={e=>setFilterFarm(e.target.value)}>
          <option value="">All farms</option>
          {(farms as any[]).map((f:any)=><option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className="input text-xs py-1.5" style={{width:'auto'}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="scheduled">Scheduled</option>
        </select>
        {(filterFarm||filterStatus)&&<button className="text-xs text-[var(--accent)] hover:underline" onClick={()=>{setFilterFarm('');setFilterStatus('')}}>Clear filters</button>}
        <span className="text-xs text-muted ml-auto">{filtered.length} of {schedules.length} zones</span>
      </div>

      {/* Schedule grid */}
      {filtered.length===0 ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-12 text-center">
          <Droplets className="w-10 h-10 text-muted mx-auto mb-3 opacity-40"/>
          <div className="text-sm font-semibold text-[var(--text)] mb-1">No irrigation schedules found</div>
          <div className="text-xs text-muted mb-4">Create schedules to automate nutrient delivery for each zone</div>
          <Button variant="primary" onClick={()=>{ setEditSchedule(undefined); setShowModal(true) }}><Plus className="w-3.5 h-3.5"/> Create First Schedule</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s=>(
            <ScheduleCard key={s.id} schedule={s} onEdit={()=>openEdit(s)} onToggle={()=>handleToggle(s)}/>
          ))}
        </div>
      )}

      <ScheduleModal open={showModal} onClose={()=>{ setShowModal(false); setEditSchedule(undefined) }}
        farms={farms as any[]} zones={allZones as any[]} editSchedule={editSchedule}/>
    </div>
  )
}
