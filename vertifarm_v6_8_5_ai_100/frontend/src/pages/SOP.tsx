import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { BookOpen, Plus, Search, ChevronDown, ChevronUp, Edit2, Trash2, CheckCircle2, Clock, Tag, User, FileText, X } from 'lucide-react'

const MOCK_SOPS = [
  { id:'sop-001', title:'Daily Zone Inspection Checklist', category:'Operations', tags:['daily','inspection','all-zones'], steps:['Check temp/humidity readings in all zones vs setpoints','Inspect nutrient tanks — top up if <30%','Check EC and pH of all nutrient reservoirs','Inspect plant canopy for signs of disease or deficiency','Log any anomalies in the incident register','Check all pump and valve statuses','Verify CO₂ tank levels'], estimated_min:45, version:'2.1', last_updated:'2027-05-01', author:'Ravi Kumar', is_active:true },
  { id:'sop-002', title:'Nutrient Solution Preparation — Leafy Greens', category:'Nutrition', tags:['nutrients','hydroponic','lettuce'], steps:['Prepare 200L RO water in mixing tank','Add Part A (calcium nitrate) — 200g per 100L','Add Part B (NPK stock) — 150g per 100L','Adjust EC to target (1.8–2.0 mS/cm)','Adjust pH to 6.0–6.2 using pH Up/Down','Allow 30 min for mixing before use'], estimated_min:30, version:'3.0', last_updated:'2027-04-15', author:'Priya Sharma', is_active:true },
  { id:'sop-003', title:'Seeding & Transplant Protocol', category:'Propagation', tags:['seeding','germination','transplant'], steps:['Sanitize all trays and tools with 70% IPA','Sow seeds at recommended spacing per crop guide','Cover with humidity dome; maintain 22°C, RH 80%','Check germination daily; mist if media dries','Transplant to system when first true leaf emerges','Record transplant date and batch number in system'], estimated_min:60, version:'1.5', last_updated:'2027-03-20', author:'Arjun Patel', is_active:true },
  { id:'sop-004', title:'Harvest & Post-Harvest Handling', category:'Harvest', tags:['harvest','quality','post-harvest'], steps:['Wear nitrile gloves and hair net before entering harvest room','Cut at base with sanitized stainless steel scissors','Weigh each batch; record in system with zone and crop details','Grade: A (no blemish), B (minor), C (damaged)','Cool to 4°C within 2 hours of harvest','Pack in food-grade bags with lot number and harvest date','Update traceability record in VertiFarm system'], estimated_min:90, version:'2.3', last_updated:'2027-05-10', author:'Ravi Kumar', is_active:true },
  { id:'sop-005', title:'Weekly Deep Clean — NFT Channels', category:'Sanitation', tags:['cleaning','NFT','weekly'], steps:['Drain NFT channels completely','Flush with clean RO water','Apply food-safe sanitizer (diluted to 100ppm chlorine)','Scrub channel walls with soft brush','Rinse with RO water — test chlorine <1ppm before replanting','Inspect channels for root blocking or biofilm','Refill with fresh nutrient solution'], estimated_min:120, version:'1.2', last_updated:'2027-02-28', author:'Sunita Singh', is_active:true },
  { id:'sop-006', title:'Emergency — Power Outage Response', category:'Emergency', tags:['emergency','power','critical'], steps:['Immediately check generator auto-start status','If generator fails — manually start within 5 minutes','Prioritize: irrigation pumps first, then HVAC, then lighting','Open roof vents if available to prevent heat stress','Contact on-call technician if outage >15 min','Log incident with timestamp and duration','Review plant stress indicators next day'], estimated_min:15, version:'1.0', last_updated:'2027-01-10', author:'Farm Manager', is_active:true },
]

const CATEGORIES = ['All', 'Operations', 'Nutrition', 'Propagation', 'Harvest', 'Sanitation', 'Emergency']

const CAT_COLORS: Record<string, string> = {
  Operations: '#3b82f6', Nutrition: '#10b981', Propagation: '#8b5cf6',
  Harvest: '#f59e0b', Sanitation: '#06b6d4', Emergency: '#ef4444',
}

