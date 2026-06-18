import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi, alertsApi, aiApi, analyticsApi } from '@/lib/api'
import { StatCard, Card, CardHeader, Badge, ProgressBar, Skeleton } from '@/components/ui'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  Leaf, Zap, Droplets, AlertTriangle, TrendingUp,
  Bot, Thermometer, Activity, Building2, Cpu, Send,
  RefreshCw, CheckCircle2, Settings, ChevronRight
} from 'lucide-react'
import { relativeTime, randomBetween } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const TS = {
  contentStyle: { background:'white', border:'1px solid rgba(148,163,184,0.25)', borderRadius:8, fontSize:11, color:'#0f172a', boxShadow:'0 4px 12px rgba(15,23,42,0.1)' },
  labelStyle: { color:'#64748b' }
}
const AX = { tick:{ fontSize:10, fill:'#94a3b8' }, axisLine:false, tickLine:false }

const DEMO_ALERTS = [
  { id:'1', severity:'critical', category:'Irrigation', title:'Zone B2 — Pump failure detected', created_at: new Date(Date.now()-2*60000).toISOString() },
  { id:'2', severity:'warning',  category:'Climate',    title:'Zone A3 — Humidity at 91.3%', created_at: new Date(Date.now()-14*60000).toISOString() },
  { id:'3', severity:'warning',  category:'Nutrient',   title:'Pune — EC drift detected', created_at: new Date(Date.now()-31*60000).toISOString() },
  { id:'4', severity:'warning',  category:'CV',         title:'Zone C3 — Early leaf curl pattern', created_at: new Date(Date.now()-72*60000).toISOString() },
  { id:'5', severity:'info',     category:'Automation', title:'Zone D1 — CO₂ cycle completed', created_at: new Date(Date.now()-3*3600000).toISOString() },
]

const ZONE_DATA = [
  { code:'A1', crop:'Lettuce',    pct:82, status:'ok' },
  { code:'A2', crop:'Spinach',    pct:67, status:'ok' },
  { code:'A3', crop:'Basil',      pct:91, status:'warn' },
  { code:'A4', crop:'Kale',       pct:45, status:'ok' },
  { code:'B1', crop:'Arugula',    pct:78, status:'ok' },
  { code:'B2', crop:'Chard',      pct:20, status:'crit' },
  { code:'B3', crop:'Mint',       pct:88, status:'ok' },
  { code:'B4', crop:'Cilantro',   pct:55, status:'ok' },
  { code:'C1', crop:'Chives',     pct:73, status:'ok' },
  { code:'C2', crop:'Dill',       pct:62, status:'ok' },
  { code:'C3', crop:'Strawberry', pct:85, status:'warn' },
  { code:'C4', crop:'Microgreens',pct:41, status:'ok' },
  { code:'D1', crop:'Tomato',     pct:95, status:'ok' },
  { code:'D2', crop:'Cucumber',   pct:70, status:'ok' },
  { code:'D3', crop:'Pepper',     pct:58, status:'ok' },
  { code:'D4', crop:'Seedlings',  pct:33, status:'ok' },
]

function genTrend(n:number, base:number, spread:number) {
  return Array.from({length:n},(_,i)=>({
    t: `${String(Math.floor(i/2)).padStart(2,'0')}:${i%2===0?'00':'30'}`,
    v: parseFloat((base + Math.sin(i/4)*spread + (Math.random()-.5)*spread*.5).toFixed(2))
  }))
}

// AI Copilot with real responses
const AI_SUGGESTIONS = [
  "Why is humidity high in Zone A3?",
  "Optimize lettuce yield for next week",
  "What's causing the EC drift in Pune?",
  "Show me harvest-ready zones",
  "Energy saving recommendations today",
]

