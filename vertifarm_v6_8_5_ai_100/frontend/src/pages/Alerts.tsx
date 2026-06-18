import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertsApi } from '@/lib/api'
import { Badge, Button, StatCard, EmptyState, Modal, Input, Select, Textarea } from '@/components/ui'
import { AlertTriangle, CheckCircle2, Filter, X, Plus, Bell, Phone, Mail, MessageSquare, Clock } from 'lucide-react'
import { relativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

const DEMO = [
  { id:'1', severity:'critical', category:'Irrigation', title:'Zone B2 — Pump failure detected', message:'Primary pump offline. Flow rate 0 L/min. Backup pump auto-triggered.', is_resolved:false, created_at:new Date(Date.now()-2*60000).toISOString() },
  { id:'2', severity:'warning',  category:'Climate',    title:'Zone A3 — High Humidity (91.3%)', message:'RH at 91.3% exceeds Basil threshold of 75%. Dehumidifier activated.', is_resolved:false, created_at:new Date(Date.now()-14*60000).toISOString() },
  { id:'3', severity:'warning',  category:'Fertigation',title:'Pune — EC drift detected', message:'Nutrient tank EC drifting from 2.1 to 1.6 mS/cm. Auto dosing queued.', is_resolved:false, created_at:new Date(Date.now()-31*60000).toISOString() },
  { id:'4', severity:'warning',  category:'CV Alert',   title:'Zone C3 — Early leaf curl pattern', message:'Computer vision detected early leaf curl on Strawberry. AI suspects Ca deficiency.', is_resolved:false, created_at:new Date(Date.now()-72*60000).toISOString() },
  { id:'5', severity:'info',     category:'Energy',     title:'Mumbai — Lighting Circuit 4 spike', message:'Circuit 4 drawing +18% above baseline. Investigating LED driver.', is_resolved:false, created_at:new Date(Date.now()-160*60000).toISOString() },
  { id:'6', severity:'info',     category:'Automation', title:'Zone D1 — CO₂ cycle completed', message:'CO₂ enrichment cycle completed successfully. Level stabilized at 1,180 ppm.', is_resolved:true, created_at:new Date(Date.now()-3*3600000).toISOString() },
]

const SEV_BADGE: Record<string,any> = { critical:'red', warning:'amber', info:'blue' }

const CATEGORIES = ['Irrigation','Climate','Fertigation','CV Alert','Energy','Automation','Nutrient','Pest','Harvest']
const SEVERITIES  = ['critical','warning','info']

// Create Alert Modal
function CreateAlertModal({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title:'', severity:'warning', category:'Climate', message:'' })
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k:string,v:string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>{const n={...e};delete n[k];return n}) }

  const handleSubmit = async () => {
    const e: Record<string,string> = {}
    if (!form.title.trim()) e.title = 'Title required'
    if (!form.message.trim()) e.message = 'Message required'
    setErrors(e); if (Object.keys(e).length) return
    setLoading(true)
    try {
      await alertsApi.create(form)
      qc.invalidateQueries({ queryKey:['alerts'] })
      toast.success('Alert created')
      setForm({ title:'', severity:'warning', category:'Climate', message:'' })
      onClose()
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Failed to create alert') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Manual Alert" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={loading} onClick={handleSubmit}>Create Alert</Button></>}>
      <div className="space-y-4">
        <Input label="Alert Title *" placeholder="e.g. Zone A1 — pH out of range" value={form.title} onChange={e=>set('title',e.target.value)} error={errors.title}/>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Severity" options={SEVERITIES.map(s=>({value:s,label:s.charAt(0).toUpperCase()+s.slice(1)}))} value={form.severity} onChange={e=>set('severity',e.target.value)}/>
          <Select label="Category" options={CATEGORIES.map(c=>({value:c,label:c}))} value={form.category} onChange={e=>set('category',e.target.value)}/>
        </div>
        <Textarea label="Message *" placeholder="Describe the issue in detail…" value={form.message} onChange={e=>set('message',e.target.value)} error={errors.message} rows={3}/>
      </div>
    </Modal>
  )
}

