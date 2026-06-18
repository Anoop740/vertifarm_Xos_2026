import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { devicesApi, farmsApi, zonesApi } from '@/lib/api'
import { Button, Badge, Modal, Input, Select, StatCard, EmptyState } from '@/components/ui'
import { Cpu, Plus, RefreshCw, Wifi, WifiOff, AlertCircle, Settings, Eye, Info } from 'lucide-react'
import { relativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const DEVICE_TYPES = [
  { value:'temperature_humidity', label:'Temp / Humidity Sensor' },
  { value:'co2',                  label:'CO₂ Sensor' },
  { value:'ph_ec',                label:'pH + EC Controller' },
  { value:'ppfd',                 label:'PPFD / Light Sensor' },
  { value:'flow',                 label:'Flow Rate Sensor' },
  { value:'pressure',             label:'Pressure Sensor' },
  { value:'dissolved_oxygen',     label:'Dissolved Oxygen Sensor' },
  { value:'water_level',          label:'Water Level Sensor' },
  { value:'water_temp',           label:'Water Temperature Sensor' },
  { value:'drain_ec',             label:'Drain / Return EC Sensor' },
  { value:'vpd',                  label:'VPD Sensor' },
  { value:'gateway',              label:'IoT Gateway' },
  { value:'pump_controller',      label:'Pump Controller' },
  { value:'lighting_controller',  label:'Lighting Controller' },
  { value:'hvac_controller',      label:'HVAC Controller' },
  { value:'dosing_pump',          label:'Dosing Pump' },
  { value:'actuator',             label:'Actuator / Relay' },
  { value:'camera',               label:'RGB / Hyperspectral Camera' },
  { value:'plc',                  label:'PLC Controller' },
]

const PROTOCOLS = [
  { value:'mqtt',    label:'MQTT' },
  { value:'modbus',  label:'Modbus RTU/TCP' },
  { value:'bacnet',  label:'BACnet' },
  { value:'opcua',   label:'OPC-UA' },
  { value:'lorawan', label:'LoRaWAN' },
  { value:'zigbee',  label:'Zigbee' },
  { value:'ble',     label:'Bluetooth LE' },
  { value:'http',    label:'HTTP / REST' },
]

const STATUS_BADGE: Record<string, any> = { online:'green', offline:'gray', error:'red', maintenance:'amber' }

function RegisterDeviceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:'', device_type:'temperature_humidity', device_uid:'',
    farm_id:'', zone_id:'', protocol:'mqtt',
    ip_address:'', firmware_version:'', mac_address:'',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const { data: farms = [] } = useQuery({ queryKey:['farms'], queryFn: farmsApi.list })
  const { data: zones = [] } = useQuery({
    queryKey: ['zones', form.farm_id],
    queryFn: () => zonesApi.list(form.farm_id),
    enabled: !!form.farm_id,
  })

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
    if (k === 'farm_id') setForm(f => ({ ...f, farm_id: v, zone_id: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())       e.name = 'Device name required'
    if (!form.device_uid.trim()) e.device_uid = 'Device UID required'
    if (!form.device_type)       e.device_type = 'Select device type'
    if (!form.farm_id)           e.farm_id = 'Select a farm'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        device_type: form.device_type,
        device_uid: form.device_uid.trim(),
        farm_id: form.farm_id,
        zone_id: form.zone_id || undefined,
        protocol: form.protocol,
        ip_address: form.ip_address || undefined,
        mac_address: form.mac_address || undefined,
        firmware_version: form.firmware_version || undefined,
        config: {},
      }
      await devicesApi.create(payload)
      qc.invalidateQueries({ queryKey: ['devices'] })
      toast.success(`Device "${form.name}" registered successfully`)
      onClose()
      setForm({ name:'', device_type:'temperature_humidity', device_uid:'', farm_id:'', zone_id:'', protocol:'mqtt', ip_address:'', firmware_version:'', mac_address:'' })
      setErrors({})
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to register device'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setForm({ name:'', device_type:'temperature_humidity', device_uid:'', farm_id:'', zone_id:'', protocol:'mqtt', ip_address:'', firmware_version:'', mac_address:'' })
    setErrors({})
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Register New Device" size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>Register Device</Button>
        </>
      }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Device Name *" placeholder="e.g. A1 Temperature Sensor"
            value={form.name} onChange={e => set('name', e.target.value)} error={errors.name}/>
          <Input label="Device UID *" placeholder="e.g. VF-DHF-A1-THU-001"
            value={form.device_uid} onChange={e => set('device_uid', e.target.value)} error={errors.device_uid}/>
        </div>

        <Select label="Device Type *" options={DEVICE_TYPES}
          value={form.device_type} onChange={e => set('device_type', e.target.value)} error={errors.device_type}/>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Farm *"
            options={[{ value:'', label:'Select farm...' }, ...(farms as any[]).map((f:any) => ({ value: f.id, label: `${f.name} (${f.type})` }))]}
            value={form.farm_id} onChange={e => { setForm(f => ({ ...f, farm_id: e.target.value, zone_id:'' })); if(errors.farm_id) setErrors(er => { const n={...er}; delete n.farm_id; return n }) }}
            error={errors.farm_id}/>
          <Select label="Assign to Zone"
            options={[{ value:'', label: form.farm_id ? '— Farm-level device —' : 'Select farm first' }, ...(zones as any[]).map((z:any) => ({ value: z.id, label: `${z.code} — ${z.name}` }))]}
            value={form.zone_id} onChange={e => set('zone_id', e.target.value)}/>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select label="Protocol" options={PROTOCOLS}
            value={form.protocol} onChange={e => set('protocol', e.target.value)}/>
          <Input label="IP Address" placeholder="192.168.1.100"
            value={form.ip_address} onChange={e => set('ip_address', e.target.value)}/>
          <Input label="Firmware Version" placeholder="2.4.1"
            value={form.firmware_version} onChange={e => set('firmware_version', e.target.value)}/>
        </div>

        <Input label="MAC Address" placeholder="AA:BB:CC:DD:EE:FF"
          value={form.mac_address} onChange={e => set('mac_address', e.target.value)}/>

        <div className="flex items-start gap-2 p-3 rounded-xl text-[11px]"
          style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
          <Info className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5"/>
          <span className="text-muted">Device UID must be unique across all farms. Use format: <strong className="text-[var(--text)] font-mono">FARM_CODE-ZONE_CODE-TYPE-001</strong></span>
        </div>
      </div>
    </Modal>
  )
}

