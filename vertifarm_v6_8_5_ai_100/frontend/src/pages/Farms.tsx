import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { farmsApi, zonesApi, devicesApi } from '@/lib/api'
import { Button, Badge, Modal, Input, Select, StatCard, EmptyState } from '@/components/ui'
import {
  Building2, Plus, MapPin, Layers, Cpu, Leaf, Edit2,
  ChevronRight, Activity, Thermometer, Droplets, Wind, Zap,
  Eye, Settings, RefreshCw, Waves, FlaskConical, Info, CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Farm { id:string; name:string; code:string; type:string; location:string; area_sqm:number; is_active:boolean; latitude?:number; longitude?:number }
interface Zone { id:string; name:string; code:string; farm_id:string; status:string; rack_count:number; level_count:number; area_sqm:number; target_temp:number; target_humidity:number; target_co2:number; target_ph:number; target_ec:number; target_ppfd:number }
interface Device { id:string; name:string; device_type:string; device_uid:string; farm_id:string; zone_id?:string; status:string; protocol:string; firmware_version:string }

// ─── Farm type metadata ──────────────────────────────────────────────────────
const FARM_TYPES = [
  // ── Rack / Vertical Indoor ─────────────────────────────────────────────────
  { value:'rack',        label:'Rack-Based Vertical Farm',    icon:'🗄️', desc:'Multi-tier grow racks with LED panels. Most common indoor vertical farm type. Maximum space efficiency.' },
  { value:'tower',       label:'Tower / Vertical Column',     icon:'🗼', desc:'Vertical towers or columns with drip or aeroponic delivery. Ideal for herbs, lettuce, and small greens.' },
  { value:'zip_grow',    label:'ZipGrow / Wall Panel',        icon:'🌿', desc:'Vertical wall-mounted growing panels (ZipGrow, Tower Garden etc). Great for urban retail and restaurants.' },
  // ── Hydroponic family ──────────────────────────────────────────────────────
  { value:'hydroponic',  label:'Hydroponic (DWC / Raft)',     icon:'💧', desc:'Deep water culture with nutrient-rich reservoir raft beds. Proven workhorse for leafy greens at scale.' },
  { value:'nft',         label:'NFT (Nutrient Film Technique)',icon:'🌊', desc:'Thin film of nutrient solution flows through inclined channels. Low water use, fast growth cycles.' },
  { value:'dwc',         label:'DWC (Deep Water Culture)',    icon:'🏊', desc:'Roots fully submerged in oxygenated nutrient solution. Simple, reliable, ideal for R&D and trial crops.' },
  // ── Aeroponic family ───────────────────────────────────────────────────────
  { value:'aeroponic',   label:'Aeroponic (High-Pressure Mist)',icon:'☁️', desc:'Roots suspended in air, misted every few minutes with fine droplets. Maximum O₂, fastest growth rates.' },
  { value:'fogponics',   label:'Fogponics (Low-Pressure Fog)', icon:'🌫️', desc:'Ultra-fine fog (5–30 micron) instead of high-pressure mist. Lower energy, high root-zone humidity.' },
  // ── Controlled environment ─────────────────────────────────────────────────
  { value:'container',   label:'Container Farm',              icon:'📦', desc:'Fully sealed shipping container farms. Mobile, rapid deployment, complete climate isolation.' },
  { value:'greenhouse',  label:'Greenhouse Integrated',       icon:'🏡', desc:'Hybrid greenhouse combined with hydroponic systems. Natural light + LED supplemental. Lower CAPEX.' },
  // ── Soil-based indoor ──────────────────────────────────────────────────────
  { value:'raised_bed',  label:'Indoor Raised Bed',           icon:'🌱', desc:'Indoor raised beds with soil or coco coir substrate. Lower investment, suitable for transition farms.' },
  // ── Specialty ─────────────────────────────────────────────────────────────
  { value:'aquaponics',  label:'Aquaponics (Fish + Plant)',   icon:'🐟', desc:'Symbiotic fish-plant system. Fish waste feeds plants, plants clean the water. Zero chemical nutrients.' },
]

// ─── Smart zone defaults per farm type ──────────────────────────────────────
const ZONE_DEFAULTS: Record<string, {
  rack_count: string; level_count: string; area_sqm: string;
  target_temp: string; target_humidity: string; target_co2: string;
  target_ph: string; target_ec: string; target_ppfd: string;
  hint: string;
}> = {
  hydroponic: { rack_count:'6', level_count:'4', area_sqm:'180',
    target_temp:'22.0', target_humidity:'65', target_co2:'1100',
    target_ph:'6.2', target_ec:'1.8', target_ppfd:'280',
    hint:'Hydroponic DWC/raft zones: wider beds, 4-tier racks, stable pH 6.0–6.5, EC 1.6–2.2 mS/cm.' },
  nft: { rack_count:'8', level_count:'2', area_sqm:'200',
    target_temp:'21.0', target_humidity:'63', target_co2:'1050',
    target_ph:'6.0', target_ec:'1.6', target_ppfd:'270',
    hint:'NFT channels: 2-level gutter runs, high plant density, slightly lower EC than DWC to prevent tip-burn.' },
  aeroponic: { rack_count:'12', level_count:'6', area_sqm:'75',
    target_temp:'22.0', target_humidity:'70', target_co2:'1200',
    target_ph:'5.8', target_ec:'2.0', target_ppfd:'320',
    hint:'Aeroponic towers: more racks, more levels, slightly lower pH 5.8–6.0, higher CO₂ for faster growth.' },
  dwc: { rack_count:'1', level_count:'1', area_sqm:'200',
    target_temp:'20.0', target_humidity:'65', target_co2:'1000',
    target_ph:'5.9', target_ec:'1.6', target_ppfd:'250',
    hint:'DWC raft beds: single-level large beds, 1 rack per zone, dissolved O₂ is key parameter.' },
  tower: { rack_count:'10', level_count:'8', area_sqm:'60',
    target_temp:'22.0', target_humidity:'67', target_co2:'1100',
    target_ph:'6.0', target_ec:'1.8', target_ppfd:'290',
    hint:'Tower systems: many vertical positions, small footprint per zone, steady drip irrigation.' },
  rack: { rack_count:'5', level_count:'6', area_sqm:'120',
    target_temp:'23.0', target_humidity:'65', target_co2:'1100',
    target_ph:'6.2', target_ec:'2.0', target_ppfd:'350',
    hint:'Vertical racks: 5–6 tiers, high PPFD from close-mounted LEDs, short spacing between levels.' },
  greenhouse: { rack_count:'4', level_count:'2', area_sqm:'300',
    target_temp:'24.0', target_humidity:'60', target_co2:'900',
    target_ph:'6.3', target_ec:'2.2', target_ppfd:'400',
    hint:'Greenhouse zones are larger. Natural light supplemented by LEDs. Higher temp, lower humidity targets.' },
  container: { rack_count:'4', level_count:'5', area_sqm:'30',
    target_temp:'22.0', target_humidity:'65', target_co2:'1200',
    target_ph:'6.0', target_ec:'1.8', target_ppfd:'300',
    hint:'Container farms: compact zones, 20–40 ft units, fully sealed — higher CO₂ retention is natural.' },
  zip_grow: { rack_count:'8', level_count:'10', area_sqm:'40',
    target_temp:'22.0', target_humidity:'65', target_co2:'1100',
    target_ph:'6.0', target_ec:'1.8', target_ppfd:'280',
    hint:'ZipGrow / wall panels: many vertical growing positions per column. Drip-fed from top reservoir.' },
  fogponics: { rack_count:'10', level_count:'6', area_sqm:'65',
    target_temp:'22.0', target_humidity:'72', target_co2:'1200',
    target_ph:'5.8', target_ec:'1.8', target_ppfd:'300',
    hint:'Fogponics: ultra-fine mist. Keep nozzle size 5–30 micron. Root zone stays at 95%+ RH at all times.' },
  raised_bed: { rack_count:'4', level_count:'1', area_sqm:'160',
    target_temp:'22.0', target_humidity:'60', target_co2:'900',
    target_ph:'6.5', target_ec:'2.5', target_ppfd:'350',
    hint:'Indoor raised beds: soil/coco substrate. Conventional pH 6.2–6.8. Irrigation via drip or hand-watering.' },
  aquaponics: { rack_count:'3', level_count:'2', area_sqm:'120',
    target_temp:'26.0', target_humidity:'68', target_co2:'900',
    target_ph:'7.0', target_ec:'0.8', target_ppfd:'220',
    hint:'Aquaponics: pH 6.8–7.2 for both fish and plants. EC stays naturally low from fish waste. Tilapia: 26°C.' },
}

const SENSOR_TYPES = [
  { value:'temperature_humidity', label:'Temp / Humidity Sensor' },
  { value:'co2', label:'CO₂ Sensor (ppm)' },
  { value:'ph_ec', label:'pH + EC Controller' },
  { value:'ppfd', label:'PPFD / Light Sensor (µmol)' },
  { value:'flow', label:'Flow Rate Sensor (L/min)' },
  { value:'pressure', label:'Pressure Sensor (bar)' },
  { value:'dissolved_oxygen', label:'Dissolved Oxygen (mg/L)' },
  { value:'water_level', label:'Water Level Sensor' },
  { value:'vpd', label:'VPD Sensor (kPa)' },
  { value:'water_temp', label:'Water Temperature Sensor' },
  { value:'drain_ec', label:'Drain / Return EC Sensor' },
]
const CONTROLLER_TYPES = [
  { value:'gateway', label:'IoT Gateway' },
  { value:'pump_controller', label:'Pump Controller' },
  { value:'lighting_controller', label:'Lighting Controller' },
  { value:'hvac_controller', label:'HVAC / Climate Controller' },
  { value:'dosing_pump', label:'Dosing Pump Controller' },
  { value:'actuator', label:'Actuator / Relay' },
  { value:'camera', label:'RGB / Hyperspectral Camera' },
  { value:'plc', label:'PLC Controller' },
]
const PROTOCOLS = [
  { value:'mqtt', label:'MQTT' }, { value:'modbus', label:'Modbus RTU/TCP' },
  { value:'bacnet', label:'BACnet' }, { value:'opcua', label:'OPC-UA' },
  { value:'lorawan', label:'LoRaWAN' }, { value:'zigbee', label:'Zigbee' },
  { value:'ble', label:'Bluetooth LE' }, { value:'http', label:'HTTP/REST' },
]

const ZONE_STATUS_OPTIONS = [
  { value:'active', label:'Active — Growing' },
  { value:'idle', label:'Idle — Empty' },
  { value:'maintenance', label:'Maintenance' },
  { value:'harvesting', label:'Harvesting' },
]

// ─── Farm type colour helper ─────────────────────────────────────────────────
const ftColor: Record<string,string> = {
  rack:'#10b981', tower:'#f59e0b', zip_grow:'#8b5cf6',
  hydroponic:'#3b82f6', nft:'#06b6d4', dwc:'#0ea5e9',
  aeroponic:'#8b5cf6', fogponics:'#a78bfa',
  container:'#f97316', greenhouse:'#22c55e',
  raised_bed:'#84cc16', aquaponics:'#14b8a6',
}
const ftBg: Record<string,string> = {
  rack:'rgba(16,185,129,0.1)', tower:'rgba(245,158,11,0.1)', zip_grow:'rgba(139,92,246,0.1)',
  hydroponic:'rgba(59,130,246,0.1)', nft:'rgba(6,182,212,0.1)', dwc:'rgba(14,165,233,0.1)',
  aeroponic:'rgba(139,92,246,0.1)', fogponics:'rgba(167,139,250,0.1)',
  container:'rgba(249,115,22,0.1)', greenhouse:'rgba(34,197,94,0.1)',
  raised_bed:'rgba(132,204,22,0.1)', aquaponics:'rgba(20,184,166,0.1)',
}

// ─── Create Farm Modal ───────────────────────────────────────────────────────
function CreateFarmModal({ open, onClose, onCreated }: { open:boolean; onClose:()=>void; onCreated:(f:Farm)=>void }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name:'', code:'', type:'rack', location:'',
    area_sqm:'', latitude:'', longitude:'', timezone:'Asia/Kolkata'
  })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k:string, v:string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>{const n={...e}; delete n[k]; return n}) }

  const selectedType = FARM_TYPES.find(t => t.value === form.type)

  const validate1 = () => {
    const e: Record<string,string> = {}
    if (!form.name.trim()) e.name = 'Farm name required'
    if (!form.code.trim()) e.code = 'Farm code required'
    if (form.code.length > 6) e.code = 'Max 6 characters'
    if (!form.location.trim()) e.location = 'Location required'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const farm = await farmsApi.create({
        ...form, code: form.code.toUpperCase(),
        area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      })
      qc.invalidateQueries({ queryKey:['farms'] })
      toast.success(`Farm "${farm.name}" created`)
      onCreated(farm); handleClose()
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to create farm') }
    finally { setLoading(false) }
  }

  const handleClose = () => {
    setStep(1); setErrors({})
    setForm({ name:'', code:'', type:'rack', location:'', area_sqm:'', latitude:'', longitude:'', timezone:'Asia/Kolkata' })
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create New Farm" size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-muted">
            {['Farm Type','Details','Review'].map((s,i) => (
              <React.Fragment key={s}>
                <span className={cn('flex items-center gap-1', step===i+1?'text-[var(--accent)] font-semibold':step>i+1?'text-[var(--green)]':'text-muted')}>
                  <span className={cn('w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold border',
                    step===i+1?'border-[var(--accent)] bg-[var(--accent-soft)]':
                    step>i+1?'border-[var(--green)] bg-[var(--green-soft)]':'border-[var(--border2)]'
                  )}>{step>i+1?'✓':i+1}</span>{s}
                </span>
                {i<2&&<ChevronRight className="w-3 h-3 text-muted"/>}
              </React.Fragment>
            ))}
          </div>
          <div className="flex gap-2">
            {step>1&&<Button variant="ghost" onClick={()=>setStep(s=>s-1)}>Back</Button>}
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            {step<3
              ? <Button variant="primary" onClick={()=>{ if(step===1||validate1()) setStep(s=>s+1) }}>Next <ChevronRight className="w-3.5 h-3.5"/></Button>
              : <Button variant="primary" onClick={handleSubmit} loading={loading}>Create Farm</Button>
            }
          </div>
        </div>
      }>
      {/* Step 1 — Farm Type */}
      {step===1 && (
        <div>
          <p className="text-sm text-muted mb-4">Choose the growing method. Each type has different zone structures, sensor requirements, and irrigation patterns.</p>
          <div className="grid grid-cols-2 gap-2">
            {FARM_TYPES.map(ft => (
              <div key={ft.value} onClick={()=>set('type',ft.value)}
                className={cn('p-3 rounded-xl border-2 cursor-pointer transition-all', form.type===ft.value?'border-[var(--accent)] bg-[var(--accent-soft)]':'border-[var(--border)] hover:border-[var(--border2)]')}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{ft.icon}</span>
                  <span className="text-xs font-semibold text-[var(--text)]">{ft.label}</span>
                  {form.type===ft.value&&<CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)] ml-auto"/>}
                </div>
                <p className="text-[10px] text-muted leading-relaxed">{ft.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Step 2 — Details */}
      {step===2 && (
        <div className="space-y-4">
          {selectedType && (
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{background:`${ftBg[form.type]||'var(--accent-soft)'}`,border:`1px solid ${ftColor[form.type]||'var(--accent)'}30`}}>
              <span className="text-2xl">{selectedType.icon}</span>
              <div>
                <div className="text-xs font-bold" style={{color:ftColor[form.type]||'var(--accent)'}}>{selectedType.label}</div>
                <div className="text-[11px] text-muted mt-0.5">{selectedType.desc}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Input label="Farm Name *" placeholder="e.g. Delhi HQ Vertical Farm" value={form.name} onChange={e=>set('name',e.target.value)} error={errors.name}/></div>
            <Input label="Farm Code *" placeholder="e.g. DHF (max 6)" value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())} error={errors.code} maxLength={6}/>
            <Input label="Location / City *" placeholder="e.g. Okhla, New Delhi" value={form.location} onChange={e=>set('location',e.target.value)} error={errors.location}/>
            <Input label="Latitude" placeholder="28.6139" type="number" value={form.latitude} onChange={e=>set('latitude',e.target.value)}/>
            <Input label="Longitude" placeholder="77.2090" type="number" value={form.longitude} onChange={e=>set('longitude',e.target.value)}/>
            <Input label="Total Area (m²)" placeholder="2400" type="number" value={form.area_sqm} onChange={e=>set('area_sqm',e.target.value)}/>
            <Select label="Timezone" options={[
              {value:'Asia/Kolkata',label:'IST (Asia/Kolkata)'},{value:'UTC',label:'UTC'},
              {value:'America/New_York',label:'EST'},{value:'Europe/London',label:'GMT'},
            ]} value={form.timezone} onChange={e=>set('timezone',e.target.value)}/>
          </div>
        </div>
      )}
      {/* Step 3 — Review */}
      {step===3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            {[
              ['Farm Name', form.name],
              ['Farm Code', form.code],
              ['Type', selectedType?.label || form.type],
              ['Location', form.location],
              ['Area', form.area_sqm ? `${form.area_sqm} m²` : 'Not set'],
              ['Coordinates', form.latitude && form.longitude ? `${form.latitude}°N, ${form.longitude}°E` : 'Not set'],
              ['Timezone', form.timezone],
            ].map(([k,v]) => (
              <div key={k} className="flex items-center px-4 py-2.5 border-b border-[var(--border)] last:border-0 text-xs">
                <span className="text-muted w-28 shrink-0">{k}</span>
                <span className="text-[var(--text)] font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{background:'var(--accent-soft)',border:'1px solid rgba(13,148,136,0.2)'}}>
            <Info className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5 shrink-0"/>
            <span className="text-muted">After creating, zones will be auto-suggested based on your <strong className="text-[var(--text)]">{selectedType?.label}</strong> farm type with correct environmental targets pre-filled.</span>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Create Zone Modal ───────────────────────────────────────────────────────
function CreateZoneModal({ open, onClose, farm }: { open:boolean; onClose:()=>void; farm:Farm }) {
  const qc = useQueryClient()
  const defaults = ZONE_DEFAULTS[farm.type] || ZONE_DEFAULTS.hydroponic
  const [form, setForm] = useState({ name:'', code:'', status:'active', ...defaults })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k:string,v:string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>{const n={...e};delete n[k];return n}) }

  // Reset with correct defaults when farm changes
  useEffect(() => {
    if (open) {
      const d = ZONE_DEFAULTS[farm.type] || ZONE_DEFAULTS.hydroponic
      setForm({ name:'', code:'', status:'active', ...d })
      setErrors({})
    }
  }, [open, farm.type])

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.name.trim()) e.name = 'Zone name required'
    if (!form.code.trim()) e.code = 'Zone code required'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await zonesApi.create({
        farm_id: farm.id, name: form.name, code: form.code, status: form.status,
        rack_count: parseInt(form.rack_count), level_count: parseInt(form.level_count),
        area_sqm: parseFloat(form.area_sqm),
        target_temp: parseFloat(form.target_temp), target_humidity: parseFloat(form.target_humidity),
        target_co2: parseFloat(form.target_co2), target_ph: parseFloat(form.target_ph),
        target_ec: parseFloat(form.target_ec), target_ppfd: parseFloat(form.target_ppfd),
      })
      qc.invalidateQueries({ queryKey:['zones', farm.id] })
      toast.success(`Zone "${form.name}" added`)
      onClose()
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to create zone') }
    finally { setLoading(false) }
  }

  const ftLabel = FARM_TYPES.find(t=>t.value===farm.type)?.label || farm.type

  return (
    <Modal open={open} onClose={onClose} title={`Add Zone — ${farm.name}`} size="xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleSubmit} loading={loading}>Add Zone</Button></>}>
      <div className="space-y-5">
        {/* Farm type context banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl text-xs" style={{background:ftBg[farm.type]||'var(--accent-soft)',border:`1px solid ${ftColor[farm.type]||'var(--accent)'}30`}}>
          <span className="text-xl">{FARM_TYPES.find(t=>t.value===farm.type)?.icon||'🌿'}</span>
          <div>
            <div className="font-bold text-[var(--text)]">{ftLabel} — Smart Defaults Applied</div>
            <div className="text-muted mt-0.5">{defaults.hint}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Zone Name *" placeholder={farm.type==='nft'?'e.g. NFT Channel 03 — Basil':farm.type==='aeroponic'?'e.g. Aero Tower B — Herbs':farm.type==='dwc'?'e.g. DWC Raft Bed 2 — Spinach':'e.g. Butterhead Bay C'} value={form.name} onChange={e=>set('name',e.target.value)} error={errors.name}/>
          <Input label="Zone Code *" placeholder="e.g. A1, N3, T2" value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())} error={errors.code} maxLength={8}/>
        </div>

        <Select label="Initial Status" options={ZONE_STATUS_OPTIONS} value={form.status} onChange={e=>set('status',e.target.value)}/>

        {/* Structure */}
        <div>
          <p className="text-xs font-semibold text-[var(--text)] mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[var(--accent)]"/> Zone Structure
            {farm.type==='dwc'&&<span className="badge badge-gray ml-1">DWC: single bed per zone</span>}
            {farm.type==='nft'&&<span className="badge badge-teal ml-1">NFT: 2-level gutter channels</span>}
            {farm.type==='aeroponic'&&<span className="badge badge-purple ml-1">Aeroponic: tower positions</span>}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input label={farm.type==='nft'?'Gutter Runs':farm.type==='aeroponic'?'Tower Columns':farm.type==='dwc'?'Raft Beds':'Rack Count'} type="number" min="1" value={form.rack_count} onChange={e=>set('rack_count',e.target.value)}/>
            <Input label={farm.type==='nft'?'Channel Levels':farm.type==='aeroponic'?'Positions / Tower':farm.type==='dwc'?'Bed Layers':'Levels / Tier'} type="number" min="1" value={form.level_count} onChange={e=>set('level_count',e.target.value)}/>
            <Input label="Floor Area (m²)" type="number" step="0.5" value={form.area_sqm} onChange={e=>set('area_sqm',e.target.value)}/>
          </div>
        </div>

        {/* Environmental targets */}
        <div>
          <p className="text-xs font-semibold text-[var(--text)] mb-1 flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-[var(--accent)]"/> Environmental Targets
            <span className="text-[10px] text-muted font-normal ml-1">— pre-filled for {ftLabel}</span>
          </p>
          <p className="text-[10px] text-muted mb-3">These set the automation control targets for this zone's climate and nutrient systems.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Input label="Temperature (°C)" type="number" step="0.5" value={form.target_temp} onChange={e=>set('target_temp',e.target.value)}/>
              <p className="text-[10px] text-muted mt-1">{farm.type==='aeroponic'?'Aero: 20–23°C optimal':farm.type==='nft'?'NFT: 18–22°C':farm.type==='dwc'?'DWC: 17–21°C':'Hydro: 20–24°C'}</p>
            </div>
            <div>
              <Input label="Humidity (%)" type="number" step="1" value={form.target_humidity} onChange={e=>set('target_humidity',e.target.value)}/>
              <p className="text-[10px] text-muted mt-1">{farm.type==='aeroponic'?'Higher RH ok near mist heads':farm.type==='nft'?'Lower RH reduces tip-burn':'60–70% general target'}</p>
            </div>
            <div>
              <Input label="CO₂ (ppm)" type="number" step="50" value={form.target_co2} onChange={e=>set('target_co2',e.target.value)}/>
              <p className="text-[10px] text-muted mt-1">{farm.type==='aeroponic'?'Aero benefits from 1200 ppm':farm.type==='nft'?'1000–1100 ppm standard':'800–1200 ppm'}</p>
            </div>
            <div>
              <Input label="pH Target" type="number" step="0.1" value={form.target_ph} onChange={e=>set('target_ph',e.target.value)}/>
              <p className="text-[10px] text-muted mt-1">{farm.type==='aeroponic'||farm.type==='dwc'?'5.8–6.0 for aero/DWC':'6.0–6.5 for NFT/hydro'}</p>
            </div>
            <div>
              <Input label="EC (mS/cm)" type="number" step="0.1" value={form.target_ec} onChange={e=>set('target_ec',e.target.value)}/>
              <p className="text-[10px] text-muted mt-1">{farm.type==='nft'?'NFT: 1.4–2.0 prevent burn':farm.type==='aeroponic'?'Aero: 1.8–2.5':'1.5–3.5 by crop'}</p>
            </div>
            <div>
              <Input label="PPFD (µmol/m²/s)" type="number" step="10" value={form.target_ppfd} onChange={e=>set('target_ppfd',e.target.value)}/>
              <p className="text-[10px] text-muted mt-1">{farm.type==='aeroponic'?'Aero towers: 300–400+':farm.type==='greenhouse'?'Supplemental: 300–500':'200–350 leafy, 400+ fruiting'}</p>
            </div>
          </div>
        </div>

        {/* Sensor hint */}
        <div className="flex items-start gap-2 p-3 rounded-xl text-[11px]" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
          <Info className="w-3.5 h-3.5 text-[var(--text3)] shrink-0 mt-0.5"/>
          <span className="text-muted">
            After adding this zone, you can register sensors and controllers from the <strong className="text-[var(--text)]">Devices</strong> tab.
            {farm.type==='aeroponic'&&' For aeroponic zones, remember to add a mist pressure sensor and pump controller.'}
            {farm.type==='nft'&&' For NFT zones, a flow rate sensor and drain EC monitor are recommended.'}
            {farm.type==='dwc'&&' For DWC zones, a dissolved oxygen sensor is essential for root health.'}
          </span>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Device Modal ────────────────────────────────────────────────────────
function AddDeviceModal({ open, onClose, farmId, farmType, zones, farmName }:
  { open:boolean; onClose:()=>void; farmId:string; farmType:string; zones:Zone[]; farmName:string }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name:'', device_category:'sensor', device_type:'', device_uid:'', zone_id:'', protocol:'mqtt', ip_address:'', firmware_version:'' })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k:string,v:string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>{const n={...e};delete n[k];return n}) }

  // Recommended sensors per farm type
  const recommendedSensors: Record<string, string[]> = {
    aeroponic: ['temperature_humidity','co2','ph_ec','pressure','dissolved_oxygen'],
    nft: ['temperature_humidity','co2','ph_ec','flow','drain_ec'],
    dwc: ['temperature_humidity','co2','ph_ec','dissolved_oxygen','water_level'],
    hydroponic: ['temperature_humidity','co2','ph_ec','ppfd','water_temp'],
    default: ['temperature_humidity','co2','ph_ec','ppfd'],
  }
  const recs = recommendedSensors[farmType] || recommendedSensors.default

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.name.trim()) e.name = 'Device name required'
    if (!form.device_uid.trim()) e.device_uid = 'Device UID required'
    if (!form.device_type) e.device_type = 'Select type'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await devicesApi.create({ ...form, farm_id: farmId, zone_id: form.zone_id || undefined })
      qc.invalidateQueries({ queryKey:['devices'] })
      toast.success(`Device "${form.name}" registered`)
      onClose()
      setForm({ name:'', device_category:'sensor', device_type:'', device_uid:'', zone_id:'', protocol:'mqtt', ip_address:'', firmware_version:'' })
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to register device') }
    finally { setLoading(false) }
  }

  const isSensor = form.device_category === 'sensor'

  return (
    <Modal open={open} onClose={onClose} title={`Register Device — ${farmName}`} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleSubmit} loading={loading}>Register Device</Button></>}>
      <div className="space-y-4">
        {/* Recommended for this farm type */}
        <div className="p-3 rounded-xl" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Recommended for {FARM_TYPES.find(t=>t.value===farmType)?.label || farmType}</p>
          <div className="flex flex-wrap gap-1.5">
            {recs.map(r => {
              const s = SENSOR_TYPES.find(st=>st.value===r)
              return s ? (
                <button key={r} type="button"
                  onClick={()=>{ set('device_category','sensor'); set('device_type',r) }}
                  className={cn('text-[10px] px-2 py-1 rounded-lg border font-medium transition-all',
                    form.device_type===r?'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]':'border-[var(--border2)] text-muted hover:border-[var(--accent)]'
                  )}>{s.label}</button>
              ) : null
            })}
          </div>
        </div>

        {/* Category toggle */}
        <div className="flex gap-2">
          {['sensor','controller'].map(cat => (
            <button key={cat} type="button" onClick={()=>{ set('device_category',cat); set('device_type','') }}
              className={cn('flex-1 py-2 rounded-lg border text-xs font-semibold transition-all',
                form.device_category===cat?'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]':'border-[var(--border2)] text-muted hover:border-[var(--accent)]'
              )}>
              {cat==='sensor'?'📡 Sensor / Monitor':'⚙️ Controller / Actuator'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Device Name *" placeholder={isSensor?'e.g. A1 Temp/Humidity Sensor':'e.g. A1 Pump Controller'} value={form.name} onChange={e=>set('name',e.target.value)} error={errors.name}/>
          <Input label="Device UID *" placeholder="e.g. VF-DHF-A1-THU-001" value={form.device_uid} onChange={e=>set('device_uid',e.target.value)} error={errors.device_uid}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label={isSensor?'Sensor Type *':'Controller Type *'}
            options={isSensor ? SENSOR_TYPES : CONTROLLER_TYPES}
            value={form.device_type} onChange={e=>set('device_type',e.target.value)} error={errors.device_type}/>
          <Select label="Assign to Zone"
            options={[{value:'',label:'— Farm-level device —'}, ...zones.map(z=>({value:z.id,label:`${z.code} — ${z.name}`}))]}
            value={form.zone_id} onChange={e=>set('zone_id',e.target.value)}/>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select label="Protocol" options={PROTOCOLS} value={form.protocol} onChange={e=>set('protocol',e.target.value)}/>
          <Input label="IP Address" placeholder="192.168.1.100" value={form.ip_address} onChange={e=>set('ip_address',e.target.value)}/>
          <Input label="Firmware Version" placeholder="2.4.1" value={form.firmware_version} onChange={e=>set('firmware_version',e.target.value)}/>
        </div>
      </div>
    </Modal>
  )
}

// ─── Farm Card ───────────────────────────────────────────────────────────────
function FarmCard({ farm, isSelected, onClick }: { farm:Farm; isSelected:boolean; onClick:()=>void }) {
  const ft = FARM_TYPES.find(t=>t.value===farm.type)
  return (
    <div onClick={onClick} className={cn('p-4 rounded-xl cursor-pointer border-2 transition-all', isSelected?'border-[var(--accent)] bg-[var(--accent-soft)]':'bg-white border-[var(--border)] hover:border-[var(--border2)] hover:shadow-sm')}>
      <div className="flex items-start gap-3">
        <div style={{ width:36,height:36,borderRadius:10,background:ftBg[farm.type]||'var(--accent-soft)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>
          {ft?.icon||'🌿'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-semibold text-[var(--text)] truncate">{farm.name}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted mb-2">
            <MapPin className="w-2.5 h-2.5"/><span className="truncate">{farm.location}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge" style={{background:ftBg[farm.type]||'var(--accent-soft)',color:ftColor[farm.type]||'var(--accent)',border:`1px solid ${ftColor[farm.type]||'var(--accent)'}30`,fontSize:9,fontWeight:700}}>
              {ft?.label||farm.type}
            </span>
            {farm.area_sqm&&<span className="text-[10px] text-muted">{farm.area_sqm} m²</span>}
            <span className={cn('text-[10px] flex items-center gap-1 ml-auto', farm.is_active?'text-[var(--green)]':'text-muted')}>
              <span className={cn('dot',farm.is_active?'dot-green':'dot-gray')}/>
              {farm.is_active?'Active':'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Zone Card ───────────────────────────────────────────────────────────────
const ZS_COL: Record<string,string> = { active:'green', idle:'gray', maintenance:'amber', harvesting:'blue' }
function ZoneCard({ zone, farmType, onAddDevice }: { zone:Zone; farmType:string; onAddDevice:()=>void }) {
  const rackLabel = farmType==='nft'?'Gutters':farmType==='aeroponic'?'Towers':farmType==='dwc'?'Beds':'Racks'
  const levelLabel = farmType==='nft'?'Levels':farmType==='aeroponic'?'Positions':farmType==='dwc'?'Layers':'Tiers'
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-4 hover:border-[var(--border2)] hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
            style={{background:ftBg[farmType]||'var(--accent-soft)',color:ftColor[farmType]||'var(--accent)'}}>
            {zone.code}
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text)] leading-tight">{zone.name}</div>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant={ZS_COL[zone.status] as any}>{zone.status}</Badge>
            </div>
          </div>
        </div>
        <button onClick={e=>{e.stopPropagation();onAddDevice()}} className="btn-ghost btn-sm flex items-center gap-1 text-[10px]">
          <Cpu className="w-3 h-3"/>Add Device
        </button>
      </div>

      {/* Structure */}
      <div className="grid grid-cols-3 gap-2 mb-3 p-2 rounded-lg" style={{background:'var(--bg3)'}}>
        <div className="text-center">
          <div className="text-xs font-bold text-[var(--text)]">{zone.rack_count}</div>
          <div className="text-[9px] text-muted">{rackLabel}</div>
        </div>
        <div className="text-center border-x border-[var(--border)]">
          <div className="text-xs font-bold text-[var(--text)]">{zone.level_count}</div>
          <div className="text-[9px] text-muted">{levelLabel}</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-[var(--text)]">{zone.area_sqm}m²</div>
          <div className="text-[9px] text-muted">Floor Area</div>
        </div>
      </div>

      {/* Targets */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          ['🌡️',`${zone.target_temp}°C`,'Temp'],
          ['💧',`${zone.target_humidity}%`,'Humidity'],
          ['🌬️',`${zone.target_co2}ppm`,'CO₂'],
          ['⚗️',`pH ${zone.target_ph}`,'pH'],
          ['⚡',`${zone.target_ec} mS`,'EC'],
          ['☀️',`${zone.target_ppfd}µ`,'PPFD'],
        ].map(([icon,val,key]) => (
          <div key={key} className="flex items-center gap-1 p-1.5 rounded-lg" style={{background:'var(--bg3)'}}>
            <span className="text-[11px]">{icon}</span>
            <div>
              <div className="text-[10px] font-semibold text-[var(--text)] leading-tight">{val}</div>
              <div className="text-[9px] text-muted">{key}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function FarmsPage() {
  const qc = useQueryClient()
  const [selectedFarm, setSelectedFarm] = useState<Farm|null>(null)
  const [showCreateFarm, setShowCreateFarm] = useState(false)
  const [showCreateZone, setShowCreateZone] = useState(false)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [activeTab, setActiveTab] = useState<'zones'|'devices'|'overview'>('zones')
  const [deviceZoneFilter, setDeviceZoneFilter] = useState('')

  const { data: farms=[], isLoading: farmsLoading } = useQuery<Farm[]>({ queryKey:['farms'], queryFn:farmsApi.list })
  const { data: zones=[], isLoading: zonesLoading } = useQuery<Zone[]>({
    queryKey:['zones', selectedFarm?.id], queryFn:()=>zonesApi.list(selectedFarm!.id), enabled:!!selectedFarm?.id
  })
  const { data: devices=[] } = useQuery<Device[]>({
    queryKey:['devices', selectedFarm?.id], queryFn:()=>devicesApi.list(selectedFarm!.id), enabled:!!selectedFarm?.id
  })

  useEffect(() => { if (farms.length>0 && !selectedFarm) setSelectedFarm(farms[0]) }, [farms])

  const onlineDevices = (devices as Device[]).filter(d=>d.status==='online').length
  const filteredDevices = deviceZoneFilter
    ? (devices as Device[]).filter(d=>d.zone_id===deviceZoneFilter)
    : devices as Device[]
  const ft = FARM_TYPES.find(t=>t.value===selectedFarm?.type)

  return (
    <div style={{ height:'calc(100vh - 56px)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', background:'white', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>Farms & Zones</h1>
          <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{farms.length} farms · Each farm type has unique zone structure, sensor requirements, and irrigation patterns</p>
        </div>
        <Button variant="primary" onClick={()=>setShowCreateFarm(true)}><Plus className="w-3.5 h-3.5"/> New Farm</Button>
      </div>

      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        {/* Sidebar */}
        <div style={{ width:280, flexShrink:0, borderRight:'1px solid var(--border)', background:'white', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
            <input className="input text-xs" style={{ padding:'6px 10px' }} placeholder="Search farms..."/>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
            {farmsLoading ? Array(4).fill(0).map((_,i)=>(
              <div key={i} className="rounded-xl border border-[var(--border)] p-4 space-y-2">
                <div className="skeleton h-4 w-3/4 rounded"/><div className="skeleton h-3 w-1/2 rounded"/>
              </div>
            )) : farms.length===0 ? (
              <EmptyState icon={Building2} title="No farms yet" message="Create your first farm to get started"
                action={<Button variant="primary" onClick={()=>setShowCreateFarm(true)}><Plus className="w-3.5 h-3.5"/>Create Farm</Button>}/>
            ) : (farms as Farm[]).map(farm=>(
              <FarmCard key={farm.id} farm={farm} isSelected={selectedFarm?.id===farm.id} onClick={()=>{ setSelectedFarm(farm); setActiveTab('zones') }}/>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div style={{ flex:1, minWidth:0, overflowY:'auto', background:'var(--bg)' }}>
          {!selectedFarm ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
              <EmptyState icon={Building2} title="Select a farm" message="Choose a farm from the list to manage its zones and devices"/>
            </div>
          ) : (
            <div style={{ padding:24 }}>
              {/* Farm header */}
              <div className="bg-white rounded-2xl border border-[var(--border)] p-5 mb-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div style={{ width:52,height:52,borderRadius:14,background:ftBg[selectedFarm.type]||'var(--accent-soft)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26 }}>
                      {ft?.icon||'🌿'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>{selectedFarm.name}</h2>
                        <span className="badge" style={{background:ftBg[selectedFarm.type],color:ftColor[selectedFarm.type],border:`1px solid ${ftColor[selectedFarm.type]}30`,fontSize:10,fontWeight:700}}>{ft?.label||selectedFarm.type}</span>
                        <Badge variant={selectedFarm.is_active?'green':'gray'}>{selectedFarm.is_active?'Active':'Inactive'}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{selectedFarm.location}</span>
                        {selectedFarm.area_sqm&&<span>{selectedFarm.area_sqm} m² total</span>}
                        {selectedFarm.latitude&&<span>{selectedFarm.latitude.toFixed(4)}°N, {selectedFarm.longitude?.toFixed(4)}°E</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary"><Edit2 className="w-3.5 h-3.5"/> Edit</Button>
                    <Button variant="secondary" onClick={()=>qc.invalidateQueries()}><RefreshCw className="w-3.5 h-3.5"/></Button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-4">
                  <StatCard label="Zones" value={zones.length} icon={Layers} accent="blue" sub={`${(zones as Zone[]).reduce((a,z)=>a+z.rack_count,0)} ${selectedFarm.type==='nft'?'channels':selectedFarm.type==='aeroponic'?'towers':selectedFarm.type==='dwc'?'beds':'racks'}`}/>
                  <StatCard label="Devices" value={(devices as Device[]).length || 0} icon={Cpu} accent="purple" sub={`${onlineDevices} online`}/>
                  <StatCard label="Farm Area" value={selectedFarm.area_sqm?`${selectedFarm.area_sqm}m²`:'—'} icon={Building2} accent="green"/>
                  <StatCard label="Online Rate" value={(devices as Device[]).length?`${Math.round(onlineDevices/(devices as Device[]).length*100)}%`:'—'} icon={Activity} accent="amber"/>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="tab-bar px-5">
                  {(['zones','devices','overview'] as const).map(t=>(
                    <button key={t} onClick={()=>setActiveTab(t)} className={cn('tab-item capitalize',activeTab===t&&'active')}>
                      {t==='zones'?`Zones (${zones.length})`:t==='devices'?`Devices (${(devices as Device[]).length})`:'Overview'}
                    </button>
                  ))}
                </div>

                <div style={{ padding:20 }}>
                  {/* ── ZONES TAB ── */}
                  {activeTab==='zones' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs font-semibold text-[var(--text)]">{zones.length} zones · {ft?.label}</p>
                          <p className="text-[11px] text-muted mt-0.5">
                            {selectedFarm.type==='nft'?'NFT: horizontal channel gutters with 2-level incline':
                             selectedFarm.type==='aeroponic'?'Aeroponic: vertical tower columns with high-pressure mist':
                             selectedFarm.type==='dwc'?'DWC: large single-level raft bed pools':
                             'Multi-tier grow racks with individual lighting and nutrient lines'}
                          </p>
                        </div>
                        <Button variant="primary" onClick={()=>setShowCreateZone(true)}><Plus className="w-3.5 h-3.5"/> Add Zone</Button>
                      </div>

                      {zonesLoading ? (
                        <div className="grid grid-cols-2 gap-4">{Array(4).fill(0).map((_,i)=><div key={i} className="skeleton h-48 rounded-xl"/>)}</div>
                      ) : zones.length===0 ? (
                        <EmptyState icon={Layers} title="No zones yet" message={`Add your first ${ft?.label||''} zone. Defaults will be pre-filled for this farm type.`}
                          action={<Button variant="primary" onClick={()=>setShowCreateZone(true)}><Plus className="w-3.5 h-3.5"/>Add First Zone</Button>}/>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {(zones as Zone[]).map(z=>(
                            <ZoneCard key={z.id} zone={z} farmType={selectedFarm.type} onAddDevice={()=>setShowAddDevice(true)}/>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── DEVICES TAB ── */}
                  {activeTab==='devices' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-muted">{(devices as Device[]).length} registered · {onlineDevices} online</p>
                          {zones.length>0&&(
                            <select className="input text-xs py-1" style={{width:'auto',padding:'4px 28px 4px 8px'}} value={deviceZoneFilter} onChange={e=>setDeviceZoneFilter(e.target.value)}>
                              <option value="">All zones</option>
                              {(zones as Zone[]).map(z=><option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
                            </select>
                          )}
                        </div>
                        <Button variant="primary" onClick={()=>setShowAddDevice(true)}><Plus className="w-3.5 h-3.5"/> Register Device</Button>
                      </div>
                      {filteredDevices.length===0 ? (
                        <EmptyState icon={Cpu} title="No devices" message={`Register sensors and controllers for your ${ft?.label||''} farm.`}
                          action={<Button variant="primary" onClick={()=>setShowAddDevice(true)}><Plus className="w-3.5 h-3.5"/>Register Device</Button>}/>
                      ) : (
                        <div className="table-wrapper rounded-xl overflow-hidden border border-[var(--border)]">
                          <table>
                            <thead><tr><th>Device</th><th>Type</th><th>Zone</th><th>Protocol</th><th>Status</th><th>Firmware</th><th>Actions</th></tr></thead>
                            <tbody>
                              {filteredDevices.map((d:Device)=>(
                                <tr key={d.id}>
                                  <td><div className="font-medium">{d.name}</div><div className="text-[10px] text-muted font-mono">{d.device_uid}</div></td>
                                  <td><Badge variant="gray">{d.device_type.replace(/_/g,' ')}</Badge></td>
                                  <td className="text-xs text-muted">{(zones as Zone[]).find(z=>z.id===d.zone_id)?.code||'Farm'}</td>
                                  <td><span className="badge badge-gray uppercase text-[9px]">{d.protocol}</span></td>
                                  <td><Badge variant={d.status==='online'?'green':d.status==='error'?'red':'gray'}>{d.status}</Badge></td>
                                  <td><span className="text-xs text-muted font-mono">{d.firmware_version||'—'}</span></td>
                                  <td><div className="flex gap-1"><button className="btn-ghost btn-sm p-1"><Eye className="w-3.5 h-3.5"/></button><button className="btn-ghost btn-sm p-1"><Settings className="w-3.5 h-3.5"/></button></div></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── OVERVIEW TAB ── */}
                  {activeTab==='overview' && (
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <p className="text-xs font-semibold text-[var(--text)] mb-3">Zone Summary</p>
                        <div className="space-y-2">
                          {(zones as Zone[]).map(z=>(
                            <div key={z.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                              <div className="flex items-center gap-2">
                                <span className="badge" style={{background:ftBg[selectedFarm.type],color:ftColor[selectedFarm.type],border:`1px solid ${ftColor[selectedFarm.type]}30`,fontSize:9}}>{z.code}</span>
                                <span className="text-xs text-[var(--text)] truncate max-w-[160px]">{z.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted">{z.rack_count}×{z.level_count}</span>
                                <Badge variant={ZS_COL[z.status] as any}>{z.status}</Badge>
                              </div>
                            </div>
                          ))}
                          {zones.length===0&&<p className="text-xs text-muted">No zones yet</p>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--text)] mb-3">Farm Profile</p>
                        <div className="space-y-2">
                          {[
                            ['Growing Method', ft?.label||selectedFarm.type],
                            ['Location', selectedFarm.location||'—'],
                            ['Total Area', selectedFarm.area_sqm?`${selectedFarm.area_sqm} m²`:'—'],
                            ['Zones', `${zones.length} configured`],
                            ['Devices', `${(devices as Device[]).length} registered (${onlineDevices} online)`],
                            ['GPS', selectedFarm.latitude?`${selectedFarm.latitude?.toFixed(4)}°N, ${selectedFarm.longitude?.toFixed(4)}°E`:'Not set'],
                          ].map(([k,v])=>(
                            <div key={k} className="flex justify-between text-xs p-2 rounded-lg" style={{background:'var(--bg3)'}}>
                              <span className="text-muted">{k}</span><span className="text-[var(--text)] font-medium">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateFarmModal open={showCreateFarm} onClose={()=>setShowCreateFarm(false)} onCreated={f=>setSelectedFarm(f)}/>
      {selectedFarm&&<>
        <CreateZoneModal open={showCreateZone} onClose={()=>setShowCreateZone(false)} farm={selectedFarm}/>
        <AddDeviceModal open={showAddDevice} onClose={()=>setShowAddDevice(false)}
          farmId={selectedFarm.id} farmType={selectedFarm.type}
          zones={zones as Zone[]} farmName={selectedFarm.name}/>
      </>}
    </div>
  )
}
