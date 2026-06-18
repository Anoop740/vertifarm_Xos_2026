import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cropsApi, recipesApi, farmsApi, zonesApi } from '@/lib/api'
import { Button, Badge, Modal, Input, Select, StatCard, EmptyState, ProgressBar } from '@/components/ui'
import {
  Leaf, Plus, FlaskConical, ChevronRight, CheckCircle, Zap,
  Clock, BarChart3, Thermometer, Droplets, Wind, Activity,
  RefreshCw, Info, Sparkles, ChevronDown, ChevronUp, Edit2
} from 'lucide-react'
import { cn, relativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ──────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string,any> = {
  seeding:'gray', germination:'blue', vegetative:'green',
  flowering:'amber', fruiting:'amber', ready:'green', harvested:'gray'
}
const STATUS_PCT: Record<string,number> = {
  seeding:5, germination:20, vegetative:55, flowering:70, fruiting:85, ready:100, harvested:100
}

// ─── Recipe library per farm type ────────────────────────────────────────────
// Each farm type gets tailored grow parameters, cycle length, and phase structure
const RECIPE_LIBRARY: Record<string, any[]> = {
  hydroponic: [
    { name:'Butterhead Lettuce — Hydroponic DWC', crop_type:'Lettuce', variety:'Butterhead', grow_days:35, expected_yield_kg:2.5,
      notes:'Standard DWC raft lettuce. Fast turnover, dense plantings 25–30 plants/m².',
      phases:[
        {name:'Germination',days:5,temp:22,humidity:72,co2:800,ph:5.8,ec:0.8,ppfd:80},
        {name:'Seedling / Plug',days:7,temp:22,humidity:70,co2:900,ph:6.0,ec:1.2,ppfd:160},
        {name:'Vegetative Grow',days:23,temp:22,humidity:65,co2:1100,ph:6.2,ec:1.8,ppfd:280},
      ]},
    { name:'Cherry Tomato — Hydro Vine', crop_type:'Tomato', variety:'Cherry Plum F1', grow_days:75, expected_yield_kg:9.5,
      notes:'High-wire tomato production. Requires trellising, pollination support, and Ca/Mg top-up.',
      phases:[
        {name:'Germination',days:7,temp:26,humidity:72,co2:800,ph:5.8,ec:1.0,ppfd:120},
        {name:'Seedling',days:14,temp:25,humidity:68,co2:1000,ph:5.9,ec:2.0,ppfd:250},
        {name:'Vegetative',days:21,temp:25,humidity:65,co2:1200,ph:5.9,ec:2.8,ppfd:380},
        {name:'Flowering',days:14,temp:23,humidity:60,co2:1400,ph:6.0,ec:3.2,ppfd:480},
        {name:'Fruiting',days:19,temp:22,humidity:58,co2:1200,ph:6.2,ec:3.6,ppfd:520},
      ]},
    { name:'Microgreens — Sunflower & Pea', crop_type:'Microgreens', variety:'Sunflower + Pea Shoot', grow_days:10, expected_yield_kg:0.8,
      notes:'Ultra-fast 10-day cycle. Dense sowing 150–200g/tray on coco coir. No nutrient solution in blackout phase.',
      phases:[
        {name:'Soak & Blackout',days:3,temp:22,humidity:82,co2:800,ph:6.0,ec:0.5,ppfd:0},
        {name:'Light / Grow Phase',days:7,temp:21,humidity:70,co2:900,ph:6.0,ec:1.0,ppfd:150},
      ]},
    { name:'Kale — Hydroponic Curly', crop_type:'Kale', variety:'Curly Vates', grow_days:42, expected_yield_kg:2.8,
      notes:'Cool-season crop. Lower temp improves flavour. Allow slight EC stress at harvest for anthocyanin development.',
      phases:[
        {name:'Germination',days:5,temp:18,humidity:74,co2:800,ph:5.9,ec:0.7,ppfd:80},
        {name:'Seedling',days:10,temp:17,humidity:70,co2:900,ph:6.0,ec:1.5,ppfd:180},
        {name:'Vegetative',days:20,temp:17,humidity:70,co2:950,ph:6.2,ec:2.5,ppfd:260},
        {name:'Harvest Hardening',days:7,temp:14,humidity:68,co2:900,ph:6.3,ec:3.0,ppfd:280},
      ]},
  ],
  nft: [
    { name:'NFT Lettuce — Oakleaf High Density', crop_type:'Lettuce', variety:'Oakleaf', grow_days:30, expected_yield_kg:2.1,
      notes:'Optimised for NFT gutter channels. 5 cm spacing for baby leaf, 20 cm for full head. Monitor drain EC closely.',
      phases:[
        {name:'Germination',days:4,temp:22,humidity:72,co2:800,ph:5.9,ec:0.7,ppfd:80},
        {name:'Seedling',days:6,temp:21,humidity:68,co2:950,ph:6.0,ec:1.3,ppfd:180},
        {name:'Vegetative',days:20,temp:21,humidity:63,co2:1050,ph:6.0,ec:1.6,ppfd:270},
      ]},
    { name:'Watercress — NFT Flow', crop_type:'Watercress', variety:'Green Watercress', grow_days:21, expected_yield_kg:1.4,
      notes:'Very high water/O₂ requirement. NFT ideal. Prefers cool humid conditions, high flow rate 2+ L/min/channel.',
      phases:[
        {name:'Germination',days:4,temp:16,humidity:82,co2:800,ph:5.8,ec:0.6,ppfd:60},
        {name:'Grow',days:17,temp:15,humidity:78,co2:900,ph:5.8,ec:1.6,ppfd:200},
      ]},
    { name:'NFT Spinach — Baby Leaf', crop_type:'Spinach', variety:'Baby Leaf Samish', grow_days:28, expected_yield_kg:1.9,
      notes:'NFT baby spinach: shorter grow days vs DWC. Avoid tip-burn: keep EC lower and airflow high.',
      phases:[
        {name:'Germination',days:4,temp:17,humidity:76,co2:800,ph:6.0,ec:0.8,ppfd:80},
        {name:'Seedling',days:7,temp:16,humidity:72,co2:900,ph:6.1,ec:1.4,ppfd:160},
        {name:'Vegetative',days:17,temp:16,humidity:68,co2:950,ph:6.2,ec:2.0,ppfd:220},
      ]},
    { name:'NFT Mint — Spearmint Fresh', crop_type:'Mint', variety:'Spearmint', grow_days:35, expected_yield_kg:1.6,
      notes:'Perennial herb in NFT. Harvest at 15–20cm height. Keep root zone cool. High essential oil at 26°C canopy.',
      phases:[
        {name:'Root Establishment',days:10,temp:22,humidity:68,co2:900,ph:6.0,ec:1.2,ppfd:200},
        {name:'Active Growth',days:15,temp:24,humidity:66,co2:1100,ph:6.0,ec:2.0,ppfd:280},
        {name:'Harvest Trigger',days:10,temp:26,humidity:62,co2:1100,ph:6.1,ec:2.2,ppfd:300},
      ]},
  ],
  aeroponic: [
    { name:'Aeroponic Strawberry — Albion', crop_type:'Strawberry', variety:'Albion Everbearing', grow_days:90, expected_yield_kg:3.5,
      notes:'Aeroponics delivers superior O₂ to roots, boosting Brix. 15-sec mist on / 4-min off cycle. Day temp 18°C for fruit set.',
      phases:[
        {name:'Crown Establishment',days:14,temp:18,humidity:68,co2:900,ph:5.8,ec:1.2,ppfd:180},
        {name:'Runner Removal Phase',days:21,temp:17,humidity:65,co2:1000,ph:5.8,ec:1.6,ppfd:260},
        {name:'Flowering',days:21,temp:18,humidity:62,co2:1100,ph:5.9,ec:1.8,ppfd:360},
        {name:'Fruiting',days:34,temp:17,humidity:60,co2:1000,ph:6.0,ec:2.0,ppfd:420},
      ]},
    { name:'Aeroponic Herbs — Tower Blend', crop_type:'Herbs Mix', variety:'Basil-Mint-Thyme', grow_days:32, expected_yield_kg:1.5,
      notes:'Mixed herb tower for aeroponics. Mist cycle: 15s on / 4min off. pH 5.8–6.0 critical for multi-herb.',
      phases:[
        {name:'Germination',days:5,temp:24,humidity:78,co2:900,ph:5.8,ec:0.5,ppfd:100},
        {name:'Establishment',days:10,temp:23,humidity:72,co2:1100,ph:5.9,ec:1.5,ppfd:250},
        {name:'Harvest Cycle',days:17,temp:24,humidity:68,co2:1200,ph:6.0,ec:2.2,ppfd:320},
      ]},
    { name:'Aeroponic Lettuce — Speed Grow', crop_type:'Lettuce', variety:'Little Gem', grow_days:22, expected_yield_kg:1.8,
      notes:'Fastest lettuce cycle possible with aeroponics. Root O₂ supersaturation cuts grow time by 35% vs DWC.',
      phases:[
        {name:'Germination',days:3,temp:23,humidity:78,co2:900,ph:5.7,ec:0.6,ppfd:80},
        {name:'Active Grow',days:19,temp:22,humidity:70,co2:1200,ph:5.8,ec:1.8,ppfd:340},
      ]},
    { name:'Aeroponic Kale — Lacinato', crop_type:'Kale', variety:'Lacinato / Dinosaur', grow_days:48, expected_yield_kg:3.2,
      notes:'Aeroponics reduces kale grow cycle by 20%. Lower mist frequency at harvest to concentrate nutrients.',
      phases:[
        {name:'Germination',days:5,temp:18,humidity:76,co2:800,ph:5.8,ec:0.7,ppfd:80},
        {name:'Seedling',days:10,temp:17,humidity:72,co2:950,ph:6.0,ec:1.6,ppfd:200},
        {name:'Vegetative',days:23,temp:17,humidity:70,co2:1000,ph:6.1,ec:2.5,ppfd:280},
        {name:'Hardening',days:10,temp:15,humidity:68,co2:900,ph:6.2,ec:3.0,ppfd:290},
      ]},
  ],
  dwc: [
    { name:'DWC Kale — Curly Vates', crop_type:'Kale', variety:'Curly Vates', grow_days:50, expected_yield_kg:3.2,
      notes:'DWC raft system. Kale tolerates lower EC. Cooler temps improve flavour. Dissolved O₂ >8 mg/L critical.',
      phases:[
        {name:'Germination',days:5,temp:18,humidity:72,co2:800,ph:5.9,ec:0.7,ppfd:80},
        {name:'Seedling',days:10,temp:17,humidity:70,co2:900,ph:6.0,ec:1.5,ppfd:180},
        {name:'Vegetative',days:25,temp:17,humidity:70,co2:950,ph:6.2,ec:2.5,ppfd:260},
        {name:'Harvest Hardening',days:10,temp:15,humidity:68,co2:900,ph:6.3,ec:2.8,ppfd:280},
      ]},
    { name:'DWC Swiss Chard — Rainbow Mix', crop_type:'Swiss Chard', variety:'Rainbow Mix', grow_days:40, expected_yield_kg:2.4,
      notes:'DWC raft ideal for chard — large root mass benefits from constant O₂. Harvest outer leaves progressively.',
      phases:[
        {name:'Germination',days:6,temp:20,humidity:74,co2:800,ph:6.0,ec:0.8,ppfd:100},
        {name:'Seedling',days:10,temp:19,humidity:70,co2:950,ph:6.1,ec:1.6,ppfd:200},
        {name:'Vegetative',days:24,temp:20,humidity:67,co2:1000,ph:6.2,ec:2.2,ppfd:240},
      ]},
    { name:'DWC Basil — Genovese Premium', crop_type:'Basil', variety:'Sweet Genovese', grow_days:30, expected_yield_kg:2.0,
      notes:'DWC basil with warm root zone. Avoid temperature fluctuation. Harvest at 6th node for maximum yield.',
      phases:[
        {name:'Germination',days:4,temp:25,humidity:78,co2:800,ph:5.8,ec:0.6,ppfd:80},
        {name:'Establishment',days:8,temp:25,humidity:72,co2:1000,ph:6.0,ec:1.4,ppfd:220},
        {name:'Harvest Growth',days:18,temp:26,humidity:68,co2:1200,ph:6.2,ec:2.2,ppfd:320},
      ]},
    { name:'DWC Research — Phenotype Trial', crop_type:'Trial Crop', variety:'Multi-Variety', grow_days:45, expected_yield_kg:1.5,
      notes:'Research trial parameters. Baseline neutral settings. Modify EC/pH per sub-trial block.',
      phases:[
        {name:'Baseline Phase',days:14,temp:20,humidity:68,co2:1000,ph:6.0,ec:1.5,ppfd:250},
        {name:'Treatment Phase',days:21,temp:20,humidity:66,co2:1000,ph:6.1,ec:2.0,ppfd:280},
        {name:'Data Collection',days:10,temp:19,humidity:65,co2:950,ph:6.0,ec:1.8,ppfd:260},
      ]},
  ],
}

// Fallback for other types
const DEFAULT_RECIPES = RECIPE_LIBRARY.hydroponic

const ALL_CROP_TYPES = ['Lettuce','Spinach','Basil','Kale','Arugula','Swiss Chard','Mint','Cilantro',
  'Strawberry','Cherry Tomato','Bell Pepper','Cucumber','Microgreens','Watercress','Herbs Mix','Trial Crop']

// ─── Demo crop batches per farm type ──────────────────────────────────────────
function getDemoCrops(farmType: string) {
  const now = Date.now()
  const d = (days: number) => new Date(now - days * 86400000).toISOString()
  const h = (days: number) => new Date(now + days * 86400000).toISOString()

  const bases: Record<string, any[]> = {
    hydroponic: [
      { id:'hc1', batch_code:'DHF-2026-001', name:'Butterhead Lettuce', status:'vegetative', planted_at:d(18), expected_harvest:h(12), farm_code:'DHF', zone_code:'A1' },
      { id:'hc2', batch_code:'DHF-2026-002', name:'Cherry Tomato', status:'fruiting', planted_at:d(55), expected_harvest:h(3), farm_code:'DHF', zone_code:'D1' },
      { id:'hc3', batch_code:'DHF-2026-003', name:'Microgreens Mix', status:'ready', planted_at:d(9), expected_harvest:h(0), actual_yield_kg:95, quality_score:98, farm_code:'DHF', zone_code:'D2' },
      { id:'hc4', batch_code:'DHF-2026-004', name:'Baby Spinach', status:'germination', planted_at:d(4), expected_harvest:h(20), farm_code:'DHF', zone_code:'B1' },
      { id:'hc5', batch_code:'DHF-2026-005', name:'Kale Curly', status:'vegetative', planted_at:d(22), expected_harvest:h(15), farm_code:'DHF', zone_code:'B3' },
      { id:'hc6', batch_code:'DHF-2026-006', name:'Sweet Basil', status:'ready', planted_at:d(27), expected_harvest:h(0), actual_yield_kg:180, quality_score:96, farm_code:'DHF', zone_code:'C2' },
    ],
    nft: [
      { id:'nc1', batch_code:'MUF-2026-001', name:'Oakleaf Lettuce', status:'vegetative', planted_at:d(15), expected_harvest:h(10), farm_code:'MUF', zone_code:'N1' },
      { id:'nc2', batch_code:'MUF-2026-002', name:'Spearmint', status:'harvest', planted_at:d(30), expected_harvest:h(2), farm_code:'MUF', zone_code:'N4' },
      { id:'nc3', batch_code:'MUF-2026-003', name:'Watercress', status:'ready', planted_at:d(20), expected_harvest:h(0), actual_yield_kg:140, quality_score:94, farm_code:'MUF', zone_code:'N7' },
      { id:'nc4', batch_code:'MUF-2026-004', name:'Baby Spinach NFT', status:'germination', planted_at:d(3), expected_harvest:h(24), farm_code:'MUF', zone_code:'N2' },
    ],
    aeroponic: [
      { id:'ac1', batch_code:'PNF-2026-001', name:'Albion Strawberry', status:'flowering', planted_at:d(42), expected_harvest:h(35), farm_code:'PNF', zone_code:'T3' },
      { id:'ac2', batch_code:'PNF-2026-002', name:'Herb Tower Blend', status:'ready', planted_at:d(31), expected_harvest:h(0), actual_yield_kg:150, quality_score:97, farm_code:'PNF', zone_code:'T2' },
      { id:'ac3', batch_code:'PNF-2026-003', name:'Little Gem Lettuce', status:'vegetative', planted_at:d(12), expected_harvest:h(8), farm_code:'PNF', zone_code:'T1' },
    ],
    dwc: [
      { id:'dc1', batch_code:'BLR-2026-001', name:'Curly Kale', status:'vegetative', planted_at:d(28), expected_harvest:h(18), farm_code:'BLR', zone_code:'R1' },
      { id:'dc2', batch_code:'BLR-2026-002', name:'Rainbow Swiss Chard', status:'ready', planted_at:d(39), expected_harvest:h(0), actual_yield_kg:240, quality_score:95, farm_code:'BLR', zone_code:'R2' },
      { id:'dc3', batch_code:'BLR-2026-003', name:'Phenotype Trial A', status:'germination', planted_at:d(5), expected_harvest:h(40), farm_code:'BLR', zone_code:'R5' },
    ],
  }
  return bases[farmType] || bases.hydroponic
}

// ─── New Batch Modal ──────────────────────────────────────────────────────────
function CreateBatchModal({ open, onClose, farmType }: { open:boolean; onClose:()=>void; farmType:string }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ batch_code:'', name:'', farm_id:'', zone_id:'', recipe_id:'', planted_at:new Date().toISOString().slice(0,10) })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const { data: farms=[] } = useQuery({ queryKey:['farms'], queryFn:farmsApi.list })
  const { data: zones=[] } = useQuery({ queryKey:['zones', form.farm_id], queryFn:()=>zonesApi.list(form.farm_id), enabled:!!form.farm_id })
  const { data: apiRecipes=[] } = useQuery({ queryKey:['recipes'], queryFn:recipesApi.list })
  const set = (k:string,v:string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>{const n={...e};delete n[k];return n}) }

  // Merge api recipes with local library, preferring api
  const recipeOptions = useMemo(() => {
    const lib = RECIPE_LIBRARY[farmType] || DEFAULT_RECIPES
    const apiList = apiRecipes as any[]
    if (apiList.length) return apiList.map((r:any)=>({value:r.id,label:`${r.name} (${r.grow_days}d)`}))
    return lib.map((r,i)=>({value:`local-${i}`,label:`${r.name} (${r.grow_days}d)`}))
  }, [apiRecipes, farmType])

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.batch_code.trim()) e.batch_code = 'Batch code required'
    if (!form.name.trim()) e.name = 'Crop name required'
    if (!form.farm_id) e.farm_id = 'Select a farm'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await cropsApi.create({ ...form, recipe_id: form.recipe_id?.startsWith('local-') ? undefined : form.recipe_id, planted_at: form.planted_at ? new Date(form.planted_at + 'T06:00:00.000Z').toISOString() : null })
      qc.invalidateQueries({ queryKey:['crops'] })
      toast.success(`Batch "${form.name}" started`)
      onClose()
      setForm({ batch_code:'', name:'', farm_id:'', zone_id:'', recipe_id:'', planted_at:new Date().toISOString().slice(0,10) })
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to create batch') }
    finally { setLoading(false) }
  }

  // Auto-generate batch code
  const autoCode = () => {
    const now = new Date()
    const prefix = (farms as any[]).find((f:any)=>f.id===form.farm_id)?.code || 'VF'
    const code = `${prefix}-${now.getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`
    set('batch_code', code)
  }

  return (
    <Modal open={open} onClose={onClose} title="Start New Crop Batch" size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleSubmit} loading={loading}>Start Batch</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Batch Code *</label>
              <button type="button" onClick={autoCode} className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5"/>Auto-generate</button>
            </div>
            <Input placeholder="e.g. DHF-2026-007" value={form.batch_code} onChange={e=>set('batch_code',e.target.value)} error={errors.batch_code}/>
          </div>
          <Input label="Crop Name *" placeholder="e.g. Butterhead Lettuce" value={form.name} onChange={e=>set('name',e.target.value)} error={errors.name}/>
        </div>
        <Select label="Farm *" options={[(farms as any[]).length?{value:'',label:'Select farm...'}:{value:'',label:'Loading...'},...(farms as any[]).map((f:any)=>({value:f.id,label:`${f.name} (${f.type})`}))]} value={form.farm_id} onChange={e=>set('farm_id',e.target.value)} error={errors.farm_id}/>
        {form.farm_id&&(
          <Select label="Zone" options={[{value:'',label:'— No zone —'},...(zones as any[]).map((z:any)=>({value:z.id,label:`${z.code} — ${z.name}`}))]} value={form.zone_id} onChange={e=>set('zone_id',e.target.value)}/>
        )}
        <Select label="Crop Recipe" options={[{value:'',label:'— No recipe (custom) —'},...recipeOptions]} value={form.recipe_id} onChange={e=>set('recipe_id',e.target.value)}/>
        <Input label="Planting Date" type="date" value={form.planted_at} onChange={e=>set('planted_at',e.target.value)}/>
      </div>
    </Modal>
  )
}