// Alert Rules Modal
function AlertRulesModal({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const [rules, setRules] = useState([
    { id:'r1', name:'High Humidity', metric:'humidity', operator:'>', value:'85', severity:'warning', enabled:true, zones:'All zones' },
    { id:'r2', name:'Pump Failure', metric:'flow_rate', operator:'<', value:'0.5', severity:'critical', enabled:true, zones:'All zones' },
    { id:'r3', name:'pH Too Low', metric:'ph', operator:'<', value:'5.5', severity:'critical', enabled:true, zones:'All zones' },
    { id:'r4', name:'High EC', metric:'ec', operator:'>', value:'3.5', severity:'warning', enabled:false, zones:'Zone A1, A2' },
  ])

  const toggle = (id:string) => setRules(rs => rs.map(r => r.id===id ? {...r,enabled:!r.enabled} : r))

  return (
    <Modal open={open} onClose={onClose} title="Alert Rules & Thresholds" size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" onClick={()=>{toast.success('Rules saved');onClose()}}>Save Rules</Button></>}>
      <div className="space-y-3">
        <p className="text-xs text-muted">Configure automatic alert rules based on sensor thresholds.</p>
        {rules.map(rule => (
          <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-xl border ${rule.enabled?'border-[var(--border)] bg-[var(--bg3)]':'border-[var(--border)] opacity-50'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[var(--text)]">{rule.name}</span>
                <Badge variant={rule.severity==='critical'?'red':'amber'}>{rule.severity}</Badge>
              </div>
              <div className="text-[10px] text-muted font-mono">
                {rule.metric} {rule.operator} {rule.value} · {rule.zones}
              </div>
            </div>
            <button onClick={() => toggle(rule.id)}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${rule.enabled?'bg-[var(--accent)]':'bg-slate-200'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${rule.enabled?'left-5':'left-1'}`}/>
            </button>
          </div>
        ))}
        <button className="w-full text-xs btn-secondary btn-sm flex items-center justify-center gap-1.5">
          <Plus className="w-3.5 h-3.5"/> Add Rule
        </button>
      </div>
    </Modal>
  )
}

// Notification Channels Modal
function NotifChannelsModal({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const [channels, setChannels] = useState([
    { id:'c1', type:'email', label:'Email', icon:'mail', value:'farm@company.com', enabled:true, forSeverity:['critical','warning'] },
    { id:'c2', type:'sms', label:'SMS', icon:'phone', value:'+91-98765-43210', enabled:true, forSeverity:['critical'] },
    { id:'c3', type:'whatsapp', label:'WhatsApp', icon:'message', value:'+91-98765-43210', enabled:false, forSeverity:['critical','warning'] },
    { id:'c4', type:'slack', label:'Slack', icon:'bell', value:'#farm-alerts', enabled:false, forSeverity:['critical','warning','info'] },
  ])
  const toggle = (id:string) => setChannels(cs => cs.map(c => c.id===id ? {...c,enabled:!c.enabled} : c))

  return (
    <Modal open={open} onClose={onClose} title="Notification Channels" size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={()=>{toast.success('Channels saved');onClose()}}>Save</Button></>}>
      <div className="space-y-3">
        {channels.map(ch => (
          <div key={ch.id} className={`flex items-center gap-3 p-3 rounded-xl border ${ch.enabled?'border-[var(--accent-soft)] bg-[var(--accent-soft)]':'border-[var(--border)]'}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'var(--bg3)'}}>
              {ch.type==='email'?<Mail className="w-4 h-4 text-muted"/>:ch.type==='sms'?<Phone className="w-4 h-4 text-muted"/>:ch.type==='whatsapp'?<MessageSquare className="w-4 h-4 text-muted"/>:<Bell className="w-4 h-4 text-muted"/>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--text)]">{ch.label}</div>
              <div className="text-[10px] text-muted truncate">{ch.value}</div>
              <div className="flex gap-1 mt-1">
                {ch.forSeverity.map(s => <Badge key={s} variant={s==='critical'?'red':s==='warning'?'amber':'blue'}>{s}</Badge>)}
              </div>
            </div>
            <button onClick={() => toggle(ch.id)}
              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${ch.enabled?'bg-[var(--accent)]':'bg-slate-200'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${ch.enabled?'left-5':'left-1'}`}/>
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default function AlertsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [showResolved, setShowResolved] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [showChannels, setShowChannels] = useState(false)
  const [expandedId, setExpandedId] = useState<string|null>(null)

  const { data: alerts = DEMO } = useQuery({
    queryKey:['alerts', showResolved],
    queryFn:()=>alertsApi.list({ resolved:showResolved })
  })

  const resolve = useMutation({
    mutationFn: (id:string) => alertsApi.resolve(id),
    onSuccess: () => { qc.invalidateQueries({queryKey:['alerts']}); toast.success('Alert resolved') },
    onError: (err:any) => toast.error(err?.response?.data?.detail || 'Failed to resolve'),
  })

  const all = (alerts as any[]).length ? alerts as any[] : DEMO
  const visible = all.filter((a:any)=>{
    if (!showResolved && a.is_resolved) return false
    if (filter !== 'all' && a.severity !== filter) return false
    return true
  })

  const counts = {
    critical: all.filter((a:any)=>a.severity==='critical'&&!a.is_resolved).length,
    warning: all.filter((a:any)=>a.severity==='warning'&&!a.is_resolved).length,
    info: all.filter((a:any)=>a.severity==='info'&&!a.is_resolved).length,
    resolved: all.filter((a:any)=>a.is_resolved).length,
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Alerts & Notifications</h1>
          <p className="text-xs text-muted mt-0.5">{counts.critical} critical · {counts.warning} warnings · {counts.info} info</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" onClick={()=>setShowChannels(true)}>
            <Bell className="w-3.5 h-3.5"/> Channels
          </Button>
          <Button variant="secondary" onClick={()=>setShowRules(true)}>
            <Filter className="w-3.5 h-3.5"/> Alert Rules
          </Button>
          <Button variant="secondary" onClick={()=>setShowResolved(s=>!s)}>
            {showResolved?'Hide resolved':'Show resolved'}
          </Button>
          <Button variant="primary" onClick={()=>setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5"/> Create Alert
          </Button>
          <Button variant="danger" onClick={()=>{
            all.filter((a:any)=>!a.is_resolved).forEach((a:any)=>resolve.mutate(a.id))
            toast.success('All alerts acknowledged')
          }}>
            <CheckCircle2 className="w-3.5 h-3.5"/> Acknowledge All
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Critical',count:counts.critical,accent:'red',sev:'critical'},
          {label:'Warnings',count:counts.warning,accent:'amber',sev:'warning'},
          {label:'Info',count:counts.info,accent:'blue',sev:'info'},
          {label:'Resolved Today',count:counts.resolved,accent:'green',sev:'resolved'},
        ].map(({label,count,accent,sev})=>(
          <div key={label} onClick={()=>setFilter(sev==='resolved'?'all':sev)}
            className={`card p-4 cursor-pointer transition-all hover:border-[var(--border2)] ${filter===sev?'border-[var(--accent)] bg-[var(--accent-soft)]':''}`}>
            <div className="text-xs text-muted mb-1">{label}</div>
            <div className={`text-2xl font-bold text-[var(--${accent}-light)]`}>{count}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted"/>
        {(['all','critical','warning','info'] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-md border capitalize transition-all ${
              filter===f ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
              : 'border-[var(--border)] text-muted hover:text-[var(--text)]'}`}>
            {f}
          </button>
        ))}
        <div className="ml-auto text-[10px] text-muted flex items-center gap-1">
          <Clock className="w-3 h-3"/> Auto-refreshing
        </div>
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {visible.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="All clear!" message="No alerts match the current filter."/>
        ) : visible.map((a:any)=>(
          <div key={a.id} className={`card transition-all ${
            a.severity==='critical' ? 'border-red-200' :
            a.severity==='warning'  ? 'border-amber-200' : ''}`}>
            <div className="flex items-start gap-3 p-4">
              <span className={`dot mt-1 flex-shrink-0 ${
                a.severity==='critical'?'dot-red':a.severity==='warning'?'dot-amber':'dot-blue'}`}/>
              <div className="flex-1 min-w-0">
                <button className="w-full text-left" onClick={() => setExpandedId(expandedId===a.id?null:a.id)}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-[var(--text)]">{a.title}</span>
                    <Badge variant={SEV_BADGE[a.severity]??'gray'}>{a.severity}</Badge>
                    <Badge variant="gray">{a.category}</Badge>
                    {a.is_resolved && <Badge variant="green">Resolved</Badge>}
                  </div>
                  <p className="text-xs text-muted">{a.message}</p>
                  <div className="text-[10px] text-muted mt-1.5">{relativeTime(a.created_at)}</div>
                </button>

                {/* Expanded actions */}
                {expandedId === a.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="p-2 rounded-lg bg-[var(--bg3)]">
                        <div className="text-muted mb-0.5">Zone</div>
                        <div className="font-semibold text-[var(--text)]">{a.category === 'Irrigation' ? 'Zone B2' : a.category === 'Climate' ? 'Zone A3' : 'Pune Farm'}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--bg3)]">
                        <div className="text-muted mb-0.5">Triggered</div>
                        <div className="font-semibold text-[var(--text)]">{new Date(a.created_at).toLocaleTimeString()}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--bg3)]">
                        <div className="text-muted mb-0.5">Auto-action</div>
                        <div className={`font-semibold ${a.severity==='critical'?'text-[var(--red-light)]':'text-[var(--green-light)]'}`}>
                          {a.severity==='critical'?'Triggered':'None'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary btn-sm text-xs flex-1" onClick={() => toast.success('Escalated to manager')}>
                        Escalate
                      </button>
                      <button className="btn-secondary btn-sm text-xs flex-1" onClick={() => toast.success('Note added')}>
                        Add Note
                      </button>
                      <button className="btn-secondary btn-sm text-xs flex-1" onClick={() => toast.success('Snooze for 1 hour')}>
                        Snooze 1h
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {!a.is_resolved && (
                <button onClick={()=>resolve.mutate(a.id)} disabled={resolve.isPending}
                  className="btn-success btn-sm flex-shrink-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5"/> Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CreateAlertModal open={showCreate} onClose={()=>setShowCreate(false)}/>
      <AlertRulesModal open={showRules} onClose={()=>setShowRules(false)}/>
      <NotifChannelsModal open={showChannels} onClose={()=>setShowChannels(false)}/>
    </div>
  )
}
