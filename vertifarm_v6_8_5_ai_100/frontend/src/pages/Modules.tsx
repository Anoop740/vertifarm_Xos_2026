import React, { useState } from 'react'
import { ProgressBar, StatCard, Badge, Toggle } from '@/components/ui'
import { Thermometer, Droplets, Sun, Wind, Radio, Zap, ShoppingBag, BookOpen, Plus, CheckCircle } from 'lucide-react'
import { randomBetween } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

const TS = { contentStyle:{background:'white',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8,fontSize:11,color:'#0f172a',boxShadow:'0 4px 12px rgba(15,23,42,0.08)'} }
const AX = { tick:{fontSize:10,fill:'#94a3b8'}, axisLine:false, tickLine:false }

function PageHeader({icon:Icon,title,sub,color}:{icon:any;title:string;sub:string;color:string}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{background:color+'20',border:`1px solid ${color}40`}}>
        <Icon className="w-4 h-4" style={{color}}/>
      </div>
      <div>
        <h1 className="text-lg font-bold text-[var(--text)]">{title}</h1>
        <p className="text-xs text-muted">{sub}</p>
      </div>
    </div>
  )
}

// ─── CLIMATE ──────────────────────────────────────────────
export function ClimatePage() {
  const zones=['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4','D1','D2','D3','D4']
  return (
    <div className="p-6 space-y-5">
      <PageHeader icon={Thermometer} title="Climate Control" sub="HVAC · Temperature · Humidity · VPD · Airflow" color="var(--red-light)"/>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Avg Temperature" value="24.3°C" sub="Target: 22–26°C" trend="✓ Stable" trendUp accent="blue"/>
        <StatCard label="Avg Humidity" value="68%" sub="Target: 60–75%" trend="↑ 3% high" trendUp={false} accent="amber"/>
        <StatCard label="Avg VPD" value="0.89 kPa" sub="Optimal range" trend="✓ Optimal" trendUp accent="green"/>
        <StatCard label="HVAC Systems" value="8/8" sub="All systems online" trend="100% uptime" trendUp accent="green"/>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {zones.map(code=>{
          const temp=randomBetween(22.5,26.5); const rh=randomBetween(55,92)
          const warn=rh>80||temp>26
          return (
            <div key={code} className={`card p-3 transition-all ${warn?'border-amber-200':''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-[var(--accent)]">{code}</span>
                {warn&&<Badge variant="amber">⚠</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                  <div className="text-muted">Temp</div>
                  <div className={`font-bold ${temp>26?'text-[var(--amber-light)]':'text-[var(--text)]'}`}>{temp.toFixed(1)}°C</div>
                </div>
                <div>
                  <div className="text-muted">RH</div>
                  <div className={`font-bold ${rh>80?'text-[var(--amber-light)]':'text-[var(--text)]'}`}>{rh.toFixed(0)}%</div>
                </div>
              </div>
              <ProgressBar value={rh} variant={rh>80?'amber':'blue'}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── LIGHTING ──────────────────────────────────────────────
export function LightingPage() {
  const [circuits,setCircuits] = useState(Array.from({length:8},(_,i)=>({id:i+1,on:i!==3,intensity:randomBetween(75,100),zone:`Zone ${String.fromCharCode(65+Math.floor(i/2))}${i%2+1}`})))
  return (
    <div className="p-6 space-y-5">
      <PageHeader icon={Sun} title="Lighting Automation" sub="LED Control · DLI · Photoperiod · Spectrum Management" color="var(--amber-light)"/>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Avg PPFD" value="298 µmol" sub="Target: 250–350" trend="✓ Optimal" trendUp accent="amber"/>
        <StatCard label="DLI Today" value="18.2 mol" sub="Target: 16–22 mol" trend="✓ On target" trendUp accent="green"/>
        <StatCard label="Photoperiod" value="16h ON" sub="8h dark cycle" trend="✓ Running" trendUp accent="blue"/>
        <StatCard label="Energy (Lights)" value="180 kWh" sub="58% of total usage" trend="Today" accent="amber"/>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">LED Circuits</h3>
          <p className="text-xs text-muted">{circuits.filter(c=>c.on).length} of {circuits.length} active</p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {circuits.map(c=>(
            <div key={c.id} className={`card p-3 transition-all ${c.on?'border-amber-200':''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--text)]">Circuit {c.id}</span>
                <Toggle checked={c.on} onChange={v=>setCircuits(cs=>cs.map(x=>x.id===c.id?{...x,on:v}:x))}/>
              </div>
              <div className="text-xs text-muted mb-2">{c.zone}</div>
              <div className={`text-xl font-bold mb-2 ${c.on?'text-[var(--amber-light)]':'text-muted'}`}>
                {c.on?`${c.intensity.toFixed(0)}%`:'OFF'}
              </div>
              <ProgressBar value={c.on?c.intensity:0} variant="amber"/>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── CO2 ───────────────────────────────────────────────────
export function CO2Page() {
  const zones=['A1','A2','A3','A4','B1','B2','D1','D2']
  return (
    <div className="p-6 space-y-5">
      <PageHeader icon={Wind} title="CO₂ & Air Management" sub="CO₂ Enrichment · Airflow · Negative Pressure · Filtration" color="var(--green-light)"/>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Avg CO₂" value="1,082 ppm" sub="Target: 1000–1200" trend="✓ Optimal" trendUp accent="green"/>
        <StatCard label="CO₂ Tank" value="68%" sub="Refill in ~8 days" trend="Monitor levels" accent="amber"/>
        <StatCard label="Airflow" value="4.2 m/s" sub="All fans active" trend="✓ Good" trendUp accent="blue"/>
        <StatCard label="Neg. Pressure" value="−4 Pa" sub="Containment OK" trend="✓ Safe" trendUp accent="green"/>
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">CO₂ Levels by Zone</h3>
        <div className="space-y-2.5">
          {zones.map(code=>{
            const val=randomBetween(900,1250); const ok=val>=900&&val<=1200
            return (
              <div key={code} className="grid grid-cols-[50px_1fr_80px] items-center gap-3">
                <span className="text-xs font-bold text-[var(--accent)]">{code}</span>
                <ProgressBar value={val} max={1600} variant={ok?'green':'amber'}/>
                <span className={`text-xs text-right font-mono ${ok?'text-[var(--text)]':'text-[var(--amber-light)]'}`}>{val.toFixed(0)} ppm</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── AUTOMATION ────────────────────────────────────────────
export function AutomationPage() {
  const [rules,setRules] = useState([
    {id:'r1',name:'High Humidity — Fan Speed',trigger:'Humidity > 80%',actions:'Exhaust fan +20%, Alert ops',active:true,triggered:'14 min ago',priority:'high'},
    {id:'r2',name:'pH Auto-Correction',trigger:'pH < 5.7 or > 6.8',actions:'Dose pH-up/down solution',active:true,triggered:'2h ago',priority:'medium'},
    {id:'r3',name:'Night CO₂ Reduction',trigger:'Time = 22:00',actions:'CO₂ enrichment OFF',active:true,triggered:'Yesterday 22:00',priority:'low'},
    {id:'r4',name:'EC Drift Correction',trigger:'EC drift > 0.3 mS/hr',actions:'Nutrient dosing + alert',active:true,triggered:'31 min ago',priority:'high'},
    {id:'r5',name:'Emergency Shutdown',trigger:'Fire/Smoke sensor ON',actions:'ALL systems OFF, alarm, alert',active:true,triggered:'Never',priority:'critical'},
    {id:'r6',name:'Harvest Reminder',trigger:'Days since plant >= grow_days',actions:'Notify farm manager',active:true,triggered:'Today 09:00',priority:'medium'},
    {id:'r7',name:'Pump Failover',trigger:'Flow rate = 0 for 2 min',actions:'Switch to backup pump, alert',active:true,triggered:'2 min ago',priority:'critical'},
    {id:'r8',name:'Weekend Energy Save',trigger:'Day = SAT or SUN',actions:'Reduce HVAC by 15%',active:false,triggered:'Last Saturday',priority:'low'},
  ])
  const pBadge:Record<string,any>={critical:'red',high:'amber',medium:'blue',low:'gray'}
  return (
    <div className="p-6 space-y-5">
      <PageHeader icon={Radio} title="Automation & Rule Engine" sub="IF-THEN Rules · Schedules · AI-Driven Triggers · Event Workflows" color="#a78bfa"/>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Rules" value={rules.filter(r=>r.active).length} sub="Monitoring" trend="✓ Running" trendUp accent="green"/>
        <StatCard label="Triggers Today" value={24} sub="Actions executed" trend="+3 vs yesterday" trendUp accent="blue"/>
        <StatCard label="AI Automations" value={3} sub="Queued for approval" trend="Pending review" accent="amber"/>
        <StatCard label="Auto-Resolved" value={7} sub="Issues fixed today" trend="↑ 2 more than avg" trendUp accent="green"/>
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
          <h3 className="text-sm font-semibold text-[var(--text)]">Automation Rules</h3>
          <button className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5"/> New Rule</button>
        </div>
        <table>
          <thead><tr><th>Status</th><th>Rule Name</th><th>Trigger Condition</th><th>Actions</th><th>Priority</th><th>Last Triggered</th></tr></thead>
          <tbody>
            {rules.map(rule=>(
              <tr key={rule.id}>
                <td>
                  <Toggle checked={rule.active} onChange={v=>setRules(rs=>rs.map(r=>r.id===rule.id?{...r,active:v}:r))}/>
                </td>
                <td className="font-medium">{rule.name}</td>
                <td><span className="text-xs font-mono text-[var(--amber-light)]">{rule.trigger}</span></td>
                <td><span className="text-xs text-[var(--info)]">{rule.actions}</span></td>
                <td><Badge variant={pBadge[rule.priority]}>{rule.priority}</Badge></td>
                <td className="text-muted text-xs">{rule.triggered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── ENERGY ────────────────────────────────────────────────
export function EnergyPage() {
  const trend=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return{date:d.toLocaleDateString('en-IN',{month:'short',day:'numeric'}),kwh:randomBetween(290,350)}})
  return (
    <div className="p-6 space-y-5">
      <PageHeader icon={Zap} title="Energy Monitoring" sub="kWh Usage · Cost Tracking · AI Optimization · Sustainability" color="var(--amber-light)"/>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Today's Usage" value="312 kWh" sub="AI saved 28 kWh" trend="↓ 8% vs yesterday" trendUp accent="green"/>
        <StatCard label="Monthly Cost" value="₹2.4L" sub="On budget" trend="↓ 8.5% vs last month" trendUp accent="amber"/>
        <StatCard label="Carbon Saved" value="142 kg" sub="CO₂e vs grid today" trend="↑ 12 kg more" trendUp accent="green"/>
        <StatCard label="Sustainability" value="87/100" sub="Platinum tier" trend="↑ 2pts this month" trendUp accent="blue"/>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Energy Trend — 14 Days</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trend} margin={{top:5,right:10,bottom:0,left:0}}>
              <CartesianGrid stroke="rgba(110,118,129,0.08)"/>
              <XAxis dataKey="date" {...AX}/>
              <YAxis {...AX} width={38}/>
              <Tooltip {...TS} formatter={(v:any)=>[`${v} kWh`,'Energy']}/>
              <Bar dataKey="kwh" fill="var(--amber-light)" opacity={0.8} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Consumption Breakdown</h3>
          <div className="space-y-3">
            {[{label:'Lighting',kwh:180,pct:58,v:'amber'},{label:'HVAC / Cooling',kwh:75,pct:24,v:'blue'},{label:'Irrigation Pumps',kwh:28,pct:9,v:'green'},{label:'CO₂ Systems',kwh:18,pct:6,v:'green'},{label:'Sensors / Controls',kwh:11,pct:3,v:'green'}].map(({label,kwh,pct,v})=>(
              <div key={label} className="grid grid-cols-[130px_1fr_60px] items-center gap-2">
                <span className="text-xs text-muted">{label}</span>
                <ProgressBar value={pct} variant={v as any}/>
                <span className="text-xs text-right text-[var(--text)]">{kwh} kWh</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-2">
            <p className="text-xs font-semibold text-[var(--text)]">AI Recommendations</p>
            {['Shift Zone C lighting to 23:00–06:00 off-peak — saves ₹680/day','Reduce HVAC setpoint 1°C at night — saves 12 kWh','Mumbai Circuit 4 spike — check LED driver fault'].map((r,i)=>(
              <div key={i} className="flex gap-2 text-xs p-2 rounded" style={{background:'var(--bg3)'}}>
                <Zap className="w-3 h-3 text-[var(--amber-light)] flex-shrink-0 mt-0.5"/>{r}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── INVENTORY ─────────────────────────────────────────────
export function InventoryPage() {
  const items=[
    {name:'pH-Up Solution',cat:'Nutrients',qty:48,unit:'L',reorder:20,status:'ok'},
    {name:'pH-Down Solution',cat:'Nutrients',qty:12,unit:'L',reorder:20,status:'low'},
    {name:'CalMag Supplement',cat:'Nutrients',qty:80,unit:'L',reorder:30,status:'ok'},
    {name:'NPK Nutrient A',cat:'Nutrients',qty:5,unit:'L',reorder:25,status:'critical'},
    {name:'Rockwool Cubes 4"',cat:'Growing Media',qty:2400,unit:'pcs',reorder:500,status:'ok'},
    {name:'Lettuce Seeds (BH)',cat:'Seeds',qty:8000,unit:'seeds',reorder:2000,status:'ok'},
    {name:'Basil Seeds',cat:'Seeds',qty:1200,unit:'seeds',reorder:1000,status:'ok'},
    {name:'CO₂ Cylinders',cat:'Gas',qty:3,unit:'cylinders',reorder:2,status:'ok'},
  ]
  return (
    <div className="p-6 space-y-5">
      <PageHeader icon={ShoppingBag} title="Inventory Management" sub="Seeds · Nutrients · Growing Media · Supplies · Purchase Orders" color="var(--amber-light)"/>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total SKUs" value="84" sub="Tracked items" trend="✓ Up to date" trendUp accent="blue"/>
        <StatCard label="Low Stock" value={items.filter(i=>i.status==='low'||i.status==='critical').length} sub="Need reorder" trend="⚠ Order now" trendUp={false} accent="red"/>
        <StatCard label="Monthly Spend" value="₹1.8L" sub="Nutrients + Seeds" trend="On budget" trendUp accent="green"/>
        <StatCard label="Pending Orders" value="2" sub="Awaiting delivery" trend="Expected today" accent="amber"/>
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
          <h3 className="text-sm font-semibold text-[var(--text)]">Stock Levels</h3>
          <button className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5"/> New Purchase Order</button>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Category</th><th>Stock Level</th><th>Quantity</th><th>Reorder At</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {items.map(({name,cat,qty,unit,reorder,status})=>(
              <tr key={name}>
                <td className="font-medium">{name}</td>
                <td><Badge variant="gray">{cat}</Badge></td>
                <td className="w-40"><ProgressBar value={qty} max={reorder*3} variant={status==='critical'?'red':status==='low'?'amber':'green'}/></td>
                <td><span className={`font-mono font-medium ${status==='critical'?'text-[var(--red-light)]':status==='low'?'text-[var(--amber-light)]':'text-[var(--text)]'}`}>{qty.toLocaleString()} {unit}</span></td>
                <td className="text-muted text-xs">{reorder.toLocaleString()} {unit}</td>
                <td><Badge variant={status==='critical'?'red':status==='low'?'amber':'green'}>{status}</Badge></td>
                <td>{(status==='low'||status==='critical')&&<button className="btn-primary btn-sm">Order</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── SOPs ──────────────────────────────────────────────────
export function SOPPage() {
  const sops=[
    {title:'Daily Sensor Calibration',cat:'Maintenance',steps:8,updated:'2024-06-01',status:'active'},
    {title:'Nutrient Solution Preparation',cat:'Fertigation',steps:12,updated:'2024-05-15',status:'active'},
    {title:'Harvest & Packaging Protocol',cat:'Harvest',steps:15,updated:'2024-06-10',status:'active'},
    {title:'Pest Inspection Checklist',cat:'IPM',steps:6,updated:'2024-05-20',status:'active'},
    {title:'Emergency Shutdown Procedure',cat:'Safety',steps:9,updated:'2024-04-30',status:'active'},
    {title:'New Employee Onboarding',cat:'HR',steps:20,updated:'2024-03-01',status:'draft'},
  ]
  return (
    <div className="p-6 space-y-5">
      <PageHeader icon={BookOpen} title="Standard Operating Procedures" sub="SOPs · Checklists · Work Instructions · Compliance Documentation" color="#34d399"/>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active SOPs" value={sops.filter(s=>s.status==='active').length} sub="Published" trend="✓ Current" trendUp accent="green"/>
        <StatCard label="Total Steps" value={sops.reduce((a,s)=>a+s.steps,0)} sub="Documented" trend="✓ Complete" trendUp accent="blue"/>
        <StatCard label="Compliance Rate" value="98%" sub="Task completion" trend="↑ 2% this month" trendUp accent="green"/>
        <StatCard label="Drafts" value={sops.filter(s=>s.status==='draft').length} sub="Pending review" trend="Review needed" accent="amber"/>
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
          <h3 className="text-sm font-semibold text-[var(--text)]">SOPs Library</h3>
          <button className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5"/> New SOP</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {sops.map(({title,cat,steps,updated,status})=>(
            <div key={title} className="card-hover p-3 rounded-lg cursor-pointer">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="text-sm font-medium text-[var(--text)]">{title}</div>
                <Badge variant={status==='active'?'green':'amber'}>{status}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                <Badge variant="gray">{cat}</Badge>
                <span>{steps} steps</span>
                <span>Updated: {updated}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ModulesPage() {
  return <SOPPage />
}