// ─── New Recipe Modal ─────────────────────────────────────────────────────────
function CreateRecipeModal({ open, onClose, farmType, preloadTemplate }: {
  open:boolean; onClose:()=>void; farmType:string; preloadTemplate?:any
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: preloadTemplate?.name||'',
    crop_type: preloadTemplate?.crop_type||'',
    variety: preloadTemplate?.variety||'',
    grow_days: String(preloadTemplate?.grow_days||''),
    expected_yield_kg: String(preloadTemplate?.expected_yield_kg||''),
    notes: preloadTemplate?.notes||'',
  })
  const [phases, setPhases] = useState<any[]>(preloadTemplate?.phases||[])
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [expandedPhase, setExpandedPhase] = useState<number|null>(0)
  const set = (k:string,v:string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>{const n={...e};delete n[k];return n}) }

  const addPhase = () => {
    const prev = phases[phases.length-1]
    setPhases([...phases, {
      name:`Phase ${phases.length+1}`,
      days: 7,
      temp: prev?.temp||22, humidity: prev?.humidity||65,
      co2: prev?.co2||1000, ph: prev?.ph||6.0, ec: prev?.ec||1.8, ppfd: prev?.ppfd||250
    }])
    setExpandedPhase(phases.length)
  }
  const removePhase = (i:number) => setPhases(phases.filter((_,idx)=>idx!==i))
  const setPhase = (i:number, k:string, v:any) => setPhases(phases.map((p,idx)=>idx===i?{...p,[k]:v}:p))

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.name.trim()) e.name = 'Recipe name required'
    if (!form.crop_type.trim()) e.crop_type = 'Crop type required'
    if (!form.grow_days) e.grow_days = 'Grow days required'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await recipesApi.create({
        ...form,
        grow_days: parseInt(form.grow_days),
        expected_yield_kg: form.expected_yield_kg ? parseFloat(form.expected_yield_kg) : undefined,
        phases: phases.map(p=>({...p, days:parseInt(p.days)||7, temp:parseFloat(p.temp)||22, humidity:parseFloat(p.humidity)||65, co2:parseInt(p.co2)||1000, ph:parseFloat(p.ph)||6.0, ec:parseFloat(p.ec)||1.8, ppfd:parseInt(p.ppfd)||250}))
      })
      qc.invalidateQueries({ queryKey:['recipes'] })
      toast.success(`Recipe "${form.name}" saved`)
      onClose()
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to save recipe') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Crop Recipe" size="xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={handleSubmit} loading={loading}>Save Recipe</Button></>}>
      <div className="space-y-5">
        {/* Basic info */}
        <div>
          <p className="text-xs font-semibold text-[var(--text)] mb-3">Recipe Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Input label="Recipe Name *" placeholder="e.g. NFT Lettuce — High Density" value={form.name} onChange={e=>set('name',e.target.value)} error={errors.name}/></div>
            <Select label="Crop Type *" options={ALL_CROP_TYPES.map(t=>({value:t,label:t}))} value={form.crop_type} onChange={e=>set('crop_type',e.target.value)} error={errors.crop_type}/>
            <Input label="Variety" placeholder="e.g. Oakleaf, Butterhead..." value={form.variety} onChange={e=>set('variety',e.target.value)}/>
            <Input label="Total Grow Days *" type="number" placeholder="30" value={form.grow_days} onChange={e=>set('grow_days',e.target.value)} error={errors.grow_days}/>
            <Input label="Expected Yield (kg/m²)" type="number" step="0.1" placeholder="2.5" value={form.expected_yield_kg} onChange={e=>set('expected_yield_kg',e.target.value)}/>
            <div className="col-span-2">
              <label className="label">Growing Notes</label>
              <textarea className="input" rows={2} placeholder="Special instructions, nutrient tips, harvest criteria..." value={form.notes} onChange={e=>set('notes',e.target.value)}/>
            </div>
          </div>
        </div>

        {/* Phases */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[var(--text)]">Growth Phases ({phases.length})</p>
            <Button variant="secondary" onClick={addPhase}><Plus className="w-3 h-3"/> Add Phase</Button>
          </div>
          {phases.length===0&&<div className="text-xs text-muted p-4 text-center rounded-xl border-2 border-dashed border-[var(--border)]">No phases yet — add at least one growth phase</div>}
          <div className="space-y-2">
            {phases.map((phase,i)=>(
              <div key={i} className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer" style={{background:'var(--bg3)'}} onClick={()=>setExpandedPhase(expandedPhase===i?null:i)}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-soft)]">{i+1}</span>
                    <span className="text-xs font-semibold text-[var(--text)]">{phase.name || `Phase ${i+1}`}</span>
                    <span className="badge badge-gray">{phase.days}d</span>
                    <span className="text-[10px] text-muted">{phase.temp}°C · pH {phase.ph} · EC {phase.ec}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="btn-ghost btn-sm text-[10px] text-red-400 hover:text-red-600 px-1" onClick={e=>{e.stopPropagation();removePhase(i)}}>Remove</button>
                    {expandedPhase===i?<ChevronUp className="w-3.5 h-3.5 text-muted"/>:<ChevronDown className="w-3.5 h-3.5 text-muted"/>}
                  </div>
                </div>
                {expandedPhase===i&&(
                  <div className="p-4 grid grid-cols-4 gap-3">
                    <div><Input label="Phase Name" value={phase.name} onChange={e=>setPhase(i,'name',e.target.value)}/></div>
                    <div><Input label="Days" type="number" min="1" value={phase.days} onChange={e=>setPhase(i,'days',e.target.value)}/></div>
                    <div><Input label="Temp (°C)" type="number" step="0.5" value={phase.temp} onChange={e=>setPhase(i,'temp',e.target.value)}/></div>
                    <div><Input label="Humidity (%)" type="number" step="1" value={phase.humidity} onChange={e=>setPhase(i,'humidity',e.target.value)}/></div>
                    <div><Input label="CO₂ (ppm)" type="number" step="50" value={phase.co2} onChange={e=>setPhase(i,'co2',e.target.value)}/></div>
                    <div><Input label="pH" type="number" step="0.1" value={phase.ph} onChange={e=>setPhase(i,'ph',e.target.value)}/></div>
                    <div><Input label="EC (mS/cm)" type="number" step="0.1" value={phase.ec} onChange={e=>setPhase(i,'ec',e.target.value)}/></div>
                    <div><Input label="PPFD (µmol)" type="number" step="10" value={phase.ppfd} onChange={e=>setPhase(i,'ppfd',e.target.value)}/></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Recipe Detail Panel ──────────────────────────────────────────────────────
function RecipeDetail({ recipe, farmType, onUse, onEdit }: { recipe:any; farmType:string; onUse:()=>void; onEdit:()=>void }) {
  const ftColors: Record<string,string> = {
    hydroponic:'#3b82f6', nft:'#06b6d4', aeroponic:'#8b5cf6', dwc:'#0ea5e9', default:'#0d9488'
  }
  const col = ftColors[farmType] || ftColors.default

  return (
    <div className="card p-5 space-y-5 animate-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--text)]">{recipe.name}</h2>
          <p className="text-xs text-muted mt-0.5">{recipe.crop_type} · {recipe.variety} · {recipe.grow_days} days total</p>
          {recipe.notes&&<p className="text-xs text-muted mt-2 leading-relaxed max-w-md">{recipe.notes}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onEdit}><Edit2 className="w-3.5 h-3.5"/> Edit</Button>
          <Button variant="primary" onClick={onUse}><Leaf className="w-3.5 h-3.5"/> Use Recipe</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl text-center" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
          <div className="text-xl font-bold" style={{color:col}}>{recipe.expected_yield_kg}</div>
          <div className="text-[10px] text-muted mt-0.5">kg / m² yield</div>
        </div>
        <div className="p-3 rounded-xl text-center" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
          <div className="text-xl font-bold text-[var(--text)]">{recipe.grow_days}</div>
          <div className="text-[10px] text-muted mt-0.5">day cycle</div>
        </div>
        <div className="p-3 rounded-xl text-center" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
          <div className="text-xl font-bold text-[var(--text)]">{recipe.phases?.length||0}</div>
          <div className="text-[10px] text-muted mt-0.5">growth phases</div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-[var(--text)] mb-3">Growth Phases</p>
        <div className="space-y-2">
          {(recipe.phases||[]).map((phase:any, i:number) => (
            <div key={i} className="rounded-xl overflow-hidden border border-[var(--border)]">
              <div className="flex items-center gap-3 px-4 py-2.5" style={{background:'var(--bg3)'}}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{background:`${col}20`,color:col}}>{i+1}</div>
                <span className="text-xs font-semibold text-[var(--text)] flex-1">{phase.name}</span>
                <Badge variant="gray">{phase.days} days</Badge>
              </div>
              <div className="grid grid-cols-6 gap-0 divide-x divide-[var(--border)]">
                {[['🌡️','Temp',`${phase.temp}°C`],['💧','RH',`${phase.humidity}%`],['🌬️','CO₂',`${phase.co2}`],['⚗️','pH',`${phase.ph}`],['⚡','EC',`${phase.ec}mS`],['☀️','PPFD',`${phase.ppfd}µ`]].map(([ico,k,v])=>(
                  <div key={k} className="text-center py-2">
                    <div className="text-[10px]">{ico}</div>
                    <div className="text-[10px] text-muted">{k}</div>
                    <div className="text-xs font-semibold text-[var(--text)]">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CropsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'batches'|'recipes'>('batches')
  const [showBatch, setShowBatch] = useState(false)
  const [showRecipe, setShowRecipe] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)
  const [editTemplate, setEditTemplate] = useState<any>(null)
  const [selectedFarmType, setSelectedFarmType] = useState<string>('all')
  const [recipeFilter, setRecipeFilter] = useState<string>('all')

  const { data: apiCrops=[] } = useQuery({ queryKey:['crops'], queryFn:()=>cropsApi.list() })
  const { data: apiRecipes=[] } = useQuery({ queryKey:['recipes'], queryFn:recipesApi.list })
  const { data: farms=[] } = useQuery({ queryKey:['farms'], queryFn:farmsApi.list })

  const updateCrop = useMutation({
    mutationFn: ({ id, data }: { id:string; data:any }) => cropsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['crops'] }); toast.success('Batch updated') },
    onError: (err:any) => toast.error(err?.response?.data?.detail || 'Update failed'),
  })

  // Build unified crop list from API + demo fallback
  const allCrops = useMemo(() => {
    if ((apiCrops as any[]).length) return apiCrops as any[]
    // Demo crops covering all farm types
    return [
      ...getDemoCrops('hydroponic'),
      ...getDemoCrops('nft'),
      ...getDemoCrops('aeroponic'),
      ...getDemoCrops('dwc'),
    ]
  }, [apiCrops])

  // Build recipe list: API first, fall back to local library
  const allRecipes = useMemo(() => {
    if ((apiRecipes as any[]).length) return apiRecipes as any[]
    return Object.values(RECIPE_LIBRARY).flat()
  }, [apiRecipes])

  // Available farm types from loaded farms
  const farmTypes = useMemo(() => {
    const types = [...new Set((farms as any[]).map((f:any)=>f.type))]
    return types.length ? types : ['hydroponic','nft','aeroponic','dwc']
  }, [farms])

  const currentFarmType = farmTypes[0] || 'hydroponic'

  // Filtered recipes
  const filteredRecipes = useMemo(() => {
    if (recipeFilter==='all') return allRecipes
    return allRecipes.filter((r:any)=>r.crop_type===recipeFilter)
  }, [allRecipes, recipeFilter])

  const cropTypes = [...new Set(allRecipes.map((r:any)=>r.crop_type))]

  const readyCrops = allCrops.filter((c:any)=>c.status==='ready').length
  const activeCrops = allCrops.filter((c:any)=>c.status!=='harvested').length

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Crops & Recipes</h1>
          <p className="text-xs text-muted mt-0.5">Farm-type-specific grow recipes · Live batch tracking · Harvest analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={()=>{ setEditTemplate(null); setShowRecipe(true) }}>
            <FlaskConical className="w-3.5 h-3.5"/> New Recipe
          </Button>
          <Button variant="primary" onClick={()=>setShowBatch(true)}>
            <Plus className="w-3.5 h-3.5"/> New Batch
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Batches" value={activeCrops} icon={Leaf} accent="green"/>
        <StatCard label="Ready to Harvest" value={readyCrops} icon={CheckCircle} accent="amber"/>
        <StatCard label="Recipe Library" value={allRecipes.length} icon={FlaskConical} accent="blue" sub={`${farmTypes.length} farm types`}/>
        <StatCard label="Avg Quality Score" value="96.2" icon={BarChart3} accent="green" sub="A-grade produce"/>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {(['batches','recipes'] as const).map(t=>(
          <button key={t} className={cn('tab-item capitalize', tab===t&&'active')} onClick={()=>setTab(t)}>
            {t==='batches'?`Active Batches (${allCrops.length})`:`Recipe Library (${allRecipes.length})`}
          </button>
        ))}
      </div>

      {/* ── BATCHES ── */}
      {tab==='batches'&&(
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {allCrops.map((crop:any)=>{
            const pct = STATUS_PCT[crop.status]||0
            const daysLeft = crop.expected_harvest ? Math.ceil((new Date(crop.expected_harvest).getTime()-Date.now())/86400000) : null
            const isUrgent = daysLeft!==null && daysLeft<=3 && daysLeft>=0
            return (
              <div key={crop.id} className="bg-white rounded-xl border border-[var(--border)] p-4 hover:border-[var(--border2)] hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{crop.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted font-mono">{crop.batch_code}</span>
                      {crop.farm_code&&<span className="badge badge-gray text-[9px]">{crop.farm_code} · {crop.zone_code||'—'}</span>}
                    </div>
                  </div>
                  <Badge variant={STATUS_COLOR[crop.status]??'gray'}>{crop.status}</Badge>
                </div>
                <ProgressBar value={pct} variant={crop.status==='ready'?'green':crop.status==='fruiting'||crop.status==='flowering'?'amber':'blue'} showPct label="Progress"/>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border)] text-xs">
                  <div><div className="text-muted text-[10px]">Planted</div><div className="font-medium text-[var(--text)]">{relativeTime(crop.planted_at)}</div></div>
                  <div>
                    <div className="text-muted text-[10px]">{daysLeft!==null&&daysLeft>=0?'Harvest in':'Harvest'}</div>
                    <div className={cn('font-medium', isUrgent?'text-[var(--amber)]':'text-[var(--text)]')}>
                      {daysLeft===null?'—':daysLeft<=0?'🟢 Today!':daysLeft===1?'Tomorrow':`${daysLeft} days`}
                    </div>
                  </div>
                  {crop.actual_yield_kg!=null&&<>
                    <div><div className="text-muted text-[10px]">Yield</div><div className="font-medium text-[var(--green)]">{crop.actual_yield_kg} kg</div></div>
                    <div><div className="text-muted text-[10px]">Quality</div><div className="font-medium text-[var(--green)]">{crop.quality_score}/100</div></div>
                  </>}
                </div>
                {/* Batch actions */}
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-[var(--border)]">
                  {crop.status !== 'harvested' && crop.status !== 'ready' && (
                    <button className="btn-secondary btn-sm text-[10px] flex-1"
                      onClick={() => updateCrop.mutate({ id:crop.id, data:{ status:'ready' }})}>
                      Mark Ready
                    </button>
                  )}
                  {(crop.status === 'ready') && (
                    <button className="btn-success btn-sm text-[10px] flex-1"
                      onClick={() => updateCrop.mutate({ id:crop.id, data:{ status:'harvested' }})}>
                      ✓ Harvest
                    </button>
                  )}
                  <button className="btn-ghost btn-sm text-[10px] px-2"
                    onClick={() => toast.success('Scouting log for '+crop.name)}>
                    Scout
                  </button>
                </div>
              </div>
            )
          })}
          <div className="bg-white rounded-xl border-2 border-dashed border-[var(--border)] p-4 flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-all group" onClick={()=>setShowBatch(true)}>
            <div className="text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5 text-[var(--accent)]"/>
              </div>
              <div className="text-xs font-semibold text-[var(--accent)]">Start New Batch</div>
              <div className="text-[10px] text-muted mt-0.5">Plant new crop cycle</div>
            </div>
          </div>
        </div>
      )}

      {/* ── RECIPES ── */}
      {tab==='recipes'&&(
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Recipe list */}
          <div>
            {/* Filter by crop type */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10px] text-muted font-semibold">FILTER:</span>
              {['all',...cropTypes].map(t=>(
                <button key={t} onClick={()=>setRecipeFilter(t)}
                  className={cn('text-[10px] px-2 py-1 rounded-lg border font-medium transition-all',
                    recipeFilter===t?'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]':'border-[var(--border2)] text-muted hover:border-[var(--accent)]'
                  )}>{t==='all'?'All':t}</button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredRecipes.map((r:any, idx:number)=>(
                <div key={r.id||idx} onClick={()=>setSelectedRecipe(r)}
                  className={cn('bg-white rounded-xl border-2 p-3 cursor-pointer transition-all',
                    selectedRecipe===r?'border-[var(--accent)] bg-[var(--accent-soft)]':'border-[var(--border)] hover:border-[var(--border2)] hover:shadow-sm'
                  )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[var(--text)] leading-tight">{r.name}</span>
                    <ChevronRight className="w-3 h-3 text-muted shrink-0"/>
                  </div>
                  <div className="text-[10px] text-muted mb-2">{r.crop_type} · {r.variety} · {r.grow_days}d cycle</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="badge badge-green">{r.phases?.length||0} phases</span>
                    {r.expected_yield_kg&&<span className="badge badge-blue">{r.expected_yield_kg} kg/m²</span>}
                    {r.is_public&&<span className="badge badge-gray">Library</span>}
                  </div>
                </div>
              ))}
              <button onClick={()=>{ setEditTemplate(null); setShowRecipe(true) }}
                className="w-full bg-white rounded-xl border-2 border-dashed border-[var(--border)] p-3 text-center text-xs text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-all">
                <Plus className="w-3.5 h-3.5 inline mr-1"/>Create Custom Recipe
              </button>
            </div>

            {/* Library hint by farm type */}
            <div className="mt-4 p-3 rounded-xl text-[10px]" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
              <div className="font-semibold text-[var(--text)] mb-1">Recipe Library Coverage</div>
              {[['💧 Hydroponic', RECIPE_LIBRARY.hydroponic.length],['🌊 NFT', RECIPE_LIBRARY.nft.length],['☁️ Aeroponic', RECIPE_LIBRARY.aeroponic.length],['🏊 DWC', RECIPE_LIBRARY.dwc.length]].map(([label, count])=>(
                <div key={String(label)} className="flex justify-between text-muted py-0.5">
                  <span>{label}</span><span className="font-semibold text-[var(--text)]">{count} recipes</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div className="xl:col-span-2">
            {selectedRecipe ? (
              <RecipeDetail recipe={selectedRecipe} farmType={currentFarmType}
                onUse={()=>setShowBatch(true)}
                onEdit={()=>{ setEditTemplate(selectedRecipe); setShowRecipe(true) }}/>
            ) : (
              <div className="bg-white rounded-xl border-2 border-dashed border-[var(--border)] p-8 flex items-center justify-center">
                <div className="text-center">
                  <FlaskConical className="w-10 h-10 text-muted mx-auto mb-3 opacity-50"/>
                  <div className="text-sm font-semibold text-[var(--text)] mb-1">Select a recipe</div>
                  <div className="text-xs text-muted">View growth phases, environmental targets,<br/>and yield projections for any recipe</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CreateBatchModal open={showBatch} onClose={()=>setShowBatch(false)} farmType={currentFarmType}/>
      <CreateRecipeModal open={showRecipe} onClose={()=>{ setShowRecipe(false); setEditTemplate(null) }} farmType={currentFarmType} preloadTemplate={editTemplate}/>
    </div>
  )
}
