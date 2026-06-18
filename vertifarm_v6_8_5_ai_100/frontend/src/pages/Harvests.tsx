import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge, Button, Modal, Input, Select, Textarea, EmptyState, StatCard } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  Leaf, Plus, QrCode, Download, X, Scale,
  Award, Calendar, Hash, FileText, ChevronRight,
  Search, Filter, CheckCircle2, Package, TrendingUp
} from 'lucide-react'

// ─── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_HARVESTS = [
  { id:'h1', crop_name:'Butterhead Lettuce', batch_code:'DHF-2026-001', weight_kg:95.5, quality_grade:'A', harvested_by:'Rajiv Sharma', harvested_at:new Date(Date.now()-86400000).toISOString(), notes:'Excellent head density. Clean cut.', farm_name:'Delhi HQ', zone:'A1' },
  { id:'h2', crop_name:'Sweet Basil', batch_code:'DHF-2026-006', weight_kg:180.0, quality_grade:'A', harvested_by:'Priya Nair', harvested_at:new Date(Date.now()-2*86400000).toISOString(), notes:'Strong aroma. Pre-cooled immediately.', farm_name:'Delhi HQ', zone:'C2' },
  { id:'h3', crop_name:'Oakleaf Lettuce', batch_code:'MUF-2026-003', weight_kg:140.0, quality_grade:'B', harvested_by:'Amit Verma', harvested_at:new Date(Date.now()-3*86400000).toISOString(), notes:'Some tip-burn on outer leaves. EC was high.', farm_name:'Mumbai Vertical', zone:'N7' },
  { id:'h4', crop_name:'Herb Tower Blend', batch_code:'PNF-2026-002', weight_kg:150.0, quality_grade:'A', harvested_by:'Sona Thomas', harvested_at:new Date(Date.now()-4*86400000).toISOString(), notes:'Mixed herbs. Packed in 250g retail bags.', farm_name:'Pune Aero', zone:'T2' },
  { id:'h5', crop_name:'Rainbow Swiss Chard', batch_code:'BLR-2026-002', weight_kg:240.0, quality_grade:'A', harvested_by:'Kiran Das', harvested_at:new Date(Date.now()-5*86400000).toISOString(), notes:'Stunning colour. Progressive outer leaf harvest.', farm_name:'Bangalore DWC', zone:'R2' },
]

const DEMO_TRACE = [
  { id:'t1', batch_code:'DHF-2026-001', farm_name:'Delhi HQ', zone:'Zone A1', grow_method:'NFT Hydroponics', sow_date:new Date(Date.now()-35*86400000).toISOString(), harvest_date:new Date(Date.now()-86400000).toISOString(), water_source:'RO Water', nutrients_used:['MaxiGro','CalMag','pH Down'], certifications:['FSSAI','GlobalGAP'], qr_code:'https://vertifarm.io/trace/DHF-2026-001' },
  { id:'t2', batch_code:'MUF-2026-003', farm_name:'Mumbai Vertical', zone:'Zone N7', grow_method:'NFT Hydroponics', sow_date:new Date(Date.now()-28*86400000).toISOString(), harvest_date:new Date(Date.now()-3*86400000).toISOString(), water_source:'Municipal + RO', nutrients_used:['AquaFlakes','CalMag'], certifications:['FSSAI'], qr_code:'https://vertifarm.io/trace/MUF-2026-003' },
  { id:'t3', batch_code:'PNF-2026-002', farm_name:'Pune Aero', zone:'Tower T2', grow_method:'Aeroponics', sow_date:new Date(Date.now()-32*86400000).toISOString(), harvest_date:new Date(Date.now()-4*86400000).toISOString(), water_source:'RO Water', nutrients_used:['Masterblend','Epsom','CalNit'], certifications:['FSSAI','Organic India'], qr_code:'https://vertifarm.io/trace/PNF-2026-002' },
]

const GRADE_COLORS: Record<string, string> = { A: '#10b981', B: '#f59e0b', C: '#ef4444' }

function GradeBadge({ grade }: { grade: string }) {
  return (
    <Badge variant={grade==='A'?'green':grade==='B'?'amber':'red'}>
      {grade}-Grade
    </Badge>
  )
}

