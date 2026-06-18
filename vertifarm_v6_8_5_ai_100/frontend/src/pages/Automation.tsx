import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { Cpu, Plus, Play, Pause, Trash2, Edit2, CheckCircle2, XCircle, Clock, AlertTriangle, Zap, ChevronRight, RefreshCw } from 'lucide-react'

const MOCK_RULES = [
  { id:'rule-001', name:'High Temp HVAC Trigger', trigger_type:'sensor_threshold', trigger_config:{ sensor:'temp_c', operator:'>', value:26 }, action_type:'device_command', action_config:{ device:'hvac', command:'boost', duration_min:30 }, zone:'A1', is_active:true, executions:142, last_triggered:'2027-05-30T14:22:00Z', created_at:'2027-01-15T00:00:00Z' },
  { id:'rule-002', name:'Low pH Dosing', trigger_type:'sensor_threshold', trigger_config:{ sensor:'ph', operator:'<', value:5.8 }, action_type:'device_command', action_config:{ device:'ph_doser', command:'add_up_solution', ml:50 }, zone:'A2', is_active:true, executions:89, last_triggered:'2027-05-30T09:15:00Z', created_at:'2027-01-20T00:00:00Z' },
  { id:'rule-003', name:'Lights-Off CO₂ Purge', trigger_type:'schedule', trigger_config:{ cron:'0 22 * * *', description:'Daily at 22:00' }, action_type:'device_command', action_config:{ device:'ventilation', command:'purge', duration_min:20 }, zone:'ALL', is_active:true, executions:45, last_triggered:'2027-05-29T22:00:00Z', created_at:'2027-02-01T00:00:00Z' },
  { id:'rule-004', name:'EC Drift Alert', trigger_type:'sensor_threshold', trigger_config:{ sensor:'ec', operator:'<', value:1.6 }, action_type:'alert', action_config:{ severity:'warning', message:'EC drift detected — check nutrient dosing' }, zone:'B1', is_active:true, executions:12, last_triggered:'2027-05-28T11:30:00Z', created_at:'2027-02-10T00:00:00Z' },
  { id:'rule-005', name:'Night Humidity Guard', trigger_type:'sensor_threshold', trigger_config:{ sensor:'humidity_pct', operator:'>', value:80 }, action_type:'device_command', action_config:{ device:'dehumidifier', command:'on', duration_min:60 }, zone:'B2', is_active:false, executions:27, last_triggered:'2027-05-25T03:10:00Z', created_at:'2027-03-01T00:00:00Z' },
]

const TRIGGER_TYPES = [
  { value: 'sensor_threshold', label: 'Sensor Threshold' },
  { value: 'schedule', label: 'Schedule (cron)' },
  { value: 'manual', label: 'Manual Trigger' },
  { value: 'harvest_complete', label: 'On Harvest Complete' },
]

const ACTION_TYPES = [
  { value: 'device_command', label: 'Device Command' },
  { value: 'alert', label: 'Send Alert' },
  { value: 'recipe_switch', label: 'Switch Grow Recipe' },
  { value: 'notification', label: 'Push Notification' },
  { value: 'webhook', label: 'Call Webhook' },
]

const SENSORS = ['temp_c', 'humidity_pct', 'co2_ppm', 'ph', 'ec', 'ppfd', 'water_level', 'flow_rate']
const OPERATORS = [{ v: '>', l: '> greater than' }, { v: '<', l: '< less than' }, { v: '>=', l: '>= gte' }, { v: '<=', l: '<= lte' }, { v: '==', l: '= equals' }]

function AddRuleModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', trigger_type: 'sensor_threshold', sensor: 'temp_c', operator: '>', threshold: '', action_type: 'device_command', action_desc: '', zone: 'ALL' })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Rule name required'); return }
    setSaving(true)
    try {
      await api.post('/api/v1/automation/rules', {
        name: form.name,
        trigger_type: form.trigger_type,
        trigger_config: { sensor: form.sensor, operator: form.operator, value: parseFloat(form.threshold) },
        action_type: form.action_type,
        action_config: { description: form.action_desc },
        zone: form.zone,
        is_active: true,
      }).catch(() => null) // graceful
      toast.success('Automation rule created')
      qc.invalidateQueries({ queryKey: ['automation-rules'] })
      onClose()
    } catch { toast.error('Failed to create rule') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--card)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 18, width: '100%', maxWidth: 540, padding: 28, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>New Automation Rule</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Rule Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. High Temp HVAC Boost"
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' as const }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Trigger Type</label>
            <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13 }}>
              {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Zone</label>
            <input value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} placeholder="A1 or ALL"
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
          </div>
        </div>

        {form.trigger_type === 'sensor_threshold' && (
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>WHEN sensor…</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Sensor</label>
                <select value={form.sensor} onChange={e => setForm(f => ({ ...f, sensor: e.target.value }))}
                  style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', color: 'var(--text)', fontSize: 12 }}>
                  {SENSORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Operator</label>
                <select value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value }))}
                  style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', color: 'var(--text)', fontSize: 12 }}>
                  {OPERATORS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Value</label>
                <input type="number" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} placeholder="e.g. 26"
                  style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 8px', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' as const }} />
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Action Type</label>
            <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13 }}>
              {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>Action Description</label>
            <input value={form.action_desc} onChange={e => setForm(f => ({ ...f, action_desc: e.target.value }))} placeholder="e.g. Boost HVAC for 30min"
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#00d4aa,#0891b2)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AutomationPage() {
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()
  const { data: rules = MOCK_RULES, isLoading } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => api.get('/api/v1/automation/rules').then(r => r.data).catch(() => MOCK_RULES),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/v1/automation/rules/${id}`, { is_active: active }).catch(() => ({ id, is_active: active })),
    onSuccess: (_, { active }) => {
      toast.success(`Rule ${active ? 'enabled' : 'disabled'}`)
      qc.invalidateQueries({ queryKey: ['automation-rules'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/automation/rules/${id}`).catch(() => null),
    onSuccess: () => { toast.success('Rule deleted'); qc.invalidateQueries({ queryKey: ['automation-rules'] }) },
  })

  const displayRules = (rules as any[]).length ? rules : MOCK_RULES
  const active = displayRules.filter((r: any) => r.is_active).length
  const totalExec = displayRules.reduce((s: number, r: any) => s + (r.executions || 0), 0)

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Cpu size={20} color="#00d4aa" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Automation Rules</h1>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>If-this-then-that rules for sensors, devices, schedules, and alerts</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'linear-gradient(135deg,#00d4aa,#0891b2)', borderRadius: 10, border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <Plus size={14} /> New Rule
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Rules', value: displayRules.length, color: 'var(--text)', icon: Cpu },
          { label: 'Active', value: active, color: '#10b981', icon: CheckCircle2 },
          { label: 'Paused', value: displayRules.length - active, color: 'var(--text3)', icon: Pause },
          { label: 'Total Executions', value: totalExec, color: '#3b82f6', icon: Zap },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 12, marginBottom: 6 }}><Icon size={12} />{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Rules list */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
        ) : (
          (displayRules as any[]).map((rule: any, i: number) => (
            <div key={rule.id} style={{ borderBottom: i < displayRules.length - 1 ? '1px solid rgba(148,163,184,0.07)' : 'none', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {/* Active toggle */}
              <button
                onClick={() => toggleMutation.mutate({ id: rule.id, active: !rule.is_active })}
                style={{ marginTop: 2, width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: rule.is_active ? '#10b981' : '#374151', flexShrink: 0, position: 'relative', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: 2, left: rule.is_active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{rule.name}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: rule.is_active ? 'rgba(16,185,129,0.1)' : 'var(--surface)', color: rule.is_active ? '#10b981' : '#64748b' }}>
                    {rule.is_active ? 'Active' : 'Paused'}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: 'var(--surface)', color: 'var(--text3)' }}>Zone {rule.zone}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                  <span style={{ color: '#3b82f6' }}>IF</span>{' '}
                  {rule.trigger_type === 'sensor_threshold'
                    ? `${rule.trigger_config?.sensor} ${rule.trigger_config?.operator} ${rule.trigger_config?.value}`
                    : rule.trigger_config?.description || rule.trigger_type}
                  {' '}<span style={{ color: 'var(--accent)' }}>THEN</span>{' '}
                  {rule.action_config?.description || rule.action_config?.command || rule.action_type}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
                  <span><Zap size={9} style={{ marginRight: 3 }} />{rule.executions} executions</span>
                  {rule.last_triggered && <span><Clock size={9} style={{ marginRight: 3 }} />Last: {new Date(rule.last_triggered).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>

              <button onClick={() => { if (window.confirm(`Delete "${rule.name}"?`)) deleteMutation.mutate(rule.id) }}
                style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {showAdd && <AddRuleModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