function AICopilot() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  // FIX-3: messages now carry role:'user'|'assistant' for LLM history
  const [messages, setMessages] = useState<{role:'user'|'assistant';text:string}[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // FIX-3: real API call — no keyword matching, no QUICK_ANSWERS dict
  const handleSend = async () => {
    const q = query.trim()
    if (!q || isThinking) return
    setMessages(m => [...m, { role:'user', text:q }])
    setQuery('')
    setIsThinking(true)
    setExpanded(true)

    try {
      // Import aiApi inline to avoid circular dep issues with lazy-loaded pages
      const { aiApi } = await import('@/lib/api')
      const history = messages.map(m => ({ role: m.role, content: m.text }))
      const result = await aiApi.chat(q, history)
      setMessages(m => [...m, { role:'assistant', text: result.reply }])
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'AI service unavailable.'
      setMessages(m => [...m, { role:'assistant', text: `⚠️ ${detail}` }])
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'rgba(13,148,136,0.1)',border:'1px solid rgba(13,148,136,0.25)'}}>
          <Bot className="w-4 h-4 text-[var(--accent)]"/>
        </div>
        <span className="text-xs font-semibold text-[var(--text)]">AI Agronomist Copilot</span>
        <span className="text-[10px] text-[var(--green-light)] ml-auto">● Live</span>
      </div>

      {expanded && messages.length > 0 && (
        <div className="max-h-48 overflow-y-auto p-3 space-y-2 border-b border-[var(--border)]" style={{background:'var(--bg3)'}}>
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role==='user'?'justify-end':''}`}>
              {m.role==='assistant' && <Bot className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5 flex-shrink-0"/>}
              <div className={`text-xs rounded-lg px-3 py-2 max-w-[85%] ${m.role==='user'?'bg-[var(--accent)] text-white':'bg-white border border-[var(--border)] text-[var(--text)]'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-2"><Bot className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5"/><div className="text-xs text-muted italic">Analyzing farm data…</div></div>
          )}
        </div>
      )}

      {!expanded && (
        <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-[var(--border)]">
          {AI_SUGGESTIONS.slice(0,3).map(s => (
            <button key={s} onClick={() => { setQuery(s); inputRef.current?.focus() }}
              className="text-[10px] px-2.5 py-1 rounded-full border border-[var(--border)] text-muted hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 p-3">
        <input ref={inputRef}
          className="input flex-1 text-xs py-1.5 bg-transparent border-[var(--border)] focus:border-[var(--accent)]"
          placeholder="Ask anything — humidity, yield, harvest, energy…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if(e.key==='Enter') handleSend() }}/>
        <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={handleSend}>
          <Send className="w-3 h-3"/> Ask
        </button>
        <button className="btn-ghost btn-sm" onClick={() => navigate('/ai')}>Full AI ↗</button>
      </div>
    </div>
  )
}

// Quick-resolve alert action
function LiveAlertsPanel({ alerts, navigate }: { alerts: any[], navigate: any }) {
  const qc = useQueryClient()
  const [resolved, setResolved] = useState<Set<string>>(new Set())

  const handleResolve = (id: string) => {
    setResolved(prev => new Set([...prev, id]))
    toast.success('Alert acknowledged')
    alertsApi.resolve(id).catch(() => {})
    qc.invalidateQueries({ queryKey: ['alerts'] })
  }

  const sevColor: Record<string,string> = { critical:'var(--red-light)', warning:'var(--amber-light)', info:'var(--info)' }
  const sevBadge: Record<string,any> = { critical:'red', warning:'amber', info:'blue' }
  const visible = alerts.filter(a => !resolved.has(a.id))

  return (
    <div className="card p-4">
      <CardHeader title="Live Alerts" subtitle={`${visible.length} active`}
        action={
          <div className="flex gap-1.5">
            <button className="text-xs text-muted hover:text-[var(--text)] px-2 py-1 rounded border border-[var(--border)]"
              onClick={() => { visible.forEach(a => handleResolve(a.id)) }}>
              Ack All
            </button>
            <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => navigate('/alerts')}>
              View all →
            </button>
          </div>
        }/>
      <div className="space-y-2">
        {visible.length === 0 ? (
          <div className="flex items-center gap-2 py-4 justify-center text-xs text-[var(--green-light)]">
            <CheckCircle2 className="w-4 h-4"/> All clear — no active alerts
          </div>
        ) : visible.map((a:any) => (
          <div key={a.id} className="flex gap-2.5 py-2.5 border-b border-[var(--border)] last:border-0">
            <span className="dot mt-1 flex-shrink-0" style={{ background: sevColor[a.severity]??'var(--info)' }}/>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[var(--text)] leading-snug">{a.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={sevBadge[a.severity]??'gray'}>{a.severity}</Badge>
                <span className="text-[10px] text-muted">{a.category}</span>
                <span className="text-[10px] text-muted ml-auto">{relativeTime(a.created_at)}</span>
              </div>
            </div>
            <button onClick={() => handleResolve(a.id)}
              className="btn-success btn-sm flex-shrink-0 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3"/>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: stats, isLoading } = useQuery({ queryKey:['dashboard-stats'], queryFn: dashboardApi.stats, refetchInterval:30000 })
  const { data: alerts=[] } = useQuery({ queryKey:['alerts'], queryFn:()=>alertsApi.list({resolved:false,limit:5}), refetchInterval:15000 })
  const { data: aiData } = useQuery({ queryKey:['ai-yield'], queryFn:()=>aiApi.yieldForecast(), refetchInterval:60000 })
  const { data: climateAI } = useQuery({ queryKey:['ai-climate'], queryFn:()=>aiApi.climateOptimize(), refetchInterval:60000 })
  const { data: yieldTrend } = useQuery({ queryKey:['yield-trend-14'], queryFn:()=>analyticsApi.yieldTrend(14) })

  const [liveTemp, setLiveTemp] = useState(24.2)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  useEffect(()=>{ const t=setInterval(()=>{ setLiveTemp(randomBetween(23.5,25.0)); setLastRefresh(new Date()) },4000); return()=>clearInterval(t) },[])

  const humidTrend = genTrend(32, 68, 8)
  const displayAlerts = (alerts as any[]).length ? alerts as any[] : DEMO_ALERTS

  const isNewOrg = !isLoading && stats != null &&
    stats.total_farms === 0 && stats.total_devices === 0

  return (
    <div className="p-6 space-y-5">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Operations Overview</h1>
          <p className="text-xs text-muted mt-0.5">Live · Updated {lastRefresh.toLocaleTimeString()}</p>
        </div>
        <button className="btn-secondary btn-sm flex items-center gap-1.5"
          onClick={() => { qc.invalidateQueries(); toast.success('Dashboard refreshed') }}>
          <RefreshCw className="w-3.5 h-3.5"/> Refresh
        </button>
      </div>

      {/* ── EMPTY STATE ONBOARDING BANNER ─────────────────────────────── */}
      {isNewOrg && (
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
            boxShadow: '0 4px 20px rgba(13,148,136,0.25)',
          }}>
          <div className="p-6 flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🌿</span>
                <h2 className="text-base font-bold text-white">Welcome to VertiFarm XOS</h2>
              </div>
              <p className="text-sm text-teal-100 leading-relaxed mb-4">
                Your dashboard is ready — it's just waiting for your farm data.
                Connect your first farm, add growing zones, and link your IoT sensors
                to see live yield, energy, and health metrics here.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate('/farms')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: 'white', color: '#0d9488' }}>
                  ＋ Add Your First Farm
                </button>
                <button
                  onClick={() => navigate('/devices')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                  Connect IoT Sensors
                </button>
                <button
                  onClick={() => navigate('/zones')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
                  Create Grow Zones
                </button>
              </div>
            </div>
            {/* Progress checklist */}
            <div className="flex-shrink-0 rounded-xl p-4 min-w-[200px]"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <p className="text-xs font-bold text-teal-100 uppercase tracking-wide mb-3">Setup Progress</p>
              {[
                { done: false, label: 'Add a farm', action: () => navigate('/farms') },
                { done: false, label: 'Create grow zones', action: () => navigate('/zones') },
                { done: false, label: 'Connect IoT sensors', action: () => navigate('/devices') },
                { done: false, label: 'Log first harvest', action: () => navigate('/harvests') },
              ].map(({ done, label, action }) => (
                <button key={label} onClick={action}
                  className="w-full flex items-center gap-2.5 py-1.5 text-left group">
                  <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ border: '2px solid rgba(255,255,255,0.5)', background: done ? 'white' : 'transparent' }}>
                    {done && <span className="text-teal-600 text-[10px]">✓</span>}
                  </div>
                  <span className="text-xs text-teal-100 group-hover:text-white transition-colors"
                    style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {isLoading ? Array(5).fill(0).map((_,i)=><div key={i} className="skeleton h-28 rounded-xl"/>) : <>
          <StatCard label="Today's Yield"
            value={stats?.today_yield_kg != null && stats.today_yield_kg > 0
              ? `${(stats.today_yield_kg/1000).toFixed(2)}t`
              : stats?.total_farms === 0 ? 'Setup' : '0.00t'}
            sub={stats?.total_farms === 0
              ? 'Add a farm to start tracking'
              : stats?.today_yield_kg ? `${stats.today_yield_kg.toLocaleString()} kg harvested`
              : 'No harvests logged today'}
            icon={Leaf} accent="green"
            onClick={() => navigate(stats?.total_farms === 0 ? '/farms' : '/analytics')}/>
          <StatCard label="Water Efficiency"
            value={stats?.water_efficiency_pct != null ? `${stats.water_efficiency_pct.toFixed(1)}%` : stats?.total_devices === 0 ? 'Connect' : '—'}
            sub={stats?.total_devices === 0
              ? 'Link IoT sensors to enable'
              : stats?.water_efficiency_pct != null ? 'Live from sensors' : 'Awaiting sensor data'}
            icon={Droplets} accent="blue"
            onClick={() => navigate(stats?.total_devices === 0 ? '/devices' : '/irrigation')}/>
          <StatCard label="Energy Today"
            value={stats?.energy_today_kwh != null ? `${stats.energy_today_kwh} kWh` : stats?.total_devices === 0 ? 'Connect' : '—'}
            sub={stats?.total_devices === 0
              ? 'Link energy meter to enable'
              : stats?.energy_today_kwh != null ? 'Live from energy meter' : 'Awaiting meter data'}
            icon={Zap} accent="amber"
            onClick={() => navigate(stats?.total_devices === 0 ? '/devices' : '/energy')}/>
          <StatCard label="Active Alerts"
            value={stats?.active_alerts ?? 0}
            sub={`${stats?.critical_alerts ?? 0} critical`}
            trendUp={false} icon={AlertTriangle} accent="red"
            onClick={()=>navigate('/alerts')}/>
          <StatCard label="Harvest Ready"
            value={stats?.ready_to_harvest ?? 0}
            sub={stats?.total_farms === 0
              ? 'Add zones to track'
              : stats?.ready_to_harvest ? 'Zones ready today' : 'No zones ready yet'}
            icon={Activity} accent="green"
            onClick={() => navigate(stats?.total_farms === 0 ? '/zones' : '/harvests')}/>
        </>}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Zone health - clickable zones */}
        <div className="card p-4">
          <CardHeader title="Zone Health Map" subtitle="Delhi HQ · 16 zones · click zone to navigate"
            action={<button className="text-xs text-[var(--accent)] hover:underline" onClick={()=>navigate('/zones')}>View all →</button>}/>
          <div className="grid grid-cols-4 gap-1.5">
            {ZONE_DATA.map(({ code, crop, pct, status }) => {
              const border = status==='crit' ? '1px solid rgba(248,81,73,0.5)' : status==='warn' ? '1px solid rgba(227,179,65,0.4)' : '1px solid var(--border)'
              const fill = status==='crit' ? 'rgba(220,38,38,0.10)' : status==='warn' ? 'rgba(245,158,11,0.10)' : 'rgba(13,148,136,0.08)'
              const textColor = status==='crit' ? 'var(--red-light)' : status==='warn' ? 'var(--amber-light)' : 'var(--text)'
              return (
                <div key={code}
                  onClick={()=>navigate('/zones')}
                  title={`${code} — ${crop}: ${pct}% health`}
                  style={{ border, cursor:'pointer', borderRadius:6, position:'relative', overflow:'hidden', aspectRatio:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${pct}%`, background:fill, transition:'height .5s' }}/>
                  <span style={{ position:'relative', fontSize:13, fontWeight:700, color:textColor }}>{pct}%</span>
                  <span style={{ position:'relative', fontSize:8, color:'var(--text3)', lineHeight:1 }}>{code}</span>
                  <span style={{ position:'relative', fontSize:7, color:'var(--text3)', lineHeight:1 }}>{crop}</span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 mt-3 text-[10px] text-muted pt-2 border-t border-[var(--border)]">
            <span className="flex items-center gap-1"><span className="dot dot-green"/>OK</span>
            <span className="flex items-center gap-1"><span className="dot dot-amber"/>Warning</span>
            <span className="flex items-center gap-1"><span className="dot dot-red"/>Critical</span>
          </div>
        </div>

        {/* Live sensors */}
        <div className="card p-4">
          <CardHeader title="Live Sensors — Zone A3" subtitle="Basil · Warning: High Humidity"
            action={
              <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => navigate('/zones')}>
                Details →
              </button>
            }/>
          <div className="space-y-2.5">
            {[
              { label:'Temperature', value:`${liveTemp.toFixed(1)}°C`, pct:66, variant:'blue' as const, ok:true },
              { label:'Humidity (RH)', value:'91.3%', pct:91, variant:'amber' as const, ok:false },
              { label:'CO₂', value:'1,140 ppm', pct:72, variant:'blue' as const, ok:true },
              { label:'PPFD', value:'298 µmol', pct:58, variant:'green' as const, ok:true },
              { label:'pH', value:'6.1', pct:53, variant:'green' as const, ok:true },
              { label:'EC', value:'2.1 mS/cm', pct:62, variant:'blue' as const, ok:true },
              { label:'VPD', value:'0.42 kPa', pct:28, variant:'amber' as const, ok:false },
            ].map(({ label, value, pct, variant, ok }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-muted w-28 flex-shrink-0">{label}</span>
                <div className="flex-1"><ProgressBar value={pct} variant={variant}/></div>
                <span className={`text-xs font-medium w-20 text-right flex-shrink-0 ${ok?'text-[var(--text)]':'text-[var(--amber-light)]'}`}>{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <p className="text-xs text-muted mb-2">Humidity trend — last 8h</p>
            <ResponsiveContainer width="100%" height={60}>
              <AreaChart data={humidTrend.slice(-16)} margin={{top:2,right:0,bottom:0,left:0}}>
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25}/>
                    <stop offset="100%" stopColor="var(--amber-light)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="var(--amber-light)" strokeWidth={1.5} fill="url(#hg)" dot={false}/>
                <Tooltip {...TS} formatter={(v:any)=>[`${v}%`,'RH']}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Alerts with resolve actions */}
        <LiveAlertsPanel alerts={displayAlerts} navigate={navigate}/>
      </div>

      {/* Yield trend chart */}
      {yieldTrend && (
        <div className="card p-4">
          <CardHeader title="Yield Trend — 14 Days" subtitle="All farms combined"
            action={<button className="text-xs text-[var(--accent)] hover:underline" onClick={()=>navigate('/analytics')}>Full analytics →</button>}/>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={yieldTrend.data} margin={{top:5,right:10,bottom:0,left:0}}>
              <defs>
                <linearGradient id="yg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.15}/>
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.2)"/>
              <XAxis dataKey="date" {...AX} tickFormatter={(d:string)=>d?.slice(5)||''}/>
              <YAxis {...AX} width={50} tickFormatter={(v:number)=>`${(v/1000).toFixed(1)}t`}/>
              <Tooltip {...TS} formatter={(v:any)=>[`${(v/1000).toFixed(2)}t`,'']}/>
              <Area type="monotone" dataKey="target_kg" stroke="rgba(110,118,129,0.4)" strokeWidth={1} strokeDasharray="4 4" fill="none" name="Target" dot={false}/>
              <Area type="monotone" dataKey="yield_kg" stroke="var(--accent)" strokeWidth={2} fill="url(#yg)" name="Actual" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Yield forecast */}
        <div className="card p-4">
          <CardHeader title="AI Yield Forecast" subtitle="7-day · 94.1% confidence"/>
          <div className="mb-4">
            <div className="text-3xl font-bold text-[var(--accent)]">28.4t</div>
            <div className="text-xs text-[var(--green-light)] mt-0.5">↑ +6.2% vs target</div>
            <div className="text-xs text-muted mt-1">847 sensors · 4 farms</div>
          </div>
          <div className="space-y-2.5">
            {[{l:'Lettuce',v:96,c:'green'},{l:'Basil',v:81,c:'amber'},{l:'Tomato',v:100,c:'green'}].map(p=>(
              <ProgressBar key={p.l} label={p.l} value={p.v} variant={p.c as any} showPct/>
            ))}
          </div>
          <button className="mt-3 w-full text-xs btn-secondary btn-sm" onClick={() => navigate('/analytics')}>
            View Full Forecast
          </button>
        </div>

        {/* Climate AI with approve/defer */}
        <div className="card p-4">
          <CardHeader title="AI Climate Actions" subtitle={`${climateAI?.actions?.length??3} queued`}
            action={<button className="text-xs text-[var(--accent)] hover:underline" onClick={()=>navigate('/ai')}>View →</button>}/>
          <div className="space-y-2">
            {(climateAI?.actions||[
              {zone:'A3',type:'humidity',priority:'high',action:'Increase exhaust fan speed by 15%',auto_execute:true},
              {zone:'D1',type:'lighting',priority:'medium',action:'Extend photoperiod by 30 minutes',auto_execute:false},
              {zone:'B2',type:'irrigation',priority:'critical',action:'Failover to backup pump',auto_execute:true},
            ]).map((a:any,i:number)=>{
              const [deferred, setDeferred] = React.useState(false)
              return (
                <div key={i} className={`p-2.5 rounded-lg border text-xs ${
                  a.priority==='critical'?'border-red-200 bg-red-50':
                  a.priority==='high'?'border-amber-200 bg-amber-50':
                  'border-slate-200 bg-slate-50'} ${deferred?'opacity-40':''}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant={a.priority==='critical'?'red':a.priority==='high'?'amber':'gray'}>{a.zone}</Badge>
                    <span className="text-muted">{a.type}</span>
                    {a.auto_execute&&<span className="ml-auto text-[10px] text-[var(--green-light)]">AUTO</span>}
                  </div>
                  <div className="text-[var(--text2)] mb-1.5">{a.action}</div>
                  {!a.auto_execute && !deferred && (
                    <div className="flex gap-1.5">
                      <button className="btn-primary btn-sm text-[10px] flex-1" onClick={() => { toast.success(`Action approved for Zone ${a.zone}`); setDeferred(true) }}>
                        Approve
                      </button>
                      <button className="btn-ghost btn-sm text-[10px]" onClick={() => { setDeferred(true); toast.success('Action deferred') }}>
                        Defer
                      </button>
                    </div>
                  )}
                  {deferred && <span className="text-[10px] text-muted">Actioned</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Energy & Sustainability */}
        <div className="card p-4">
          <CardHeader title="Energy & Sustainability" subtitle="Today's performance"/>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              {label:'CO₂ Saved', value: stats?.energy_today_kwh != null ? `${(stats.energy_today_kwh * 0.455).toFixed(0)} kg` : '—', color:'var(--green-light)'},
              {label:'Water Saved', value: stats?.water_efficiency_pct != null ? `${(stats.water_efficiency_pct * 0.045).toFixed(1)} kL` : '—', color:'var(--info)'},
              {label:'Cost Saved',  value: stats?.energy_today_kwh != null ? `₹${(stats.energy_today_kwh * 4.5).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '—', color:'var(--amber-light)'},
            ].map(({label,value,color})=>(
              <div key={label} className="text-center p-2 rounded-lg" style={{background:'var(--bg3)'}}>
                <div className="text-[10px] text-muted mb-1">{label}</div>
                <div className="text-sm font-bold" style={{color}}>{value}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted">Sustainability Score</span>
              <span className="font-medium" style={{color: stats?.sustainability_score != null ? 'var(--green-light)' : 'var(--muted)'}}>
                {stats?.sustainability_score != null ? `${stats.sustainability_score}/100` : '— · Connect sensors'}
              </span>
            </div>
            <ProgressBar value={stats?.sustainability_score ?? 0} variant="green"/>
          </div>
          <button className="mt-3 w-full text-xs btn-secondary btn-sm" onClick={() => navigate('/energy')}>
            View energy details →
          </button>
        </div>
      </div>

      {/* AI Copilot - Full Interactive */}
      <AICopilot/>
    </div>
  )
}