// ─── Log Harvest Modal ─────────────────────────────────────────────────────────
function LogHarvestModal({ open, onClose, crops }: { open:boolean; onClose:()=>void; crops:any[] }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    crop_id:'', batch_code:'', crop_name:'', weight_kg:'', quality_grade:'A',
    harvested_by:'', harvested_at: new Date().toISOString().slice(0,16),
    farm_name:'', zone:'', notes:'', packaged_units:'', unit_weight:''
  })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k:string,v:string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>{const n={...e};delete n[k];return n}) }

  const handleCropSelect = (id:string) => {
    set('crop_id', id)
    const crop = crops.find((c:any) => c.id===id)
    if (crop) {
      set('crop_name', crop.name || '')
      set('batch_code', crop.batch_code || crop.batch_number || '')
      set('farm_name', crop.farm_code || '')
      set('zone', crop.zone_code || '')
    }
  }

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.crop_name.trim()) e.crop_name = 'Crop name required'
    if (!form.weight_kg || parseFloat(form.weight_kg) <= 0) e.weight_kg = 'Valid weight required'
    if (!form.harvested_by.trim()) e.harvested_by = 'Harvested by required'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await api.post('/api/v1/harvests', {
        crop_id: form.crop_id || undefined,
        batch_code: form.batch_code,
        crop_name: form.crop_name,
        weight_kg: parseFloat(form.weight_kg),
        quality_grade: form.quality_grade,
        harvested_by: form.harvested_by,
        harvested_at: form.harvested_at ? new Date(form.harvested_at).toISOString() : new Date().toISOString(),
        farm_name: form.farm_name,
        zone: form.zone,
        notes: form.notes,
        packaged_units: form.packaged_units ? parseInt(form.packaged_units) : undefined,
        unit_weight: form.unit_weight ? parseFloat(form.unit_weight) : undefined,
      })
      qc.invalidateQueries({ queryKey:['harvests'] })
      toast.success(`Harvest logged — ${form.weight_kg} kg of ${form.crop_name}`)
      setForm({ crop_id:'', batch_code:'', crop_name:'', weight_kg:'', quality_grade:'A', harvested_by:'', harvested_at:new Date().toISOString().slice(0,16), farm_name:'', zone:'', notes:'', packaged_units:'', unit_weight:'' })
      onClose()
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to log harvest') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Harvest" size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={loading} onClick={handleSubmit}>Log Harvest</Button></>}>
      <div className="space-y-4">
        {/* Crop selection */}
        {crops.length > 0 && (
          <Select label="Link to Crop Batch" placeholder="— Select crop batch —"
            options={[{value:'',label:'— Manual entry —'},...crops.map((c:any)=>({value:c.id,label:`${c.name}${c.batch_code?' ('+c.batch_code+')':''}`}))]}
            value={form.crop_id} onChange={e=>handleCropSelect(e.target.value)}
            hint="Linking auto-fills batch code, farm, and zone"/>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input label="Crop Name *" placeholder="e.g. Butterhead Lettuce" value={form.crop_name} onChange={e=>set('crop_name',e.target.value)} error={errors.crop_name}/>
          <Input label="Batch Code" placeholder="e.g. DHF-2026-007" value={form.batch_code} onChange={e=>set('batch_code',e.target.value)}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Weight (kg) *" type="number" step="0.1" placeholder="e.g. 95.5" value={form.weight_kg} onChange={e=>set('weight_kg',e.target.value)} error={errors.weight_kg}/>
          <Select label="Grade" options={[{value:'A',label:'A — Premium Quality'},{value:'B',label:'B — Standard'},{value:'C',label:'C — Processing Grade'}]} value={form.quality_grade} onChange={e=>set('quality_grade',e.target.value)}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Harvested By *" placeholder="Staff member name" value={form.harvested_by} onChange={e=>set('harvested_by',e.target.value)} error={errors.harvested_by}/>
          <Input label="Date & Time" type="datetime-local" value={form.harvested_at} onChange={e=>set('harvested_at',e.target.value)}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Farm" placeholder="e.g. Delhi HQ" value={form.farm_name} onChange={e=>set('farm_name',e.target.value)}/>
          <Input label="Zone" placeholder="e.g. Zone A1" value={form.zone} onChange={e=>set('zone',e.target.value)}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Packaged Units" type="number" placeholder="e.g. 380" value={form.packaged_units} onChange={e=>set('packaged_units',e.target.value)} hint="Number of retail/wholesale units"/>
          <Input label="Unit Weight (g)" type="number" placeholder="e.g. 250" value={form.unit_weight} onChange={e=>set('unit_weight',e.target.value)} hint="Weight per unit in grams"/>
        </div>

        <Textarea label="Notes" placeholder="Observations, anomalies, packaging notes, cold-chain actions…" value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3}/>
      </div>
    </Modal>
  )
}

