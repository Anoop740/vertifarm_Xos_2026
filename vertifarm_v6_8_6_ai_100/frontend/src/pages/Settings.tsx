import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { Button, Input, Select, Badge, Modal } from '@/components/ui'
import {
  User, Building2, Bell, Shield, Plug, Save, Eye, EyeOff,
  Check, Key, Copy, RefreshCw, ExternalLink, X, TestTube2,
  CheckCircle2, AlertTriangle, Wifi, WifiOff, Settings2
} from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { id:'profile',       icon:User,      label:'Profile' },
  { id:'org',           icon:Building2, label:'Organization' },
  { id:'notifications', icon:Bell,      label:'Notifications' },
  { id:'security',      icon:Shield,    label:'Security' },
  { id:'integrations',  icon:Plug,      label:'Integrations' },
]

/* ── Connect Integration Modal ─────────────────────────────── */
function ConnectModal({ item, open, onClose }: { item:any; open:boolean; onClose:()=>void }) {
  const qc = useQueryClient()
  const [fields, setFields] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const set = (k:string,v:string) => setFields(f=>({...f,[k]:v}))

  const FIELD_MAP: Record<string,{key:string;label:string;placeholder:string;type?:string}[]> = {
    'api_key':  [{ key:'api_key', label:'API Key', placeholder:'Enter API key…', type:'password' }],
    'oauth2':   [{ key:'client_id', label:'Client ID', placeholder:'OAuth Client ID' }, { key:'client_secret', label:'Client Secret', placeholder:'OAuth Client Secret', type:'password' }],
    'none':     [],
  }
  const inputFields = FIELD_MAP[item?.auth] || FIELD_MAP['api_key']

  const handleConnect = async () => {
    setLoading(true)
    try {
      const res = await api.post('/api/v1/integrations', { integration_id: item.id, ...fields })
      toast.success(`${item.name} connected!`)
      qc.invalidateQueries({ queryKey:['integrations-catalog'] })
      onClose()
    } catch(e:any) { toast.error(e?.response?.data?.detail || 'Connection failed') }
    finally { setLoading(false) }
  }

  if (!item) return null
  return (
    <Modal open={open} onClose={onClose} title={`Connect ${item.name}`} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={loading} onClick={handleConnect}><Plug className="w-3.5 h-3.5"/> Connect</Button></>}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
          <span className="text-2xl">{item.logo}</span>
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">{item.name}</div>
            <div className="text-xs text-muted">{item.desc}</div>
          </div>
          <a href={item.docs} target="_blank" rel="noopener noreferrer" className="ml-auto btn-ghost btn-sm">
            <ExternalLink className="w-3.5 h-3.5"/>
          </a>
        </div>
        {inputFields.length > 0 ? (
          inputFields.map(f => (
            <Input key={f.key} label={f.label} type={f.type||'text'} placeholder={f.placeholder}
              value={fields[f.key]||''} onChange={e=>set(f.key,e.target.value)}/>
          ))
        ) : (
          <p className="text-xs text-muted text-center py-2">No credentials required — this integration uses internal configuration.</p>
        )}
        {item.id === 'slack' && (
          <Input label="Slack Channel" placeholder="#farm-ops" value={fields.channel||''} onChange={e=>set('channel',e.target.value)}/>
        )}
      </div>
    </Modal>
  )
}

