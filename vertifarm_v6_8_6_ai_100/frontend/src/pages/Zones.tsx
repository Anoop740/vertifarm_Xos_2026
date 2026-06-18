import { useSensorWebSocket } from '@/hooks/useWebSocket'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { zonesApi, farmsApi } from '@/lib/api'
import { Badge, Button, Input, Select, EmptyState, Modal, Textarea } from '@/components/ui'
import { Layers, Plus, ChevronRight, Edit2, X, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Demo fallback data ───────────────────────────────────────── */
const DEMO_FARMS = [
  { id:'f1', name:'Delhi HQ' },
  { id:'f2', name:'Mumbai Vertical' },
  { id:'f3', name:'Pune Rooftop' },
]

const mkSensors = (t:number,h:number,c:number,ph:number,ec:number,p:number) =>
  ({ temperature:t, humidity:h, co2_ppm:c, ph, ec, ppfd:p })

const DEMO_ZONES = [
  { id:'z1', farm_id:'f1', name:'Zone A1', crop_name:'Lettuce',     status:'active',   area_m2:48, capacity:200, current_plants:188, day_of_cycle:18, cycle_days:28, sensors: mkSensors(24.1,68.2,1100,6.1,2.0,280) },
  { id:'z2', farm_id:'f1', name:'Zone A2', crop_name:'Spinach',     status:'active',   area_m2:36, capacity:160, current_plants:154, day_of_cycle:11, cycle_days:21, sensors: mkSensors(22.8,72.5,980, 6.3,1.8,240) },
  { id:'z3', farm_id:'f1', name:'Zone A3', crop_name:'Basil',       status:'warning',  area_m2:24, capacity:120, current_plants:116, day_of_cycle:9,  cycle_days:35, sensors: mkSensors(25.3,91.3,1140,5.9,2.2,298) },
  { id:'z4', farm_id:'f1', name:'Zone B1', crop_name:'Arugula',     status:'active',   area_m2:48, capacity:200, current_plants:196, day_of_cycle:14, cycle_days:21, sensors: mkSensors(23.4,65.0,1050,6.2,1.9,260) },
  { id:'z5', farm_id:'f1', name:'Zone B2', crop_name:'Chard',       status:'critical', area_m2:36, capacity:160, current_plants:160, day_of_cycle:6,  cycle_days:28, sensors: mkSensors(24.0,69.1,890, 6.0,1.6,220) },
  { id:'z6', farm_id:'f1', name:'Zone C1', crop_name:'Kale',        status:'active',   area_m2:60, capacity:240, current_plants:220, day_of_cycle:22, cycle_days:30, sensors: mkSensors(21.9,63.4,1020,6.4,2.1,310) },
  { id:'z7', farm_id:'f1', name:'Zone C2', crop_name:'Tomato',      status:'active',   area_m2:72, capacity:80,  current_plants:78,  day_of_cycle:45, cycle_days:90, sensors: mkSensors(26.0,58.2,1200,6.0,3.2,450) },
  { id:'z8', farm_id:'f1', name:'Zone D1', crop_name:'Microgreens', status:'active',   area_m2:20, capacity:400, current_plants:395, day_of_cycle:7,  cycle_days:10, sensors: mkSensors(22.5,70.0,950, 6.1,1.2,200) },
]

/* ── Sensor definitions with warn thresholds ─────────────────── */
const SENSOR_FIELDS = [
  { key:'temperature', label:'Temp',  unit:'°C',    warn:(v:number)=>v>28||v<18 },
  { key:'humidity',    label:'RH',    unit:'%',     warn:(v:number)=>v>85||v<45 },
  { key:'co2_ppm',     label:'CO₂',   unit:'ppm',   warn:(v:number)=>v>1500||v<400 },
  { key:'ph',          label:'pH',    unit:'',      warn:(v:number)=>v>7||v<5.5 },
  { key:'ec',          label:'EC',    unit:'mS/cm', warn:(v:number)=>v>3.5||v<1.0 },
  { key:'ppfd',        label:'PPFD',  unit:'µmol',  warn:(v:number)=>v>600||v<100 },
]

/* ── Normalise zone from API (backend may return flat fields) ─── */
function normaliseZone(z: any) {
  return {
    ...z,
    crop_name:      z.crop_name || z.crop?.name || z.recipe_name || 'Unknown',
    day_of_cycle:   z.day_of_cycle   ?? z.days_in_cycle    ?? 0,
    cycle_days:     z.cycle_days     ?? z.total_cycle_days ?? 28,
    current_plants: z.current_plants ?? z.plant_count      ?? z.capacity ?? 0,
    sensors: z.sensors ?? {
      temperature: z.current_temp      ?? z.target_temp     ?? 23,
      humidity:    z.current_humidity  ?? z.target_humidity ?? 65,
      co2_ppm:     z.current_co2      ?? z.target_co2      ?? 1000,
      ph:          z.current_ph       ?? z.target_ph       ?? 6.2,
      ec:          z.current_ec       ?? z.target_ec       ?? 2.0,
      ppfd:        z.current_ppfd     ?? z.target_ppfd     ?? 250,
    },
  }
}

type Zone = ReturnType<typeof normaliseZone>

/* ── Add Zone Modal ───────────────────────────────────────────── */
function AddZoneModal({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const qc = useQueryClient()
  const { data: farms = DEMO_FARMS } = useQuery({ queryKey:['farms'], queryFn: farmsApi.list })
  const farmList = (farms as any[]).length ? farms as any[] : DEMO_FARMS

  const [form, setForm] = useState({
    name:'', code:'', farm_id:'', status:'active',
    area_m2:'', capacity:'', rack_count:'5', level_count:'6',
    target_temp:'23', target_humidity:'65', target_co2:'1100',
    target_ph:'6.2', target_ec:'2.0', target_ppfd:'300', notes:''
  })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k:string,v:string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>{ const n={...e}; delete n[k]; return n }) }

  const handleSubmit = async () => {
    const e: Record<string,string> = {}
    if (!form.name.trim()) e.name = 'Zone name required'
    if (!form.farm_id)     e.farm_id = 'Select a farm'
    if (!form.area_m2)     e.area_m2 = 'Area required'
    setErrors(e); if (Object.keys(e).length) return
    setLoading(true)
    try {
      await zonesApi.create({
        ...form,
        area_m2:        parseFloat(form.area_m2),
        capacity:       form.capacity ? parseInt(form.capacity) : undefined,
        rack_count:     parseInt(form.rack_count),
        level_count:    parseInt(form.level_count),
        target_temp:    parseFloat(form.target_temp),
        target_humidity:parseFloat(form.target_humidity),
        target_co2:     parseInt(form.target_co2),
        target_ph:      parseFloat(form.target_ph),
        target_ec:      parseFloat(form.target_ec),
        target_ppfd:    parseInt(form.target_ppfd),
      })
      qc.invalidateQueries({ queryKey:['zones'] })
      toast.success(`Zone "${form.name}" created`)
      setForm({ name:'', code:'', farm_id:'', status:'active', area_m2:'', capacity:'', rack_count:'5', level_count:'6', target_temp:'23', target_humidity:'65', target_co2:'1100', target_ph:'6.2', target_ec:'2.0', target_ppfd:'300', notes:'' })
      onClose()
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to create zone') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New Zone" size="xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={loading} onClick={handleSubmit}>Create Zone</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Zone Name *" placeholder="e.g. Zone A1" value={form.name} onChange={e=>set('name',e.target.value)} error={errors.name}/>
          <Input label="Zone Code"   placeholder="e.g. A1"      value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())}/>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Farm *"
            options={[{value:'',label:'Select farm…'}, ...farmList.map((f:any)=>({value:f.id,label:f.name}))]}
            value={form.farm_id} onChange={e=>set('farm_id',e.target.value)} error={errors.farm_id}/>
          <Select label="Status" options={[
            {value:'active',label:'Active — Growing'},{value:'idle',label:'Idle — Empty'},
            {value:'maintenance',label:'Maintenance'},{value:'harvesting',label:'Harvesting'},
          ]} value={form.status} onChange={e=>set('status',e.target.value)}/>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Area (m²) *" type="number" placeholder="48" value={form.area_m2} onChange={e=>set('area_m2',e.target.value)} error={errors.area_m2}/>
          <Input label="Capacity (plants)" type="number" placeholder="200" value={form.capacity} onChange={e=>set('capacity',e.target.value)}/>
          <Input label="Racks" type="number" placeholder="5" value={form.rack_count} onChange={e=>set('rack_count',e.target.value)}/>
        </div>
        <p className="text-xs font-semibold text-[var(--text)]">Target Setpoints</p>
        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
          {[
            {key:'target_temp',     label:'Temperature (°C)',  placeholder:'23.0'},
            {key:'target_humidity', label:'Humidity (%)',       placeholder:'65'},
            {key:'target_co2',      label:'CO₂ (ppm)',          placeholder:'1100'},
            {key:'target_ph',       label:'pH',                 placeholder:'6.2'},
            {key:'target_ec',       label:'EC (mS/cm)',          placeholder:'2.0'},
            {key:'target_ppfd',     label:'PPFD (µmol)',         placeholder:'300'},
          ].map(f=>(
            <Input key={f.key} label={f.label} type="number" step="0.1"
              placeholder={f.placeholder} value={(form as any)[f.key]}
              onChange={e=>set(f.key,e.target.value)}/>
          ))}
        </div>
        <Textarea label="Notes" placeholder="Any special notes about this zone…" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={2}/>
      </div>
    </Modal>
  )
}