// ─── Create Traceability Record Modal ─────────────────────────────────────────
function CreateTraceModal({ open, onClose, crops }: { open:boolean; onClose:()=>void; crops:any[] }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    batch_code:'', farm_name:'', zone:'', grow_method:'NFT Hydroponics',
    nutrients_used:'', water_source:'RO Water', certifications:'',
    crop_id:'', sow_date:'', harvest_date:'',
  })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e=>{const n={...e};delete n[k];return n}) }

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.batch_code.trim()) e.batch_code = 'Batch code required'
    if (!form.farm_name.trim()) e.farm_name = 'Farm name required'
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await api.post('/api/v1/traceability', {
        ...form,
        nutrients_used: form.nutrients_used.split(',').map(s => s.trim()).filter(Boolean),
        certifications: form.certifications.split(',').map(s => s.trim()).filter(Boolean),
        sow_date: form.sow_date ? new Date(form.sow_date).toISOString() : null,
        harvest_date: form.harvest_date ? new Date(form.harvest_date).toISOString() : null,
      })
      qc.invalidateQueries({ queryKey: ['traceability'] })
      toast.success('Traceability record created — QR code generated')
      onClose()
    } catch(err:any) { toast.error(err?.response?.data?.detail ?? 'Failed to create record') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Traceability Record" size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={loading} onClick={handleSubmit}>Create & Generate QR</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Batch Code *" placeholder="e.g. DHF-2026-007" value={form.batch_code} onChange={e=>set('batch_code',e.target.value)} error={errors.batch_code}/>
          <Select label="Linked Crop"
            options={[{value:'',label:'— Optional —'},...crops.map((c:any)=>({value:c.id,label:c.name}))]}
            value={form.crop_id} onChange={e=>set('crop_id',e.target.value)}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Farm Name *" placeholder="e.g. Delhi HQ" value={form.farm_name} onChange={e=>set('farm_name',e.target.value)} error={errors.farm_name}/>
          <Input label="Zone" placeholder="e.g. Zone A — Row 3" value={form.zone} onChange={e=>set('zone',e.target.value)}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Sow Date" type="date" value={form.sow_date} onChange={e=>set('sow_date',e.target.value)}/>
          <Input label="Harvest Date" type="date" value={form.harvest_date} onChange={e=>set('harvest_date',e.target.value)}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Grow Method" options={[
            'NFT Hydroponics','DWC Hydroponics','Aeroponics','Fogponics','Kratky','Aquaponics','Raised Bed'
          ].map(m=>({value:m,label:m}))} value={form.grow_method} onChange={e=>set('grow_method',e.target.value)}/>
          <Input label="Water Source" placeholder="e.g. RO Water" value={form.water_source} onChange={e=>set('water_source',e.target.value)}/>
        </div>

        <Input label="Nutrients Used (comma-separated)" placeholder="e.g. MaxiGro, CalMag, pH Down" value={form.nutrients_used} onChange={e=>set('nutrients_used',e.target.value)}/>
        <Input label="Certifications (comma-separated)" placeholder="e.g. FSSAI, GlobalGAP, Organic India" value={form.certifications} onChange={e=>set('certifications',e.target.value)} hint="Leave blank if not certified"/>
      </div>
    </Modal>
  )
}

