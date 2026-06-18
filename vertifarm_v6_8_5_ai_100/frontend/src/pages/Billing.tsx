import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { billingApi } from '@/lib/api'
import { Button, Badge, StatCard } from '@/components/ui'
import {
  CreditCard, Zap, TrendingUp, Shield, CheckCircle2, XCircle,
  AlertTriangle, ExternalLink, RefreshCw, Download, ChevronRight,
  Star, Building2, Cpu, Users, Clock, Layers
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

const PLAN_COLORS: Record<string,{accent:string,bg:string,border:string}> = {
  starter:    { accent:'#64748b', bg:'rgba(100,116,139,0.08)', border:'rgba(100,116,139,0.25)' },
  growth:     { accent:'#00d4aa', bg:'rgba(0,212,170,0.08)',   border:'rgba(0,212,170,0.3)'   },
  enterprise: { accent:'#3d8bff', bg:'rgba(61,139,255,0.08)',  border:'rgba(61,139,255,0.3)'  },
}

const PLAN_FEATURES: Record<string, string[]> = {
  starter: ['1 farm · 10 zones · 50 sensors','3 user accounts','Basic AI forecasting','30-day data retention','Email support'],
  growth:  ['5 farms · 60 zones · 500 sensors','15 user accounts','Full AI intelligence suite','Harvest traceability + QR','1-year data retention','API access 300 req/min','Webhook integrations','Priority support'],
  enterprise: ['Unlimited farms, zones & sensors','Unlimited user accounts','Dedicated ML model training','Computer vision integration','FSSAI/GlobalGAP compliance PDFs','Custom API SLA 1000 req/min','White-label + custom domain','Dedicated success manager'],
}

const PLAN_PRICES: Record<string,{monthly:number,annual:number}> = {
  starter:    { monthly:4999,  annual:49990  },
  growth:     { monthly:14999, annual:149990 },
  enterprise: { monthly:49999, annual:499990 },
}

function UsageBar({ label, used, limit, icon: Icon, color }: any) {
  const unlimited = limit === -1
  const pct = unlimited ? 0 : Math.min(100, Math.round(used / limit * 100))
  const isWarning = !unlimited && pct >= 80
  const isOver    = !unlimited && pct >= 100
  const barColor  = isOver ? '#ff4d6d' : isWarning ? '#ffb547' : color || '#00d4aa'

  return (
    <div style={{ padding:'14px 16px', borderRadius:12, background:'rgba(0,0,0,0.15)', border:'1px solid rgba(99,160,255,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:`${barColor}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon size={13} color={barColor}/>
          </div>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{label}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {isWarning && !isOver && <AlertTriangle size={12} color="#ffb547"/>}
          {isOver && <AlertTriangle size={12} color="#ff4d6d"/>}
          <span style={{ fontSize:11, fontFamily:'DM Mono,monospace', color: isOver ? '#ff4d6d' : isWarning ? '#ffb547' : 'var(--text3)' }}>
            {used} / {unlimited ? '∞' : limit}
          </span>
          {!unlimited && <span style={{ fontSize:10, color:'var(--text3)' }}>({pct}%)</span>}
        </div>
      </div>
      <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:2, background:barColor, width:`${unlimited ? 0 : pct}%`, transition:'width 0.6s ease' }}/>
      </div>
      {isWarning && !isOver && (
        <p style={{ fontSize:10, color:'#ffb547', marginTop:6 }}>⚠ Approaching limit — consider upgrading</p>
      )}
      {isOver && (
        <p style={{ fontSize:10, color:'#ff4d6d', marginTop:6 }}>✗ Limit reached — upgrade to add more</p>
      )}
    </div>
  )
}

function PlanCard({ planKey, currentPlan, onUpgrade, interval }: any) {
  const col = PLAN_COLORS[planKey] || PLAN_COLORS.starter
  const isCurrent = currentPlan === planKey
  const isDowngrade = ['starter','growth','enterprise'].indexOf(planKey) < ['starter','growth','enterprise'].indexOf(currentPlan)
  const price = interval === 'annual'
    ? PLAN_PRICES[planKey]?.annual
    : PLAN_PRICES[planKey]?.monthly
  const annualSave = Math.round((PLAN_PRICES[planKey]?.monthly * 12 - PLAN_PRICES[planKey]?.annual) / 100)

  return (
    <div style={{
      background: isCurrent ? col.bg : 'var(--bg3)',
      border: `1.5px solid ${isCurrent ? col.border : 'rgba(99,160,255,0.1)'}`,
      borderRadius:16, padding:'28px 24px', position:'relative', overflow:'hidden',
      transition:'all 0.2s',
    }}>
      {isCurrent && (
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${col.accent},transparent)` }}/>
      )}
      {planKey === 'growth' && !isCurrent && (
        <div style={{ position:'absolute', top:14, right:14, fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:100, background:'#00d4aa', color:'#030c14', fontFamily:'DM Mono,monospace', letterSpacing:'0.06em' }}>POPULAR</div>
      )}

      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:col.accent, marginBottom:12, fontFamily:"'Syne',sans-serif" }}>{planKey}</div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:36, fontWeight:800, color:'var(--text)', lineHeight:1, marginBottom:4 }}>
        <span style={{ fontSize:18, verticalAlign:'top', marginTop:4, display:'inline-block' }}>₹</span>
        {price?.toLocaleString('en-IN')}
        <span style={{ fontSize:13, color:'var(--text3)', fontWeight:400 }}>/mo</span>
      </div>
      {interval === 'annual' && (
        <p style={{ fontSize:10, color:'#00e87a', marginBottom:14, fontFamily:'DM Mono,monospace' }}>Save ₹{annualSave?.toLocaleString('en-IN')}/yr vs monthly</p>
      )}

      <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:8, margin:'16px 0 24px', padding:0 }}>
        {PLAN_FEATURES[planKey]?.map(f => (
          <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'var(--text2)' }}>
            <CheckCircle2 size={13} color={col.accent} style={{ flexShrink:0, marginTop:1 }}/>{f}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div style={{ width:'100%', padding:'11px', borderRadius:10, border:`1px solid ${col.border}`, background:col.bg, textAlign:'center', fontSize:12, fontWeight:700, color:col.accent, fontFamily:"'Syne',sans-serif" }}>
          ✓ Current Plan
        </div>
      ) : (
        <button onClick={() => onUpgrade(planKey)} style={{
          width:'100%', padding:'11px', borderRadius:10, border:'none',
          background: planKey === 'enterprise' ? 'linear-gradient(135deg,#3d8bff,#2563eb)' : planKey === 'growth' ? 'linear-gradient(135deg,#00d4aa,#00b892)' : 'rgba(255,255,255,0.06)',
          color: isDowngrade ? 'var(--text3)' : planKey === 'growth' ? '#030c14' : 'white',
          fontSize:13, fontWeight:700, fontFamily:"'Syne',sans-serif", cursor:'pointer',
          boxShadow: planKey !== 'starter' ? `0 4px 14px ${col.accent}30` : 'none',
        }}>
          {isDowngrade ? 'Downgrade' : planKey === 'enterprise' ? 'Contact Sales' : 'Upgrade'} <ChevronRight size={13} style={{ verticalAlign:'middle' }}/>
        </button>
      )}
    </div>
  )
}

export default function BillingPage() {
  const qc = useQueryClient()
  const [interval, setInterval] = useState<'monthly'|'annual'>('monthly')
  const [portalLoading, setPortalLoading] = useState(false)

  const { data, isLoading } = useQuery({ queryKey:['billing'], queryFn: billingApi.get })
  const { data: invoices = [] } = useQuery({ queryKey:['invoices'], queryFn: () => billingApi.invoices(10) })

  const sub   = (data as any)?.subscription
  const usage = (data as any)?.usage
  const plan  = sub?.plan || 'starter'
  const status = sub?.status || 'trialing'

  const trialEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : null

  const handleUpgrade = async (targetPlan: string) => {
    if (targetPlan === 'enterprise') { window.location.href = 'mailto:sales@vertifarm.io'; return }
    try {
      const res = await billingApi.checkout(targetPlan, interval)
      if (res?.checkout_url) window.open(res.checkout_url, '_blank')
      if (res?.demo_mode) toast.success('Demo mode: Stripe not configured. Set STRIPE_SECRET_KEY to enable payments.')
    } catch { toast.error('Failed to open checkout. Please try again.') }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await billingApi.portal()
      if (res?.portal_url) window.open(res.portal_url, '_blank')
      if (res?.demo_mode) toast.success('Demo mode: Stripe not configured.')
    } catch { toast.error('Failed to open billing portal.') }
    finally { setPortalLoading(false) }
  }

  const planCol = PLAN_COLORS[plan] || PLAN_COLORS.starter

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize:16, fontWeight:800, color:'var(--text)', fontFamily:"'Syne',sans-serif" }}>Billing & Subscription</h1>
          <p className="text-xs text-muted mt-0.5">Manage your plan, usage, team limits, and payment details</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey:['billing'] })}><RefreshCw className="w-3.5 h-3.5"/></Button>
          <Button variant="secondary" onClick={handlePortal} loading={portalLoading}><CreditCard className="w-3.5 h-3.5"/> Billing Portal</Button>
        </div>
      </div>

      {/* current plan banner */}
      <div style={{ padding:'20px 24px', borderRadius:16, background:planCol.bg, border:`1px solid ${planCol.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${planCol.accent},transparent)` }}/>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:planCol.accent, fontFamily:"'Syne',sans-serif" }}>{plan} plan</span>
            <Badge variant={status === 'active' ? 'green' : status === 'trialing' ? 'blue' : status === 'past_due' ? 'red' : 'gray'}>{status}</Badge>
          </div>
          <div style={{ fontSize:13, color:'var(--text2)' }}>
            {status === 'trialing' && trialDaysLeft !== null && (
              <span style={{ color: trialDaysLeft <= 3 ? '#ffb547' : 'var(--text2)' }}>
                {trialDaysLeft === 0 ? '⚠ Trial expires today!' : `Trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''}`}
              </span>
            )}
            {status === 'active' && sub?.current_period_end && (
              <span>Next billing: {new Date(sub.current_period_end).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</span>
            )}
            {status === 'past_due' && <span style={{ color:'#ff4d6d' }}>⚠ Payment failed — update your payment method</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {status === 'trialing' && (
            <button onClick={() => handleUpgrade('growth')} style={{ padding:'10px 20px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#00d4aa,#00b892)', color:'#030c14', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Syne',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
              <Zap size={13}/> Upgrade Now
            </button>
          )}
          {sub?.has_payment_method && (
            <button onClick={handlePortal} style={{ padding:'10px 20px', borderRadius:9, border:'1px solid rgba(99,160,255,0.2)', background:'transparent', color:'var(--text2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Syne',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
              <ExternalLink size={12}/> Manage
            </button>
          )}
        </div>
      </div>

      {/* usage */}
      {usage && (
        <div>
          <h2 style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:14, fontFamily:"'Syne',sans-serif" }}>Resource Usage</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
            <UsageBar label="Farms" used={usage.farms?.used} limit={usage.farms?.limit} icon={Building2} color="#00d4aa"/>
            <UsageBar label="Zones" used={usage.zones?.used} limit={usage.zones?.limit} icon={Layers} color="#3d8bff"/>
            <UsageBar label="Devices / Sensors" used={usage.sensors?.used} limit={usage.sensors?.limit} icon={Cpu} color="#a78bfa"/>
            <UsageBar label="Team Members" used={usage.users?.used} limit={usage.users?.limit} icon={Users} color="#ffb547"/>
          </div>
          {/* feature flags */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
            {Object.entries(usage.features || {}).map(([key, val]) => (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:8, border:'1px solid rgba(99,160,255,0.1)', background:'var(--bg3)', fontSize:11, color: val ? 'var(--green)' : 'var(--text3)' }}>
                {val ? <CheckCircle2 size={11}/> : <XCircle size={11}/>}
                {key.replace(/_/g,' ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* plan comparison */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize:13, fontWeight:700, color:'var(--text)', fontFamily:"'Syne',sans-serif" }}>Choose your plan</h2>
          <div style={{ display:'flex', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(99,160,255,0.12)', borderRadius:8, padding:3, gap:2 }}>
            {(['monthly','annual'] as const).map(iv => (
              <button key={iv} onClick={() => setInterval(iv)} style={{
                padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer',
                background: interval === iv ? 'var(--accent)' : 'transparent',
                color: interval === iv ? '#030c14' : 'var(--text3)',
                fontSize:11, fontWeight:700, fontFamily:"'Syne',sans-serif", transition:'all 0.15s',
              }}>
                {iv.charAt(0).toUpperCase() + iv.slice(1)}
                {iv === 'annual' && <span style={{ marginLeft:4, fontSize:9, opacity:0.8 }}>-17%</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {['starter','growth','enterprise'].map(p => (
            <PlanCard key={p} planKey={p} currentPlan={plan} onUpgrade={handleUpgrade} interval={interval}/>
          ))}
        </div>
      </div>

      {/* invoices */}
      <div>
        <h2 style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:14, fontFamily:"'Syne',sans-serif" }}>Invoice History</h2>
        {(invoices as any[]).length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', borderRadius:12, border:'1px solid rgba(99,160,255,0.08)', color:'var(--text3)', fontSize:13 }}>
            No invoices yet. Your first invoice will appear here after your trial ends.
          </div>
        ) : (
          <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid rgba(99,160,255,0.1)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'rgba(0,0,0,0.2)' }}>
                  {['Date','Amount','Status',''].map(h => (
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text3)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(invoices as any[]).map((inv: any) => (
                  <tr key={inv.id} style={{ borderTop:'1px solid rgba(99,160,255,0.06)' }}>
                    <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text2)' }}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
                    <td style={{ padding:'12px 16px', fontSize:12, fontWeight:600, color:'var(--text)', fontFamily:'DM Mono,monospace' }}>₹{inv.amount_inr?.toLocaleString('en-IN')}</td>
                    <td style={{ padding:'12px 16px' }}><Badge variant={inv.status==='paid'?'green':inv.status==='open'?'amber':'gray'}>{inv.status}</Badge></td>
                    <td style={{ padding:'12px 16px' }}>
                      {inv.pdf_url && (
                        <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--accent)', textDecoration:'none' }}>
                          <Download size={11}/> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* security note */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, background:'rgba(0,212,170,0.04)', border:'1px solid rgba(0,212,170,0.12)' }}>
        <Shield size={14} color="#00d4aa"/>
        <span style={{ fontSize:11, color:'var(--text3)' }}>All payments are processed securely by Stripe. VertiFarm XOS never stores your card details. All transactions are encrypted with 256-bit TLS.</span>
      </div>
    </div>
  )
}