/* ── Edit Zone Modal ──────────────────────────────────────────── */
function EditZoneModal({ zone, open, onClose }: { zone:Zone; open:boolean; onClose:()=>void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name:zone.name, status:zone.status, area_m2:String(zone.area_m2), capacity:String(zone.capacity) })
  const [loading, setLoading] = useState(false)
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await zonesApi.update(zone.id, { ...form, area_m2:parseFloat(form.area_m2), capacity:parseInt(form.capacity) })
      qc.invalidateQueries({ queryKey:['zones'] })
      toast.success('Zone updated')
      onClose()
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to update') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${zone.name}`} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={loading} onClick={handleSubmit}>Save Changes</Button></>}>
      <div className="space-y-4">
        <Input label="Zone Name" value={form.name} onChange={e=>set('name',e.target.value)}/>
        <Select label="Status" options={[
          {value:'active',label:'Active — Growing'},{value:'idle',label:'Idle — Empty'},
          {value:'maintenance',label:'Maintenance'},{value:'harvesting',label:'Harvesting'},
        ]} value={form.status} onChange={e=>set('status',e.target.value)}/>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Area (m²)" type="number" value={form.area_m2} onChange={e=>set('area_m2',e.target.value)}/>
          <Input label="Capacity (plants)" type="number" value={form.capacity} onChange={e=>set('capacity',e.target.value)}/>
        </div>
      </div>
    </Modal>
  )
}