// ─── Trace Card ────────────────────────────────────────────────────────────────
function TraceCard({ record }: { record: any }) {
  const [qrLoaded, setQrLoaded] = useState(false)
  const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000'
  const qrUrl   = `${apiBase}/api/v1/traceability/${record.batch_code}/qr`
  const pdfUrl  = `${apiBase}/api/v1/traceability/${record.batch_code}/pdf`
  const buyerUrl = `${apiBase}/api/v1/buyer?batch=${record.batch_code}`

  return (
    <div className="card p-4 flex gap-4">
      {/* QR Code - shows actual QR image */}
      <a href={qrUrl} target="_blank" rel="noopener noreferrer"
        className="w-20 h-20 rounded-xl border border-[var(--border)] bg-[var(--bg3)] flex flex-col items-center justify-center gap-1 flex-shrink-0 overflow-hidden hover:border-[var(--accent)] transition-all group relative"
        title="Click to view / download QR code">
        <img src={qrUrl} alt={`QR ${record.batch_code}`} className="w-16 h-16 object-contain"
          onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
        <div className="absolute inset-0 bg-[var(--accent)] bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-xl flex items-end justify-center pb-1">
          <span className="text-[8px] font-bold text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all">DOWNLOAD</span>
        </div>
      </a>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-base font-bold text-[var(--text)]">{record.batch_code}</span>
          {(record.certifications || []).map((c:string) => (
            <Badge key={c} variant="green">{c}</Badge>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 mb-3">
          {[
            { icon:Leaf,     label:'Farm',    val:record.farm_name },
            { icon:Hash,     label:'Zone',    val:record.zone || '—' },
            { icon:Filter,   label:'Method',  val:record.grow_method || '—' },
            { icon:Calendar, label:'Sown',    val:record.sow_date ? new Date(record.sow_date).toLocaleDateString('en-IN') : '—' },
            { icon:Calendar, label:'Harvest', val:record.harvest_date ? new Date(record.harvest_date).toLocaleDateString('en-IN') : '—' },
          ].map(({ icon:Icon, label, val }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon className="w-3 h-3 text-muted flex-shrink-0"/>
              <span className="text-xs text-muted">{label}:</span>
              <span className="text-xs text-[var(--text)] font-medium truncate">{val}</span>
            </div>
          ))}
        </div>

        {(record.nutrients_used || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {record.nutrients_used.map((n:string) => (
              <span key={n} className="badge badge-gray text-[10px]">{n}</span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        <a href={qrUrl} target="_blank" className="btn-secondary btn-sm flex items-center gap-1.5 text-xs">
          <QrCode className="w-3.5 h-3.5"/> QR Code
        </a>
        <a href={pdfUrl} target="_blank" className="btn-primary btn-sm flex items-center gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5"/> PDF Cert
        </a>
        <a href={buyerUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm flex items-center gap-1.5 text-xs">
          <ChevronRight className="w-3.5 h-3.5"/> Buyer View
        </a>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function HarvestsPage() {
  const [tab, setTab] = useState<'harvests'|'traceability'>('harvests')
  const [showLog, setShowLog] = useState(false)
  const [showTrace, setShowTrace] = useState(false)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')

  const { data: harvests = [] } = useQuery({
    queryKey: ['harvests'],
    queryFn: () => api.get('/api/v1/harvests').then(r => r.data),
  })
  const { data: traceability = [] } = useQuery({
    queryKey: ['traceability'],
    queryFn: () => api.get('/api/v1/traceability').then(r => r.data),
  })
  const { data: crops = [] } = useQuery({
    queryKey: ['crops'],
    queryFn: () => api.get('/api/v1/crops').then(r => r.data),
  })

  const allHarvests = (harvests as any[]).length ? harvests as any[] : DEMO_HARVESTS
  const allTrace    = (traceability as any[]).length ? traceability as any[] : DEMO_TRACE
  const allCrops    = crops as any[]

  const filteredHarvests = allHarvests.filter((h:any) => {
    if (gradeFilter !== 'all' && h.quality_grade !== gradeFilter) return false
    if (search && !h.crop_name?.toLowerCase().includes(search.toLowerCase()) &&
      !h.harvested_by?.toLowerCase().includes(search.toLowerCase()) &&
      !h.batch_code?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredTrace = allTrace.filter((t:any) =>
    !search || t.batch_code?.toLowerCase().includes(search.toLowerCase()) ||
    t.farm_name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalKg   = allHarvests.reduce((s:number, h:any) => s + (h.weight_kg ?? 0), 0)
  const gradeACnt = allHarvests.filter((h:any) => h.quality_grade === 'A').length
  const avgGrade  = allHarvests.length ? Math.round(gradeACnt / allHarvests.length * 100) : 0

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Harvests & Traceability</h1>
          <p className="text-xs text-muted mt-0.5">QR-code traceability from seed to shelf — log, track, certify</p>
        </div>
        <div className="flex gap-2">
          {tab === 'harvests'
            ? <Button variant="primary" onClick={() => setShowLog(true)}><Plus className="w-3.5 h-3.5"/> Log Harvest</Button>
            : <Button variant="primary" onClick={() => setShowTrace(true)}><QrCode className="w-3.5 h-3.5"/> Create Record</Button>
          }
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Harvested" value={`${totalKg.toFixed(1)} kg`} icon={Scale} accent="green" sub={`${allHarvests.length} batches`}/>
        <StatCard label="Grade A Produce" value={`${avgGrade}%`} icon={Award} accent="amber" sub={`${gradeACnt} of ${allHarvests.length} batches`}/>
        <StatCard label="Traceable Batches" value={allTrace.length} icon={QrCode} accent="blue" sub="QR certs ready"/>
        <StatCard label="This Week" value={`${allHarvests.filter((h:any)=>Date.now()-new Date(h.harvested_at).getTime()<7*86400000).reduce((s:number,h:any)=>s+(h.weight_kg||0),0).toFixed(1)} kg`} icon={TrendingUp} accent="green"/>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {(['harvests','traceability'] as const).map(t => (
          <button key={t} className={`tab-item ${tab===t?'active':''}`} onClick={() => setTab(t)}>
            {t === 'harvests' ? `Harvest Logs (${allHarvests.length})` : `Traceability (${allTrace.length})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"/>
          <input className="input text-xs py-1.5 pl-8 w-56"
            placeholder={tab==='harvests'?'Search crop, batch, harvester…':'Search batch code, farm…'}
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {tab === 'harvests' && (
          <div className="flex gap-1.5">
            {(['all','A','B','C'] as const).map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-all ${gradeFilter===g?'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]':'border-[var(--border)] text-muted hover:text-[var(--text)]'}`}>
                {g === 'all' ? 'All Grades' : `Grade ${g}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Harvest Logs Table */}
      {tab === 'harvests' && (
        filteredHarvests.length === 0 ? (
          <EmptyState icon={Leaf} title="No harvest logs" message="Log your first harvest to start tracking yield and quality."/>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Crop</th><th>Batch</th><th>Weight</th><th>Grade</th>
                    <th>Farm / Zone</th><th>Harvested By</th><th>Date</th><th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHarvests.map((h:any) => (
                    <tr key={h.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center flex-shrink-0">
                            <Leaf className="w-3.5 h-3.5 text-[var(--accent)]"/>
                          </div>
                          <span className="font-medium text-[var(--text)]">{h.crop_name ?? '—'}</span>
                        </div>
                      </td>
                      <td><span className="text-xs font-mono text-muted">{h.batch_code || '—'}</span></td>
                      <td><span className="font-bold text-[var(--text)]">{h.weight_kg ? `${h.weight_kg} kg` : '—'}</span></td>
                      <td><GradeBadge grade={h.quality_grade ?? 'A'}/></td>
                      <td><div className="text-xs text-[var(--text)]">{h.farm_name || '—'}</div><div className="text-[10px] text-muted">{h.zone}</div></td>
                      <td><span className="text-xs text-[var(--text)]">{h.harvested_by || '—'}</span></td>
                      <td><span className="text-xs text-muted">{h.harvested_at ? new Date(h.harvested_at).toLocaleDateString('en-IN') : '—'}</span></td>
                      <td><span className="text-xs text-muted truncate max-w-[160px] block">{h.notes || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Traceability */}
      {tab === 'traceability' && (
        filteredTrace.length === 0 ? (
          <EmptyState icon={QrCode} title="No traceability records" message="Create a traceability record to generate a QR certificate for buyers."/>
        ) : (
          <div className="space-y-3">
            {filteredTrace.map((t:any) => <TraceCard key={t.id} record={t}/>)}
          </div>
        )
      )}

      {/* Modals */}
      <LogHarvestModal open={showLog} onClose={() => setShowLog(false)} crops={allCrops}/>
      <CreateTraceModal open={showTrace} onClose={() => setShowTrace(false)} crops={allCrops}/>
    </div>
  )
}
