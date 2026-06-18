import React, { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aiApi } from '@/lib/api'
import { Badge, ProgressBar, StatCard } from '@/components/ui'
import { Bot, Send, Brain, TrendingUp, AlertTriangle, Zap } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'

const TS = { contentStyle:{background:'white',border:'1px solid rgba(148,163,184,0.2)',borderRadius:8,fontSize:11,color:'#0f172a',boxShadow:'0 4px 12px rgba(15,23,42,0.08)'}, labelStyle:{color:'#64748b'} }
const RADAR_DATA = [
  {s:'Temperature',A:92},{s:'Humidity',A:68},{s:'Nutrients',A:88},
  {s:'Light',A:95},{s:'pH',A:90},{s:'CO₂',A:84},
]
const CROP_FC = [
  {crop:'Lettuce',forecast:420,target:400,confidence:96},
  {crop:'Spinach',forecast:310,target:300,confidence:91},
  {crop:'Basil',forecast:185,target:220,confidence:81},
  {crop:'Tomato',forecast:890,target:850,confidence:94},
  {crop:'Micro',forecast:95,target:90,confidence:88},
]

// FIX-3: Chat message type includes role for LLM history
type ChatMsg = { role: 'user' | 'assistant'; text: string }

export default function AIPage() {
  const [chat, setChat] = useState<ChatMsg[]>([
    { role: 'assistant', text: "Hello! I'm your AI Agronomist. Ask me anything about your crops, nutrients, climate, energy, or pests." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const {data:forecast} = useQuery({queryKey:['ai-forecast'],queryFn:()=>aiApi.yieldForecast(),refetchInterval:60000})
  const {data:climate} = useQuery({queryKey:['ai-climate'],queryFn:()=>aiApi.climateOptimize(),refetchInterval:60000})
  const {data:disease} = useQuery({queryKey:['ai-disease'],queryFn:aiApi.diseaseRisk})
  const {data:energy} = useQuery({queryKey:['ai-energy'],queryFn:aiApi.energyOptimize})

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[chat])

  // FIX-3: Real API call — replaces keyword-matching RESPONSES dict
  const send = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    setError(null)
    const newUserMsg: ChatMsg = { role: 'user', text: msg }
    setChat(h => [...h, newUserMsg])
    setLoading(true)

    try {
      // Build history in LLM format from current chat state
      const history = chat.map(m => ({ role: m.role, content: m.text }))
      const result = await aiApi.chat(msg, history)
      setChat(h => [...h, { role: 'assistant', text: result.reply }])
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || 'AI service unavailable. Please try again.'
      setError(errMsg)
      setChat(h => [...h, { role: 'assistant', text: `⚠️ ${errMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = ['Why is humidity high in A3?','Yield forecast this week','Energy optimization tips','Disease risk assessment','Pump failure B2 status']

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'var(--accent-soft)',border:'1px solid rgba(13,148,136,0.3)'}}>
          <Brain className="w-5 h-5 text-[var(--accent)]"/>
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">AI Intelligence</h1>
          <p className="text-xs text-muted">VertiFarm-Agro-v2 · 847 sensor inputs · Last trained 6h ago</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-[var(--green-light)]">
          <span className="dot dot-green"/>AI ONLINE
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: insights */}
        <div className="xl:col-span-2 space-y-4">
          {/* Yield forecast */}
          <div className="card p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">7-Day Yield Forecast</h3>
                <p className="text-xs text-muted mt-0.5">94.1% model confidence · All farms</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[var(--accent)]">28.4t</div>
                <div className="text-xs text-[var(--green-light)]">↑ +6.2% vs target</div>
              </div>
            </div>
            <div className="mb-4">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={CROP_FC} margin={{top:5,right:10,bottom:0,left:0}}>
                  <XAxis dataKey="crop" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'#94a3b8'}} width={35} axisLine={false} tickLine={false}/>
                  <Tooltip {...TS} formatter={(v:any,n:string)=>[`${v}kg`,n]}/>
                  <Bar dataKey="target" fill="rgba(148,163,184,0.25)" radius={[3,3,0,0]} name="Target"/>
                  <Bar dataKey="forecast" radius={[3,3,0,0]} name="Forecast">
                    {CROP_FC.map((e,i)=><Cell key={i} fill={e.forecast>=e.target?'var(--accent)':e.forecast>=e.target*.85?'var(--amber-light)':'var(--red-light)'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {CROP_FC.map(({crop,forecast,target,confidence})=>(
                <div key={crop} className="grid grid-cols-[80px_1fr_70px_50px] items-center gap-3">
                  <span className="text-xs text-muted">{crop}</span>
                  <ProgressBar value={forecast} max={target*1.2} variant={forecast>=target?'green':forecast>=target*.85?'amber':'red'}/>
                  <span className="text-xs text-right text-[var(--text)]">{forecast}kg</span>
                  <Badge variant={confidence>=90?'green':'amber'}>{confidence}%</Badge>
                </div>
              ))}
            </div>
            {forecast?.recommendations&&(
              <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-1.5">
                <p className="text-xs font-semibold text-[var(--text)] mb-2">Recommendations</p>
                {forecast.recommendations.map((r:string,i:number)=>(
                  <div key={i} className="flex gap-2 text-xs p-2 rounded" style={{background:'var(--bg3)'}}>
                    <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0 mt-0.5"/>{r}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Climate + Disease */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Climate Actions</h3>
              <div className="space-y-2">
                {(climate?.actions||[
                  {zone:'A3',type:'humidity',priority:'high',action:'Increase exhaust fan 15%',auto_execute:true},
                  {zone:'D1',type:'lighting',priority:'medium',action:'Extend photoperiod 30min',auto_execute:false},
                  {zone:'B2',type:'irrigation',priority:'critical',action:'Failover to backup pump',auto_execute:true},
                ]).map((a:any,i:number)=>(
                  <div key={i} className={`p-2.5 rounded-lg text-xs border ${a.priority==='critical'?'border-red-200 bg-red-50':a.priority==='high'?'border-amber-200 bg-amber-50':'border-[var(--border)]'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant={a.priority==='critical'?'red':a.priority==='high'?'amber':'gray'}>{a.zone}</Badge>
                      <span className="text-muted">{a.type}</span>
                      {a.auto_execute&&<span className="ml-auto text-[10px] text-[var(--green-light)]">AUTO</span>}
                    </div>
                    <div className="text-[var(--text2)]">{a.action}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Disease Risk</h3>
              <div className="space-y-2">
                {(disease?.assessments||[
                  {zone:'A3',crop:'Basil',risk_level:'medium',disease:'Botrytis (Gray Mold)',probability:0.34},
                  {zone:'C3',crop:'Strawberry',risk_level:'low',disease:'Powdery Mildew',probability:0.12},
                  {zone:'D1',crop:'Tomato',risk_level:'low',disease:'Fusarium Wilt',probability:0.08},
                ]).map((a:any,i:number)=>(
                  <div key={i} className="p-2.5 rounded-lg text-xs border border-[var(--border)]" style={{background:'var(--bg3)'}}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`dot ${a.risk_level==='high'?'dot-red':a.risk_level==='medium'?'dot-amber':'dot-green'}`}/>
                        <Badge variant="gray">{a.zone}</Badge>
                        <span className="text-muted">{a.crop}</span>
                      </div>
                      <span className={`font-bold ${a.risk_level==='high'?'text-[var(--red-light)]':a.risk_level==='medium'?'text-[var(--amber-light)]':'text-[var(--green-light)]'}`}>
                        {(a.probability*100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-muted">{a.disease}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: health radar + copilot */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-1">Farm Health Score</h3>
            <div className="text-right text-xs text-muted mb-2">87 / 100 · Platinum</div>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={RADAR_DATA}>
                <PolarGrid stroke="rgba(148,163,184,0.2)"/>
                <PolarAngleAxis dataKey="s" tick={{fontSize:9,fill:'#94a3b8'}}/>
                <Radar name="Health" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} strokeWidth={1.5}/>
              </RadarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              {RADAR_DATA.map(({s,A})=>(
                <div key={s} className="flex items-center justify-between">
                  <span className="text-xs text-muted">{s}</span>
                  <span className={`text-xs font-bold ${A>=85?'text-[var(--green-light)]':A>=70?'text-[var(--amber-light)]':'text-[var(--red-light)]'}`}>{A}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Copilot Chat */}
          <div className="card flex flex-col" style={{height:380}}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
              <Bot className="w-4 h-4 text-[var(--accent)]"/>
              <span className="text-sm font-semibold text-[var(--text)]">AI Agronomist</span>
              <span className="ml-auto text-[10px] text-[var(--green-light)] flex items-center gap-1"><span className="dot dot-green"/>Online</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chat.map((m,i)=>(
                <div key={i} className={`flex gap-2 ${m.role==='user'?'flex-row-reverse':''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${m.role==='assistant'?'':'bg-[var(--surface2)]'}`}
                    style={m.role==='assistant'?{background:'var(--accent-soft)',border:'1px solid rgba(13,148,136,0.3)'}:{}}>
                    {m.role==='assistant'?<Bot className="w-3 h-3 text-[var(--accent)]"/>:'U'}
                  </div>
                  <div className={`text-xs leading-relaxed p-2.5 rounded-lg max-w-[85%] ${m.role==='assistant'?'text-[var(--text2)]':'text-[var(--text)]'}`}
                    style={m.role==='assistant'?{background:'var(--bg3)',border:'1px solid var(--border)'}:{background:'var(--accent-soft)',border:'1px solid rgba(13,148,136,0.2)'}}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading&&(
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{background:'var(--accent-soft)',border:'1px solid rgba(13,148,136,0.3)'}}>
                    <Bot className="w-3 h-3 text-[var(--accent)]"/>
                  </div>
                  <div className="p-2.5 rounded-lg flex gap-1" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                    {[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{animationDelay:`${i*150}ms`}}/>)}
                  </div>
                </div>
              )}
              <div ref={endRef}/>
            </div>
            <div className="p-2 border-t" style={{borderColor:'var(--border)'}}>
              <div className="flex flex-wrap gap-1 mb-2">
                {suggestions.slice(0,3).map(s=>(
                  <button key={s} onClick={()=>{setInput(s)}} className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] text-muted hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all">{s}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
                  className="input flex-1 text-xs py-1.5" placeholder="Ask your agronomist..."/>
                <button onClick={send} className="btn-primary btn-sm"><Send className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