/* ── Zone Detail Drawer ───────────────────────────────────────── */
function ZoneDetailDrawer({ zone, onClose, onEdit }: { zone:Zone; onClose:()=>void; onEdit:()=>void }) {
  const progress  = zone.cycle_days  ? Math.round((zone.day_of_cycle / zone.cycle_days) * 100) : 0
  const occupancy = zone.capacity    ? Math.round((zone.current_plants / zone.capacity) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1"/>
      <div className="w-full max-w-md bg-[var(--card)] border-l border-[var(--border)] shadow-2xl overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">{zone.name}</h2>
            <p className="text-xs text-muted">{zone.crop_name} · {zone.area_m2} m²</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm flex items-center gap-1" onClick={onEdit}>
              <Edit2 className="w-3.5 h-3.5"/> Edit
            </button>
            <button className="btn-ghost btn-sm p-1.5" onClick={onClose}><X className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-3">
            <Badge variant={zone.status==='active'?'green':zone.status==='warning'?'amber':'red'}>{zone.status}</Badge>
            <span className="text-xs text-muted">Day {zone.day_of_cycle}/{zone.cycle_days}</span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted mb-1.5">
              <span>Cycle progress</span><span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{width:`${progress}%`}}/>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted mb-1.5">
              <span>Plant occupancy</span><span>{zone.current_plants}/{zone.capacity} ({occupancy}%)</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
              <div className="h-full rounded-full" style={{width:`${occupancy}%`,background:'var(--green)'}}/>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--text)] mb-3">Live Sensor Readings</p>
            <div className="grid grid-cols-2 gap-2">
              {SENSOR_FIELDS.map(({key,label,unit,warn})=>{
                const val = (zone.sensors as any)?.[key] ?? 0
                const isWarn = warn(val)
                return (
                  <div key={key} className={`rounded-xl p-3 border ${isWarn?'border-amber-200 bg-amber-50':'border-[var(--border)] bg-[var(--bg3)]'}`}>
                    <div className="text-[10px] text-muted uppercase tracking-wide mb-1">{label}</div>
                    <div className={`text-lg font-bold ${isWarn?'text-[var(--amber)]':'text-[var(--text)]'}`}>
                      {val}<span className="text-xs font-normal ml-0.5">{unit}</span>
                    </div>
                    {isWarn&&<div className="text-[9px] text-[var(--amber)] mt-0.5">⚠ Out of range</div>}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--text)] mb-2">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                {label:'Trigger Irrigation', action:()=>toast.success('Irrigation cycle triggered for '+zone.name)},
                {label:'Adjust CO₂',         action:()=>toast.success('CO₂ adjustment queued')},
                {label:'Log Scouting',        action:()=>toast.success('Scouting log opened')},
                {label:'Mark for Harvest',    action:()=>toast.success(zone.name+' marked for harvest')},
              ].map(a=>(
                <button key={a.label} onClick={a.action} className="btn-secondary btn-sm text-xs text-left p-2.5">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Zone Card ────────────────────────────────────────────────── */
function ZoneCard({ zone, onClick }: { zone:Zone; onClick:()=>void }) {
  const [liveTemp, setLiveTemp] = useState<number|null>(null)
  useEffect(() => {
    if (!zone.sensors) return
    const t = setInterval(() => {
      setLiveTemp(v => v === null
        ? (zone.sensors as any).temperature
        : parseFloat(((zone.sensors as any).temperature + (Math.random()-0.5)*0.3).toFixed(1)))
    }, 4000)
    return () => clearInterval(t)
  }, [zone.sensors])

  const progress  = zone.cycle_days ? Math.round((zone.day_of_cycle / zone.cycle_days) * 100) : 0
  const occupancy = zone.capacity   ? Math.round((zone.current_plants / zone.capacity) * 100) : 0
  const statusBorder = zone.status==='critical' ? 'border-red-200'
    : zone.status==='warning' ? 'border-amber-200' : 'border-[var(--border)]'

  return (
    <div className={`card p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all ${statusBorder}`}
         onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[var(--text)]">{zone.name}</span>
            <Badge variant={zone.status==='active'?'green':zone.status==='warning'?'amber':'red'}>{zone.status}</Badge>
          </div>
          <div className="text-xs text-muted mt-0.5">{zone.crop_name} · {zone.area_m2} m²</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-muted">Day</div>
          <div className="text-lg font-bold text-[var(--text)]">
            {zone.day_of_cycle}<span className="text-xs text-muted font-normal">/{zone.cycle_days}</span>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-muted mb-1">
          <span>Cycle progress</span><span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{background:'var(--surface)'}}>
          <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-700" style={{width:`${progress}%`}}/>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {SENSOR_FIELDS.map(({key,label,unit,warn})=>{
          const raw = (zone.sensors as any)?.[key] ?? 0
          const val = key==='temperature' && liveTemp!==null ? liveTemp : raw
          const isWarn = warn(Number(val))
          return (
            <div key={key} className={`rounded-md p-1.5 text-center ${isWarn?'bg-amber-50 border border-amber-100':'bg-[var(--bg3)]'}`}>
              <div className="text-[9px] text-muted uppercase tracking-wide">{label}</div>
              <div className={`text-xs font-semibold ${isWarn?'text-[var(--amber)]':'text-[var(--text)]'}`}>
                {val}{unit}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-muted">
        <span>{zone.current_plants}/{zone.capacity} plants ({occupancy}%)</span>
        <ChevronRight className="w-3.5 h-3.5"/>
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function ZonesPage() {
  const qc = useQueryClient()
  const [farmFilter,   setFarmFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search,       setSearch]       = useState('')
  const [selectedZone, setSelectedZone] = useState<Zone|null>(null)
  const [editZone,     setEditZone]     = useState<Zone|null>(null)
  const [showAdd,      setShowAdd]      = useState(false)

  const { data: rawZones = [], isLoading, error } = useQuery({
    queryKey: ['zones', farmFilter],
    queryFn: () => zonesApi.list(farmFilter!=='all' ? farmFilter : undefined),
    retry: 1,
  })

  const zones: Zone[] = ((rawZones as any[]).length ? rawZones as any[] : DEMO_ZONES).map(normaliseZone)

  const visible = zones.filter(z => {
    if (farmFilter   !== 'all' && z.farm_id !== farmFilter) return false
    if (statusFilter !== 'all' && z.status  !== statusFilter) return false
    if (search && !z.name.toLowerCase().includes(search.toLowerCase()) &&
                  !z.crop_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = {
    active:   zones.filter(z=>z.status==='active').length,
    warning:  zones.filter(z=>z.status==='warning').length,
    critical: zones.filter(z=>z.status==='critical').length,
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Zones</h1>
          <p className="text-xs text-muted mt-0.5">{zones.length} zones · {counts.active} active · {counts.warning} warnings · {counts.critical} critical</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm flex items-center gap-1.5"
            onClick={()=>{qc.invalidateQueries({queryKey:['zones']});toast.success('Zones refreshed')}}>
            <RefreshCw className="w-3.5 h-3.5"/>
          </button>
          <Button variant="primary" onClick={()=>setShowAdd(true)}><Plus className="w-3.5 h-3.5"/>Add Zone</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Total Zones', value:zones.length,      color:'text-[var(--accent)]'},
          {label:'Active',      value:counts.active,     color:'text-[var(--green-light)]'},
          {label:'Warnings',    value:counts.warning,    color:'text-[var(--amber-light)]'},
          {label:'Critical',    value:counts.critical,   color:'text-[var(--red-light)]'},
        ].map(({label,value,color})=>(
          <div key={label} className="card p-4">
            <div className="text-xs text-muted mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className="input text-xs py-1.5 w-48" placeholder="Search zones or crops…"
          value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="input text-xs py-1.5" style={{width:'auto'}} value={farmFilter} onChange={e=>setFarmFilter(e.target.value)}>
          <option value="all">All Farms</option>
          {DEMO_FARMS.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="flex gap-1.5 flex-wrap">
          {(['all','active','warning','critical','idle','maintenance'] as const).map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-md border capitalize transition-all ${
                statusFilter===s?'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]':'border-[var(--border)] text-muted hover:text-[var(--text)]'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i=><div key={i} className="skeleton h-56 rounded-xl"/>)}
        </div>
      ) : visible.length===0 ? (
        <EmptyState icon={Layers} title="No zones found" message="No zones match your current filter."/>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(zone=>(
            <ZoneCard key={zone.id} zone={zone} onClick={()=>setSelectedZone(zone)}/>
          ))}
        </div>
      )}

      <AddZoneModal open={showAdd} onClose={()=>setShowAdd(false)}/>
      {selectedZone && (
        <ZoneDetailDrawer zone={selectedZone} onClose={()=>setSelectedZone(null)}
          onEdit={()=>{setEditZone(selectedZone);setSelectedZone(null)}}/>
      )}
      {editZone && (
        <EditZoneModal zone={editZone} open={!!editZone} onClose={()=>setEditZone(null)}/>
      )}
    </div>
  )
}