export default function DevicesPage() {
  const qc = useQueryClient()
  const [showRegister, setShowRegister] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const { data: rawDevices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.list(),
  })

  const devices = rawDevices as any[]
  const visible = devices.filter((d: any) => {
    if (filter !== 'all' && d.status !== filter && d.device_type !== filter) return false
    if (search && !d.name?.toLowerCase().includes(search.toLowerCase()) && !d.device_uid?.includes(search)) return false
    return true
  })

  const online = devices.filter((d:any) => d.status === 'online').length
  const offline = devices.filter((d:any) => d.status === 'offline').length
  const errors  = devices.filter((d:any) => d.status === 'error').length

  const statusIcon = (s: string) =>
    s === 'online' ? <Wifi className="w-3.5 h-3.5 text-[var(--green-light)]"/> :
    s === 'error'  ? <AlertCircle className="w-3.5 h-3.5 text-[var(--red-light)]"/> :
    <WifiOff className="w-3.5 h-3.5 text-muted"/>

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Device Management</h1>
          <p className="text-xs text-muted mt-0.5">
            {devices.length} registered · {online} online · {offline} offline · {errors} errors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey:['devices'] })}>
            <RefreshCw className="w-3.5 h-3.5"/> Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowRegister(true)}>
            <Plus className="w-3.5 h-3.5"/> Register Device
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Devices" value={devices.length} icon={Cpu} accent="blue" sub="Registered"/>
        <StatCard label="Online"  value={online}  icon={Wifi}          accent="green" sub="Actively reporting"/>
        <StatCard label="Offline" value={offline} icon={WifiOff}       accent="amber" sub="Not responding"/>
        <StatCard label="Errors"  value={errors}  icon={AlertCircle}   accent="red"   sub="Need attention"/>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input w-52 text-xs py-1.5" placeholder="Search name or UID..."/>
        <div className="flex gap-1 flex-wrap">
          {['all','online','offline','error','sensor','gateway','camera'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('text-xs px-2.5 py-1 rounded-md border capitalize transition-all',
                filter === f
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-muted hover:text-[var(--text)]'
              )}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="p-12">
            <EmptyState icon={Cpu} title="No devices registered"
              message="Register sensors, controllers, and gateways to start monitoring your farms."
              action={<Button variant="primary" onClick={() => setShowRegister(true)}><Plus className="w-3.5 h-3.5"/>Register First Device</Button>}/>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Device</th><th>Type</th><th>Protocol</th>
                  <th>IP Address</th><th>Firmware</th><th>Last Seen</th>
                  <th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-sm text-muted">No devices match the filter</td></tr>
                ) : visible.map((d: any) => (
                  <tr key={d.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {statusIcon(d.status)}
                        <div>
                          <div className="font-medium text-sm">{d.name}</div>
                          <div className="text-xs text-muted font-mono">{d.device_uid}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant="gray">{d.device_type?.replace(/_/g,' ')}</Badge></td>
                    <td><span className="text-xs font-mono uppercase text-muted">{d.protocol}</span></td>
                    <td><span className="text-xs font-mono text-muted">{d.ip_address || '—'}</span></td>
                    <td><span className="text-xs text-muted">v{d.firmware_version || '—'}</span></td>
                    <td><span className="text-xs text-muted">{d.last_seen ? relativeTime(d.last_seen) : '—'}</span></td>
                    <td><Badge variant={STATUS_BADGE[d.status] ?? 'gray'}>{d.status}</Badge></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost btn-sm p-1.5" title="View"><Eye className="w-3.5 h-3.5"/></button>
                        <button className="btn-ghost btn-sm p-1.5" title="Settings"><Settings className="w-3.5 h-3.5"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RegisterDeviceModal open={showRegister} onClose={() => setShowRegister(false)}/>
    </div>
  )
}