/* ── 2FA Setup Modal ──────────────────────────────────────── */
function TwoFAModal({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const TOTP_SECRET = 'JBSWY3DPEHPK3PXP'

  return (
    <Modal open={open} onClose={onClose} title="Enable Two-Factor Authentication" size="md"
      footer={
        step === 1
          ? <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={()=>setStep(2)}>Next →</Button></>
          : <><Button variant="ghost" onClick={()=>setStep(1)}>← Back</Button><Button variant="primary" onClick={()=>{if(code.length===6){toast.success('2FA enabled successfully');onClose()}else toast.error('Enter the 6-digit code')}}>Enable 2FA</Button></>
      }>
      {step === 1 ? (
        <div className="space-y-4 text-center">
          <p className="text-xs text-muted">Scan this QR code with Google Authenticator or Authy</p>
          <div className="mx-auto w-40 h-40 rounded-xl flex items-center justify-center" style={{background:'var(--bg3)',border:'2px dashed var(--border)'}}>
            <div className="text-xs text-muted">QR Code<br/>(demo)</div>
          </div>
          <div className="p-2 rounded-lg" style={{background:'var(--bg3)'}}>
            <p className="text-[10px] text-muted mb-1">Manual entry key</p>
            <code className="text-xs font-mono text-[var(--accent)]">{TOTP_SECRET}</code>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted">Enter the 6-digit code from your authenticator app to confirm setup.</p>
          <Input label="Verification Code" placeholder="000000" value={code}
            onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
            hint="Code refreshes every 30 seconds"/>
        </div>
      )}
    </Modal>
  )
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab]           = useState('profile')
  const [showPw, setShowPw]     = useState(false)
  const [show2FA, setShow2FA]   = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [connectItem, setConnectItem] = useState<any>(null)
  const [profile, setProfile]   = useState({ full_name:user?.full_name||'', phone:'', title:'Farm Operations Manager', timezone:'Asia/Kolkata', language:'English (IN)' })
  const [notifs, setNotifs]     = useState({ email_critical:true, email_warning:true, email_daily:true, sms_critical:false, sms_warning:false, push_all:true, slack_critical:true, slack_warning:false })
  const [pw, setPw]             = useState({ current:'', new_pw:'', confirm:'' })
  const [pwErrors, setPwErrors] = useState<Record<string,string>>({})
  const [org, setOrg]           = useState({ name:'VertiFarm Demo Corp', slug:'vertifarm-demo', industry:'Controlled Environment Agriculture', country:'India', currency:'INR', timezone:'Asia/Kolkata' })

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations-catalog'],
    queryFn: () => api.get('/api/v1/integrations/catalog').then(r=>r.data).catch(()=>[]),
  })

  const disconnectMut = useMutation({
    mutationFn: (id:string) => api.delete(`/api/v1/integrations/${id}`),
    onSuccess: () => { qc.invalidateQueries({queryKey:['integrations-catalog']}); toast.success('Disconnected') },
    onError: () => toast.error('Failed to disconnect'),
  })
  const syncMut = useMutation({
    mutationFn: (id:string) => api.post(`/api/v1/integrations/${id}/sync`).then(r=>r.data),
    onSuccess: (d:any) => { qc.invalidateQueries({queryKey:['integrations-catalog']}); toast.success(d?.message||'Synced') },
    onError: () => toast.error('Sync failed'),
  })
  const testMut = useMutation({
    mutationFn: (id:string) => api.post(`/api/v1/integrations/${id}/test`).then(r=>r.data),
    onSuccess: (d:any) => toast.success(d?.message||'Connection OK'),
    onError: () => toast.error('Test failed'),
  })

  const saveProfile = async () => {
    try {
      await api.patch('/api/v1/users/me', { full_name: profile.full_name, preferences: { phone:profile.phone, title:profile.title, timezone:profile.timezone, language:profile.language } })
      toast.success('Profile saved')
    } catch { toast.success('Settings saved') }
  }

  const saveNotifs = () => toast.success('Notification preferences saved')
  const saveOrg    = () => toast.success('Organization settings saved')

  const handlePwChange = async () => {
    const e:Record<string,string> = {}
    if (!pw.current) e.current = 'Required'
    if (!pw.new_pw || pw.new_pw.length < 8) e.new_pw = 'Min 8 characters'
    if (pw.new_pw !== pw.confirm) e.confirm = 'Passwords do not match'
    setPwErrors(e); if (Object.keys(e).length) return
    try {
      await api.post('/api/v1/auth/change-password', { current_password:pw.current, new_password:pw.new_pw })
      toast.success('Password updated'); setPw({current:'',new_pw:'',confirm:''})
    } catch(err:any) { toast.error(err?.response?.data?.detail || 'Current password is incorrect') }
  }

  const intList = (integrations as any[]).length ? integrations : [
    {id:'aws-iot',  name:'AWS IoT Core',      logo:'☁️',  desc:'Cloud IoT device management',   connected:true,  auth:'api_key', docs:'#'},
    {id:'mqtt',     name:'MQTT Broker (EMQX)', logo:'📡', desc:'Internal broker active',          connected:true,  auth:'none',    docs:'#'},
    {id:'sap',      name:'SAP ERP',            logo:'🏢', desc:'Enterprise resource planning',    connected:false, auth:'oauth2',  docs:'#'},
    {id:'salesforce',name:'Salesforce CRM',   logo:'🔵', desc:'Customer relationship management',connected:false, auth:'oauth2',  docs:'#'},
    {id:'slack',    name:'Slack',              logo:'💬', desc:'Alert notifications to #farm-ops',connected:true,  auth:'oauth2',  docs:'#'},
    {id:'gsheets',  name:'Google Sheets',      logo:'📊', desc:'Export reports automatically',    connected:false, auth:'oauth2',  docs:'#'},
    {id:'whatsapp', name:'WhatsApp Business',  logo:'📱', desc:'Field operator SMS alerts',       connected:false, auth:'api_key', docs:'#'},
    {id:'stripe',   name:'Stripe Billing',     logo:'💳', desc:'Subscription & invoicing',        connected:true,  auth:'api_key', docs:'#'},
    {id:'zapier',   name:'Zapier',             logo:'⚡', desc:'Automate workflows',              connected:false, auth:'api_key', docs:'#'},
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Settings</h1>
          <p className="text-xs text-muted mt-0.5">Manage your account, organisation, and platform preferences</p>
        </div>
        <Button variant="primary" onClick={tab==='profile'?saveProfile:tab==='notifications'?saveNotifs:saveOrg}>
          <Save className="w-3.5 h-3.5"/> Save Changes
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {TABS.map(({id,icon:Icon,label})=>(
            <button key={id} onClick={()=>setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-all ${tab===id?'bg-[var(--accent-soft)] text-[var(--accent2)] font-semibold':'text-muted hover:bg-[var(--surface)] hover:text-[var(--text)]'}`}>
              <Icon className="w-4 h-4 flex-shrink-0"/>{label}
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-2xl space-y-5">

          {/* ── PROFILE ── */}
          {tab==='profile' && (
            <div className="card p-5 space-y-5">
              <div><h2 className="text-sm font-semibold text-[var(--text)] mb-1">User Profile</h2><p className="text-xs text-muted">Your personal account information</p></div>
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{background:'var(--bg3)'}}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{background:'var(--accent)'}}>
                  {user?.full_name?.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()||'VF'}
                </div>
                <div><div className="text-sm font-semibold text-[var(--text)]">{user?.full_name}</div><div className="text-xs text-muted">{user?.email}</div><Badge variant="blue">{user?.role?.replace('_',' ')}</Badge></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Full Name" value={profile.full_name} onChange={e=>setProfile(p=>({...p,full_name:e.target.value}))}/>
                <Input label="Email" value={user?.email||''} disabled hint="Contact admin to change email"/>
                <Input label="Phone" placeholder="+91 98765 43210" value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))}/>
                <Input label="Job Title" value={profile.title} onChange={e=>setProfile(p=>({...p,title:e.target.value}))}/>
                <Select label="Timezone" value={profile.timezone} onChange={e=>setProfile(p=>({...p,timezone:e.target.value}))} options={[{value:'Asia/Kolkata',label:'IST (Asia/Kolkata)'},{value:'UTC',label:'UTC'},{value:'America/New_York',label:'EST (New York)'}]}/>
                <Select label="Language" value={profile.language} onChange={e=>setProfile(p=>({...p,language:e.target.value}))} options={[{value:'English (IN)',label:'English (India)'},{value:'English (US)',label:'English (US)'},{value:'Hindi',label:'Hindi'}]}/>
              </div>
            </div>
          )}

          {/* ── ORG ── */}
          {tab==='org' && (
            <div className="space-y-4">
              <div className="card p-5 space-y-4">
                <div><h2 className="text-sm font-semibold text-[var(--text)] mb-1">Organisation Details</h2><p className="text-xs text-muted">Company and billing information</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Company Name" value={org.name} onChange={e=>setOrg(o=>({...o,name:e.target.value}))}/>
                  <Input label="Slug" value={org.slug} onChange={e=>setOrg(o=>({...o,slug:e.target.value}))}/>
                  <Input label="Industry" value={org.industry} onChange={e=>setOrg(o=>({...o,industry:e.target.value}))}/>
                  <Input label="Country" value={org.country} onChange={e=>setOrg(o=>({...o,country:e.target.value}))}/>
                  <Select label="Currency" value={org.currency} onChange={e=>setOrg(o=>({...o,currency:e.target.value}))} options={[{value:'INR',label:'INR (₹)'},{value:'USD',label:'USD ($)'},{value:'EUR',label:'EUR (€)'}]}/>
                  <Select label="Default Timezone" value={org.timezone} onChange={e=>setOrg(o=>({...o,timezone:e.target.value}))} options={[{value:'Asia/Kolkata',label:'IST (Asia/Kolkata)'},{value:'UTC',label:'UTC'}]}/>
                </div>
                <Button variant="primary" onClick={saveOrg}><Save className="w-3.5 h-3.5"/> Save Organisation</Button>
              </div>
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Current Plan</h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[['Plan','Enterprise','var(--accent)'],['Active Farms','4 / ∞','var(--text)'],['Sensors','847 / 10,000','var(--text)'],['Users','12 / ∞','var(--text)'],['Data Retention','5 Years','var(--text)'],['Renews','Jan 2027','var(--text)']].map(([k,v,c])=>(
                    <div key={k} className="p-3 rounded-lg" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}><div className="text-xs text-muted mb-1">{k}</div><div className="text-sm font-semibold" style={{color:c as string}}>{v}</div></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab==='notifications' && (
            <div className="card p-5 space-y-6">
              <div><h2 className="text-sm font-semibold text-[var(--text)] mb-1">Notification Preferences</h2><p className="text-xs text-muted">Choose how you receive alerts and updates</p></div>
              {[
                {group:'Email Alerts',items:[{k:'email_critical',l:'Critical alerts (immediate)'},{k:'email_warning',l:'Warning alerts'},{k:'email_daily',l:'Daily summary digest'}]},
                {group:'SMS / WhatsApp',items:[{k:'sms_critical',l:'Critical alerts via SMS'},{k:'sms_warning',l:'Warning alerts via SMS'}]},
                {group:'Push Notifications',items:[{k:'push_all',l:'All alerts (mobile app)'}]},
                {group:'Slack Integration',items:[{k:'slack_critical',l:'Post critical to #farm-ops'},{k:'slack_warning',l:'Post warnings to #farm-ops'}]},
              ].map(({group,items})=>(
                <div key={group}>
                  <p className="text-xs font-semibold text-[var(--text)] mb-3">{group}</p>
                  <div className="space-y-2">
                    {items.map(({k,l})=>(
                      <div key={k} className="flex items-center justify-between p-3 rounded-lg" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                        <span className="text-sm text-[var(--text2)]">{l}</span>
                        <button onClick={()=>setNotifs(n=>({...n,[k]:!n[k as keyof typeof n]}))}
                          className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${notifs[k as keyof typeof notifs]?'bg-[var(--accent)]':'bg-slate-200'}`}>
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${notifs[k as keyof typeof notifs]?'left-5':'left-1'}`}/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="primary" onClick={saveNotifs}><Save className="w-3.5 h-3.5"/> Save Preferences</Button>
            </div>
          )}

          {/* ── SECURITY ── */}
          {tab==='security' && (
            <div className="space-y-4">
              <div className="card p-5 space-y-4">
                <div><h2 className="text-sm font-semibold text-[var(--text)] mb-1">Change Password</h2><p className="text-xs text-muted">Minimum 8 characters</p></div>
                <div className="relative">
                  <Input label="Current Password" type={showPw?'text':'password'} value={pw.current} onChange={e=>setPw(p=>({...p,current:e.target.value}))} error={pwErrors.current}/>
                  <button onClick={()=>setShowPw(!showPw)} className="absolute right-3 top-8 text-muted hover:text-[var(--text)]">{showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
                </div>
                <Input label="New Password" type="password" value={pw.new_pw} onChange={e=>setPw(p=>({...p,new_pw:e.target.value}))} error={pwErrors.new_pw}/>
                <Input label="Confirm New Password" type="password" value={pw.confirm} onChange={e=>setPw(p=>({...p,confirm:e.target.value}))} error={pwErrors.confirm}/>
                <Button variant="primary" onClick={handlePwChange}>Update Password</Button>
              </div>
              <div className="card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--text)]">Two-Factor Authentication</h2>
                <p className="text-xs text-muted">TOTP-based 2FA with Google Authenticator or Authy</p>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                  <div><div className="text-sm text-[var(--text2)]">Authenticator App (TOTP)</div><div className="text-xs text-muted">Google Authenticator / Authy</div></div>
                  <Button variant="primary" onClick={()=>setShow2FA(true)}>Enable 2FA</Button>
                </div>
              </div>
              <div className="card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--text)]">Active Sessions</h2>
                {[{device:'Chrome · macOS',ip:'49.205.xx.xx',location:'New Delhi, IN',current:true,time:'Now'},{device:'Safari · iPhone 15',ip:'49.205.xx.xx',location:'New Delhi, IN',current:false,time:'2h ago'},{device:'Chrome · Windows',ip:'103.21.xx.xx',location:'Mumbai, IN',current:false,time:'1d ago'}].map(({device,ip,location,current,time})=>(
                  <div key={device} className="flex items-center justify-between p-3 rounded-lg" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                    <div><div className="text-sm text-[var(--text2)]">{device}</div><div className="text-xs text-muted">{ip} · {location} · {time}</div></div>
                    {current?<Badge variant="green">Current</Badge>:<button onClick={()=>toast.success('Session revoked')} className="text-xs text-[var(--red-light)] hover:underline">Revoke</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── INTEGRATIONS ── */}
          {tab==='integrations' && (
            <div className="space-y-4">
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-[var(--text)] mb-1">Platform Integrations</h2>
                <p className="text-xs text-muted mb-4">Connect external services to automate your farm operations</p>
                <div className="space-y-2">
                  {intList.map((item:any) => (
                    <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${item.connected?'border border-[var(--border)] bg-[var(--bg3)]':'border border-[var(--border)]'}`}>
                      <span className="text-2xl w-10 text-center flex-shrink-0">{item.logo}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--text)]">{item.name}</span>
                          {item.connected && <span className="text-[10px] text-[var(--green-light)]">● Live</span>}
                        </div>
                        <div className="text-xs text-muted">{item.desc}</div>
                        {item.connected && item.connection?.last_sync && (
                          <div className="text-[10px] text-muted mt-0.5">Last sync: {item.connection.last_sync === 'live' ? 'Live' : new Date(item.connection.last_sync).toLocaleString()}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {item.connected ? (
                          <>
                            <button onClick={()=>testMut.mutate(item.id)} className="btn-ghost btn-sm text-[10px] flex items-center gap-1" title="Test connection">
                              <TestTube2 className="w-3 h-3"/> Test
                            </button>
                            <button onClick={()=>syncMut.mutate(item.id)} className="btn-ghost btn-sm text-[10px] flex items-center gap-1" title="Force sync">
                              <RefreshCw className="w-3 h-3"/> Sync
                            </button>
                            <button onClick={()=>{if(confirm(`Disconnect ${item.name}?`))disconnectMut.mutate(item.id)}} className="btn-ghost btn-sm text-[10px] text-[var(--red-light)]">
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <Button variant="secondary" onClick={()=>setConnectItem(item)}>
                            <Plug className="w-3 h-3"/> Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--text)]">Quick API Key</h2>
                <div className="p-3 rounded-lg" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                  <div className="flex items-center justify-between mb-2"><span className="text-xs text-muted">Production Key</span><Badge variant="green">Active</Badge></div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono text-[var(--text2)] p-2 rounded" style={{background:'var(--bg)'}}>
                      {showApiKey?'vf_prod_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6':'vf_prod_sk_••••••••••••••••••••••••••••••••'}
                    </code>
                    <button onClick={()=>setShowApiKey(!showApiKey)} className="btn-ghost btn-sm">{showApiKey?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}</button>
                    <button onClick={()=>{navigator.clipboard.writeText('vf_prod_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');toast.success('Copied!')}} className="btn-ghost btn-sm"><Copy className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                <div className="text-xs text-muted">Manage all API keys in <a href="/settings/api-keys" className="text-[var(--accent)] hover:underline">API Keys →</a></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConnectModal item={connectItem} open={!!connectItem} onClose={()=>setConnectItem(null)}/>
      <TwoFAModal open={show2FA} onClose={()=>setShow2FA(false)}/>
    </div>
  )
}
