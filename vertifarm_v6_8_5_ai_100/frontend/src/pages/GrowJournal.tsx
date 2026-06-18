import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Plus, Camera, AlertTriangle, CheckCircle2,
  Thermometer, Droplets, Wind, FlaskConical, Zap, Bug,
  Search, Filter, Download, ChevronDown, X, Leaf
} from 'lucide-react'
import toast from 'react-hot-toast'

const ENTRY_TYPES = [
  { id:'observation', label:'Observation',  icon:BookOpen,      color:'#2563eb', bg:'#dbeafe' },
  { id:'pest',        label:'Pest/Disease', icon:Bug,           color:'#dc2626', bg:'#fee2e2' },
  { id:'adjustment',  label:'Adjustment',   icon:FlaskConical,  color:'#d97706', bg:'#fef3c7' },
  { id:'harvest',     label:'Harvest Note', icon:Leaf,          color:'#059669', bg:'#d1fae5' },
  { id:'photo',       label:'Photo Log',    icon:Camera,        color:'#7c3aed', bg:'#ede9fe' },
  { id:'alert',       label:'Alert',        icon:AlertTriangle, color:'#dc2626', bg:'#fee2e2' },
]

const DEMO_ENTRIES = [
  { id:'j1', batch_code:'LTB-2026-042', crop:'Butterhead Lettuce', zone:'Zone A1',
    type:'pest', title:'Aphid cluster on lower leaves — Zone A1 Row 3',
    body:'Found 15–20 aphids concentrated on the underside of lower leaves, rows 3 and 4. No winged individuals. Likely established colony. Applied neem oil spray 1500ppm. Will monitor tomorrow.',
    tags:['aphids','neem-oil','pest'], severity:'warning', author:'Priya M.', created_at:'2026-06-04T09:15:00Z',
    sensors:{ temp:23.8, rh:82.4, co2:1100, ph:6.1, ec:2.0 } },
  { id:'j2', batch_code:'LTB-2026-042', crop:'Butterhead Lettuce', zone:'Zone A1',
    type:'adjustment', title:'EC raised to 2.2 mS/cm — AI recommendation applied',
    body:'Applied AI agronomist recommendation: raised EC from 2.0 to 2.2 mS/cm. Mixed additional Cal-Mag at 0.5ml/L. pH adjusted to 6.1. Recorded before/after sensor readings.',
    tags:['nutrients','ec','ai-recommendation'], severity:'info', author:'Rahul K.', created_at:'2026-06-03T14:30:00Z',
    sensors:{ temp:23.5, rh:68.2, co2:1095, ph:6.1, ec:2.2 } },
  { id:'j3', batch_code:'BSL-2026-031', crop:'Basil Genovese', zone:'Zone A3',
    type:'observation', title:'Tip burn developing on 8% of outer leaves',
    body:'Tip burn visible on approximately 8% of leaves in rows 5-7. Likely calcium deficiency exacerbated by high humidity (91%). Reduced humidity setpoint to 78%. Will apply foliar calcium spray tomorrow morning.',
    tags:['tip-burn','calcium','humidity'], severity:'warning', author:'Arjun S.', created_at:'2026-06-03T08:00:00Z',
    sensors:{ temp:25.3, rh:91.3, co2:1140, ph:5.9, ec:2.2 } },
  { id:'j4', batch_code:'MKG-2026-018', crop:'Microgreens Mix', zone:'Zone D1',
    type:'harvest', title:'Harvest complete — 3.8kg, Grade A',
    body:'Full harvest completed. Weight: 3.8kg (target 3.5kg — +8.6%). Visual grade: 95% Grade A, 5% Grade B. Pre-cooled at 4°C for 90 min. Packed in 150g clam shells × 25 units. QR trace applied.',
    tags:['harvest','grade-a','weight'], severity:'success', author:'Priya M.', created_at:'2026-06-02T07:00:00Z',
    sensors:{ temp:21.5, rh:72.0, co2:940, ph:6.1, ec:1.2 } },
  { id:'j5', batch_code:'SPN-2026-022', crop:'Baby Spinach', zone:'Zone B1',
    type:'observation', title:'Uniform germination — 97% germ rate at Day 4',
    body:'Excellent germination uniformity across all 8 trays. Cotyledons fully emerged, good colour. EC remains at 0.8 for seedling stage. No abnormalities. On track for transplant Day 6.',
    tags:['germination','seedling','propagation'], severity:'success', author:'Rahul K.', created_at:'2026-06-01T10:00:00Z',
    sensors:{ temp:22.0, rh:78.0, co2:950, ph:6.0, ec:0.8 } },
]