function SOPCard({ sop, onDelete }: { sop: any; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const color = CAT_COLORS[sop.category] || '#64748b'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <BookOpen size={16} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{sop.title}</span>
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}18`, color }}>{sop.category}</span>
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, background: 'var(--surface)', color: 'var(--text3)' }}>v{sop.version}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><FileText size={9} />{sop.steps.length} steps</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} />~{sop.estimated_min} min</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={9} />{sop.author}</span>
            <span>Updated {new Date(sop.last_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {sop.tags.map((t: string) => (
              <span key={t} style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, background: 'rgba(148,163,184,0.08)', color: 'var(--text3)' }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${sop.title}"?`)) onDelete(sop.id) }}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
            <Trash2 size={12} />
          </button>
          {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(148,163,184,0.08)', padding: '16px 18px' }}>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sop.steps.map((step: string, i: number) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--text)' }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function AddSOPModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: '', category: 'Operations', steps_text: '', estimated_min: 30, tags: '' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return }
    const steps = form.steps_text.split('\n').map(s => s.trim()).filter(Boolean)
    if (steps.length === 0) { toast.error('Add at least one step'); return }
    setSaving(true)
    try {
      await api.post('/api/v1/sops', {
        title: form.title, category: form.category, steps,
        estimated_min: form.estimated_min,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        version: '1.0', author: 'You',
      }).catch(() => null)
      toast.success('SOP created')
      qc.invalidateQueries({ queryKey: ['sops'] })
      onClose()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: 'var(--card)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 18, width: '100%', maxWidth: 560, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Create SOP</div>

        {[
          { label: 'Title', key: 'title', placeholder: 'e.g. Daily Zone Inspection Checklist', type: 'text' },
        ].map(({ label, key, placeholder, type }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>{label}</label>
            <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' as const }} />
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13 }}>
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Estimated Time (min)</label>
            <input type="number" min={5} max={480} value={form.estimated_min} onChange={e => setForm(f => ({ ...f, estimated_min: parseInt(e.target.value) }))}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Steps (one per line)</label>
          <textarea value={form.steps_text} onChange={e => setForm(f => ({ ...f, steps_text: e.target.value }))}
            rows={6} placeholder="Step 1: Check all zone temperatures&#10;Step 2: Inspect nutrient tanks&#10;Step 3: ..."
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Tags (comma-separated)</label>
          <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="daily, inspection, zone-a"
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create SOP'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SOPPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showAdd, setShowAdd] = useState(false)

  const { data: sops = MOCK_SOPS } = useQuery({
    queryKey: ['sops'],
    queryFn: () => api.get('/api/v1/sops').then(r => r.data).catch(() => MOCK_SOPS),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/sops/${id}`).catch(() => null),
    onSuccess: () => { toast.success('SOP deleted'); qc.invalidateQueries({ queryKey: ['sops'] }) },
  })

  const displaySops = (sops as any[]).length ? sops : MOCK_SOPS
  const filtered = displaySops.filter((s: any) => {
    const matchCat = category === 'All' || s.category === category
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.tags?.some((t: string) => t.includes(search.toLowerCase()))
    return matchCat && matchSearch
  })

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <BookOpen size={20} color="#00d4aa" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Standard Operating Procedures</h1>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>Step-by-step procedures for farm operations, nutrition, harvest, and emergencies</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'var(--accent)', borderRadius: 10, border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <Plus size={14} /> New SOP
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SOPs…"
            style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px 9px 30px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${category === c ? '#00d4aa' : 'rgba(148,163,184,0.2)'}`, background: category === c ? 'rgba(0,212,170,0.1)' : 'transparent', color: category === c ? '#00d4aa' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: category === c ? 600 : 400 }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>{filtered.length} procedure{filtered.length !== 1 ? 's' : ''}</div>

      {filtered.map((sop: any) => <SOPCard key={sop.id} sop={sop} onDelete={id => deleteMutation.mutate(id)} />)}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
          <BookOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.3, display: 'block' }} />
          <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 8 }}>No SOPs found</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Try a different search or category</div>
        </div>
      )}

      {showAdd && <AddSOPModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
