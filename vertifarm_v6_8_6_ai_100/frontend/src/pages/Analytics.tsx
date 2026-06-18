import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api'
import { StatCard, ProgressBar, Badge } from '@/components/ui'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { randomBetween } from '@/lib/utils'

const TS = { contentStyle:{background:'white',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8,fontSize:11,color:'#0f172a',boxShadow:'0 4px 12px rgba(15,23,42,0.08)'}, labelStyle:{color:'#64748b'} }
const AX = { tick:{fontSize:10,fill:'#94a3b8'}, axisLine:false, tickLine:false }
const gen=(n:number,base:number,spread:number)=>Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(n-i));return{date:d.toLocaleDateString('en-IN',{month:'short',day:'numeric'}),value:randomBetween(base-spread,base+spread)}})

const CROP_PIE=[{name:'Lettuce',value:38,color:'#0d9488'},{name:'Tomato',value:24,color:'#3b82f6'},{name:'Spinach',value:16,color:'#059669'},{name:'Basil',value:12,color:'#f59e0b'},{name:'Others',value:10,color:'#94a3b8'}]
const ENERGY_BREAKDOWN=[{label:'Lighting',kwh:180,pct:58},{label:'HVAC',kwh:75,pct:24},{label:'Irrigation',kwh:28,pct:9},{label:'CO₂',kwh:18,pct:6},{label:'Other',kwh:11,pct:3}]

export default function AnalyticsPage() {
  const [period,setPeriod] = useState(30)
  const {data:yieldTrend} = useQuery({queryKey:['yield-trend',period],queryFn:()=>analyticsApi.yieldTrend(period)})
  const {data:waterData} = useQuery({queryKey:['water',period],queryFn:()=>analyticsApi.waterUsage(period)})
  const energyData = gen(period,320,40)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Business Intelligence & Analytics</h1>
          <p className="text-xs text-muted mt-0.5">Performance metrics, trends, and insights across all farms</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[7,14,30,90].map(d=>(
              <button key={d} onClick={()=>setPeriod(d)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-all ${period===d?'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]':'border-[var(--border)] text-muted hover:text-[var(--text)]'}`}>
                {d}d
              </button>
            ))}
          </div>
          <button className="btn-secondary text-xs">Export CSV</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {label:'Period Yield',value:period===30?'128.4t':period===7?'30.1t':period===14?'59.8t':'384t',sub:`${period}d total`,trend:'↑ 6.2% vs prev period',trendUp:true,accent:'green'},
          {label:'Water Efficiency',value:'94.2%',sub:'Liters per kg',trend:'↑ 1.8% this period',trendUp:true,accent:'blue'},
          {label:'Energy Cost',value:'₹2.4L',sub:`${period}d · AI optimized`,trend:'↓ 8% vs prev',trendUp:true,accent:'amber'},
          {label:'Crop Loss Rate',value:'1.2%',sub:'Below 2% target',trend:'↓ 0.4% improvement',trendUp:true,accent:'green'},
        ].map(p=><StatCard key={p.label} {...p as any}/>)}
      </div>

      {/* Yield trend */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Yield Trend — {period} Days</h3>
            <p className="text-xs text-muted">Actual vs target across all farms</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-0.5 bg-[var(--accent)]"/>Actual</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-0.5 border-t border-dashed border-[var(--text3)]"/>Target</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={yieldTrend?.data||[]} margin={{top:5,right:10,bottom:0,left:0}}>
            <defs>
              <linearGradient id="yg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3}/>
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.15)"/>
            <XAxis dataKey="date" {...AX} interval={Math.floor(period/7)} tickFormatter={(d:string)=>d?.slice(5)||''}/>
            <YAxis {...AX} width={50} tickFormatter={(v:number)=>`${(v/1000).toFixed(1)}t`}/>
            <Tooltip {...TS} formatter={(v:any)=>[`${(v/1000).toFixed(2)}t`,'']}/>
            <Area type="monotone" dataKey="target_kg" stroke="rgba(139,148,158,0.4)" strokeWidth={1} strokeDasharray="4 4" fill="none" name="Target" dot={false}/>
            <Area type="monotone" dataKey="yield_kg" stroke="var(--accent)" strokeWidth={2} fill="url(#yg2)" name="Actual" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row: Crop distribution + Energy */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Crop Distribution by Volume</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={CROP_PIE} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={0}>
                  {CROP_PIE.map((e,i)=><Cell key={i} fill={e.color} opacity={0.85}/>)}
                </Pie>
                <Tooltip {...TS} formatter={(v:any)=>[`${v}%`,'']}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {CROP_PIE.map(({name,value,color})=>(
                <div key={name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:color}}/>
                    <span className="text-xs text-muted">{name}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text)]">{value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Energy Consumption — {period} Days</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={energyData.slice(-14)} margin={{top:5,right:10,bottom:0,left:0}}>
              <CartesianGrid stroke="rgba(148,163,184,0.15)"/>
              <XAxis dataKey="date" {...AX}/>
              <YAxis {...AX} width={38}/>
              <Tooltip {...TS} formatter={(v:any)=>[`${v} kWh`,'Energy']}/>
              <Bar dataKey="value" fill="var(--accent)" opacity={0.8} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {ENERGY_BREAKDOWN.map(({label,kwh,pct})=>(
              <div key={label} className="grid grid-cols-[90px_1fr_60px] items-center gap-2">
                <span className="text-xs text-muted">{label}</span>
                <ProgressBar value={pct} variant={label==='Lighting'?'amber':'blue'}/>
                <span className="text-xs text-right text-[var(--text)]">{kwh} kWh</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Water efficiency */}
      <div className="card p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Water Efficiency Trend</h3>
            <p className="text-xs text-muted">Liters used per kg of yield</p>
          </div>
          <div className="flex gap-4 text-center">
            {[{label:'Avg Efficiency',value:'94.2%',color:'text-[var(--info)]'},{label:'Water Used',value:'58.4 kL',color:'text-[var(--text)]'},{label:'vs Soil Farm',value:'−95.2%',color:'text-[var(--green-light)]'}].map(({label,value,color})=>(
              <div key={label}>
                <div className="text-xs text-muted">{label}</div>
                <div className={`text-lg font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={waterData?.data||[]} margin={{top:5,right:10,bottom:0,left:0}}>
            <CartesianGrid stroke="rgba(148,163,184,0.15)"/>
            <XAxis dataKey="date" {...AX} interval={Math.floor(period/5)} tickFormatter={(d:string)=>d?.slice(5)||''}/>
            <YAxis {...AX} width={38}/>
            <Tooltip {...TS} formatter={(v:any)=>[`${v}%`,'Efficiency']}/>
            <Line type="monotone" dataKey="efficiency_pct" stroke="var(--info)" strokeWidth={2} dot={false} name="Efficiency %"/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