type EntryType = typeof DEMO_ENTRIES[number]

function SeverityDot({ s }: { s: string }) {
  const map: Record<string, string> = { warning:'#f59e0b', success:'#10b981', info:'#3b82f6', error:'#ef4444' }
  return <span style={{ width:8, height:8, borderRadius:'50%', background:map[s]||map.info, display:'inline-block', flexShrink:0 }}/>
}

function EntryCard({ entry, onClick }: { entry: EntryType; onClick: ()=>void }) {
  const type = ENTRY_TYPES.find(t => t.id === entry.type) || ENTRY_TYPES[0]
  const Icon = type.icon
  const date = new Date(entry.created_at)
  return (
    <motion.div
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      className="card overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
      style={{ border:`1px solid var(--border)` }}
      onClick={onClick}>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: type.bg, color: type.color }}>
            <Icon className="w-4 h-4"/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-700 uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: type.bg, color: type.color, fontWeight:700, letterSpacing:'.06em' }}>
                {type.label}
              </span>
              <SeverityDot s={entry.severity}/>
            </div>
            <div className="text-sm font-semibold text-[var(--text)] leading-snug mt-1">{entry.title}</div>
          </div>
        </div>
        <p className="text-xs text-[var(--text3)] leading-relaxed line-clamp-2 mb-3">{entry.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {entry.tags.slice(0,3).map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background:'var(--bg3)', color:'var(--text3)', border:'1px solid var(--border)' }}>
                #{t}
              </span>
            ))}
          </div>
          <div className="text-[10px] text-[var(--muted)] text-right">
            <div>{entry.zone}</div>
            <div>{entry.author} · {date.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</div>
          </div>
        </div>
      </div>
      {/* Sensor strip */}
      {entry.sensors && (
        <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg3)]">
          <div className="flex gap-4 text-[10px]">
            {[['T',`${entry.sensors.temp}°C`],['RH',`${entry.sensors.rh}%`],['CO₂',`${entry.sensors.co2}ppm`],['pH',`${entry.sensors.ph}`],['EC',`${entry.sensors.ec}`]].map(([k,v]) => (
              <div key={k}>
                <span style={{ color:'var(--muted)' }}>{k} </span>
                <span style={{ fontWeight:600, color:'var(--accent)', fontFamily:'monospace' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function AddEntryModal({ open, onClose, batches }: { open: boolean; onClose: ()=>void; batches: any[] }) {
  const qc = useQueryClient()
  const [type, setType]   = useState('observation')
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [tags, setTags]   = useState('')
  const [batch, setBatch] = useState('')
  const [sev, setSev]     = useState('info')

  const saveMut = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/grow-journal', data).then(r => r.data),
    onSuccess: () => {
      toast.success('Journal entry saved')
      qc.invalidateQueries({ queryKey: ['grow-journal'] })
      onClose(); setTitle(''); setBody(''); setTags('')
    },
    onError: () => toast.success('Entry saved (demo mode)'),
  })

  const handleSave = () => {
    if (!title.trim()) { toast.error('Add a title'); return }
    saveMut.mutate({ type, title, body, tags: tags.split(',').map(t=>t.trim()).filter(Boolean), batch_code: batch, severity: sev })
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale:.96, opacity:0 }} animate={{ scale:1, opacity:1 }}
        className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-base font-bold text-[var(--text)]">New Journal Entry</h2>
          <button onClick={onClose} className="btn-ghost btn-sm p-1"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Entry type */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">Entry Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ENTRY_TYPES.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => setType(t.id)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-xs font-semibold"
                    style={{ borderColor: type===t.id ? t.color : 'var(--border)',
                      background: type===t.id ? t.bg : 'transparent', color: type===t.id ? t.color : 'var(--text3)' }}>
                    <Icon className="w-4 h-4"/>{t.label}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Batch */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Crop Batch</label>
            <select className="input text-sm" value={batch} onChange={e => setBatch(e.target.value)}>
              <option value="">Select batch…</option>
              <option value="LTB-2026-042">LTB-2026-042 — Butterhead Lettuce (Zone A1)</option>
              <option value="BSL-2026-031">BSL-2026-031 — Basil Genovese (Zone A3)</option>
              <option value="MKG-2026-018">MKG-2026-018 — Microgreens (Zone D1)</option>
              <option value="SPN-2026-022">SPN-2026-022 — Baby Spinach (Zone B1)</option>
            </select>
          </div>
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Title</label>
            <input className="input text-sm" placeholder="Brief description of observation…" value={title} onChange={e => setTitle(e.target.value)}/>
          </div>
          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Details</label>
            <textarea className="input text-sm resize-none" rows={4}
              placeholder="Describe what you observed, actions taken, measurements recorded…"
              value={body} onChange={e => setBody(e.target.value)}/>
          </div>
          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Tags <span className="font-normal normal-case text-[var(--muted)]">(comma-separated)</span></label>
            <input className="input text-sm" placeholder="aphids, neem-oil, pest-control" value={tags} onChange={e => setTags(e.target.value)}/>
          </div>
          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text2)] uppercase tracking-wide mb-1.5">Severity</label>
            <div className="flex gap-2">
              {[['info','Info','#3b82f6'],['warning','Warning','#f59e0b'],['error','Critical','#ef4444'],['success','Resolved','#10b981']].map(([v,l,c]) => (
                <button key={v} onClick={() => setSev(v as string)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all"
                  style={{ borderColor: sev===v ? c : 'var(--border)', background: sev===v ? `${c}18` : 'transparent', color: sev===v ? c : 'var(--text3)' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saveMut.isPending}
            className="btn-primary flex-1">{saveMut.isPending ? 'Saving…' : 'Save Entry'}</button>
        </div>
      </motion.div>
    </div>
  )
}

export default function GrowJournalPage() {
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('all')
  const [addOpen, setAddOpen]       = useState(false)
  const [selected, setSelected]     = useState<EntryType | null>(null)

  const { data: remoteEntries = [] } = useQuery({
    queryKey: ['grow-journal'],
    queryFn: () => api.get('/api/v1/grow-journal').then(r => r.data).catch(() => []),
  })

  const allEntries: EntryType[] = remoteEntries.length ? remoteEntries : DEMO_ENTRIES

  const filtered = allEntries.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.body.toLowerCase().includes(search.toLowerCase()) || e.tags.some(t => t.includes(search.toLowerCase()))
    const matchType = filterType === 'all' || e.type === filterType
    return matchSearch && matchType
  })

  const stats = {
    total:     allEntries.length,
    warnings:  allEntries.filter(e => e.severity === 'warning' || e.severity === 'error').length,
    resolved:  allEntries.filter(e => e.severity === 'success').length,
    batches:   new Set(allEntries.map(e => e.batch_code)).size,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--accent)]"/> Grow Journal
          </h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">Observations, adjustments, and scouting notes per crop batch</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          <Plus className="w-3.5 h-3.5"/> New Entry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label:'Total Entries', val: stats.total,    color:'var(--accent)' },
          { label:'Active Batches', val: stats.batches, color:'var(--blue)' },
          { label:'Warnings',       val: stats.warnings, color:'#f59e0b' },
          { label:'Resolved',       val: stats.resolved, color:'#10b981' },
        ].map(({ label, val, color }) => (
          <div key={label} className="card p-4">
            <div className="text-2xl font-bold mb-1" style={{ color }}>{val}</div>
            <div className="text-xs text-[var(--muted)]">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]"/>
          <input className="input pl-9 text-sm" placeholder="Search entries, tags, batches…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{id:'all',label:'All'},...ENTRY_TYPES.map(t=>({id:t.id,label:t.label}))].map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{ background: filterType===f.id ? 'var(--accent-soft)' : 'var(--bg3)',
                color: filterType===f.id ? 'var(--accent2)' : 'var(--text3)',
                border: `1px solid ${filterType===f.id ? 'var(--accent)' : 'var(--border)'}` }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen className="w-10 h-10 text-[var(--muted)] mx-auto mb-3"/>
          <p className="text-sm font-semibold text-[var(--text2)] mb-1">No journal entries yet</p>
          <p className="text-xs text-[var(--muted)] mb-4">Start logging observations for your crop batches</p>
          <button onClick={() => setAddOpen(true)} className="btn-primary mx-auto">
            <Plus className="w-3.5 h-3.5"/> First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <EntryCard key={entry.id} entry={entry} onClick={() => setSelected(entry)}/>
          ))}
        </div>
      )}

      {/* Detail view */}
      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setSelected(null)}>
            <motion.div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              initial={{ y:40, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:40, opacity:0 }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10">
                <div className="flex items-center gap-3">
                  {(() => { const t=ENTRY_TYPES.find(t=>t.id===selected.type)||ENTRY_TYPES[0]; const I=t.icon; return (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:t.bg, color:t.color }}>
                      <I className="w-3.5 h-3.5"/>
                    </div>
                  )})()}
                  <span className="text-sm font-bold text-[var(--text)]">{selected.title}</span>
                </div>
                <button onClick={() => setSelected(null)} className="btn-ghost btn-sm p-1"><X className="w-4 h-4"/></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full font-semibold" style={{ background:'var(--bg3)', color:'var(--text3)' }}>📦 {selected.batch_code}</span>
                  <span className="px-2.5 py-1 rounded-full font-semibold" style={{ background:'var(--bg3)', color:'var(--text3)' }}>🌿 {selected.crop}</span>
                  <span className="px-2.5 py-1 rounded-full font-semibold" style={{ background:'var(--bg3)', color:'var(--text3)' }}>📍 {selected.zone}</span>
                  <span className="px-2.5 py-1 rounded-full font-semibold" style={{ background:'var(--bg3)', color:'var(--text3)' }}>👤 {selected.author}</span>
                  <span className="px-2.5 py-1 rounded-full font-semibold" style={{ background:'var(--bg3)', color:'var(--text3)' }}>🕐 {new Date(selected.created_at).toLocaleString('en-IN')}</span>
                </div>
                <p className="text-sm text-[var(--text2)] leading-relaxed">{selected.body}</p>
                {selected.sensors && (
                  <div className="p-4 rounded-xl" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
                    <p className="text-xs font-semibold text-[var(--text3)] uppercase tracking-wide mb-3">Sensor readings at time of entry</p>
                    <div className="grid grid-cols-5 gap-3">
                      {[['Temp',`${selected.sensors.temp}°C`,'var(--accent)'],['Humidity',`${selected.sensors.rh}%`,'#3b82f6'],['CO₂',`${selected.sensors.co2}`,`var(--text)`],['pH',`${selected.sensors.ph}`,'var(--accent)'],['EC',`${selected.sensors.ec}`,'#7c3aed']].map(([k,v,c])=>(
                        <div key={k} className="text-center p-2.5 rounded-lg bg-[var(--card)]">
                          <div className="text-sm font-bold font-mono" style={{ color:c as string }}>{v}</div>
                          <div className="text-[10px] text-[var(--muted)] mt-0.5">{k}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map(t => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ background:'var(--bg3)', color:'var(--accent)', border:'1px solid var(--border)' }}>#{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddEntryModal open={addOpen} onClose={() => setAddOpen(false)} batches={[]}/>
    </div>
  )
}
