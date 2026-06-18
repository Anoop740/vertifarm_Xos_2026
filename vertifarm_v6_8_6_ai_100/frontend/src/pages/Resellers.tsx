import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Store, Users, DollarSign, TrendingUp, Plus, ExternalLink,
  CheckCircle, Clock, XCircle, ChevronRight, Building2, Tag,
  BarChart2, AlertCircle, Edit2, Globe,
} from 'lucide-react'

// ─── API ─────────────────────────────────────────────────────────
const resellerApi = {
  getProfile: () => api.get('/api/v1/resellers/me').then(r => r.data).catch(() => null),
  register: (d: any) => api.post('/api/v1/resellers/register', d).then(r => r.data),
  updateProfile: (d: any) => api.patch('/api/v1/resellers/me', d).then(r => r.data),
  getClients: () => api.get('/api/v1/resellers/me/clients').then(r => r.data),
  getCommissions: () => api.get('/api/v1/resellers/me/commissions?months=6').then(r => r.data),
  getDashboard: () => api.get('/api/v1/resellers/me/dashboard').then(r => r.data),
}

// ─── Helpers ─────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  active: '#10b981', pending: '#f59e0b', suspended: '#ef4444', terminated: '#6b7280',
}
const COMM_STATUS_COLOR: Record<string, string> = {
  paid: '#10b981', approved: '#3b82f6', pending: '#f59e0b', cancelled: '#ef4444',
}
const PLAN_COLOR: Record<string, string> = {
  starter: '#64748b', growth: '#3b82f6', enterprise: '#8b5cf6',
}

function fmtINR(paise: number) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function Stat({ icon: Icon, label, value, sub, color = '#00d4aa' }: any) {
  return (
    <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13 }}>
        <Icon size={14} /> {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#475569' }}>{sub}</div>}
    </div>
  )
}

// ─── Register Form ────────────────────────────────────────────────
function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ company_name: '', contact_email: '', brand_name: '', commission_rate: 15 })
  const mutation = useMutation({
    mutationFn: resellerApi.register,
    onSuccess: () => { toast.success('Reseller profile created!'); qc.invalidateQueries({ queryKey: ['reseller-profile'] }); onSuccess() },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Registration failed'),
  })
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', background: '#0c1525', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 16, padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,212,170,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Store size={20} color="#00d4aa" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f6ff' }}>Become a Reseller</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Join the VertiFarm XOS white-label program</div>
        </div>
      </div>
      {[
        { k: 'company_name', label: 'Company Name', placeholder: 'AgTech Distributors Pvt Ltd' },
        { k: 'contact_email', label: 'Contact Email', placeholder: 'sales@yourcompany.com' },
        { k: 'brand_name', label: 'Brand Name (optional)', placeholder: 'Your white-label brand name' },
      ].map(({ k, label, placeholder }) => (
        <div key={k} style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>{label}</label>
          <input
            value={(form as any)[k]} onChange={set(k)} placeholder={placeholder}
            style={{ width: '100%', background: '#060d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '10px 14px', color: '#f0f6ff', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
      ))}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Commission Rate (%)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[15, 17, 20].map(r => (
            <button key={r} onClick={() => setForm(f => ({ ...f, commission_rate: r }))}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${form.commission_rate === r ? '#00d4aa' : 'rgba(148,163,184,0.2)'}`, background: form.commission_rate === r ? 'rgba(0,212,170,0.1)' : '#060d19', color: form.commission_rate === r ? '#00d4aa' : '#94a3b8', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              {r}%
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={() => mutation.mutate(form)}
        disabled={!form.company_name || !form.contact_email || mutation.isPending}
        style={{ width: '100%', padding: '12px 0', borderRadius: 10, background: '#00d4aa', color: '#060d19', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', opacity: mutation.isPending ? 0.7 : 1 }}>
        {mutation.isPending ? 'Registering…' : 'Register as Reseller'}
      </button>
    </div>
  )
}

// ─── Dashboard View ───────────────────────────────────────────────
function ResellerDashboard({ profile }: { profile: any }) {
  const [tab, setTab] = useState<'overview' | 'clients' | 'commissions'>('overview')
  const { data: dash } = useQuery({ queryKey: ['reseller-dash'], queryFn: resellerApi.getDashboard })
  const { data: clients = [] } = useQuery({ queryKey: ['reseller-clients'], queryFn: resellerApi.getClients, enabled: tab === 'clients' || tab === 'overview' })
  const { data: commissions = [] } = useQuery({ queryKey: ['reseller-commissions'], queryFn: resellerApi.getCommissions, enabled: tab === 'commissions' })

  return (
    <div>
      {/* Profile header */}
      <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(0,212,170,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Store size={22} color="#00d4aa" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f6ff' }}>{profile.company_name}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{profile.brand_name || 'White-Label Partner'} · {profile.contact_email}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${STATUS_COLOR[profile.status]}22`, color: STATUS_COLOR[profile.status] }}>
            {profile.status.toUpperCase()}
          </span>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: 'rgba(0,212,170,0.1)', color: '#00d4aa', fontWeight: 600 }}>
            {profile.commission_rate}% Commission
          </span>
        </div>
      </div>

      {/* Stat row */}
      {dash && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
          <Stat icon={Users} label="Total Clients" value={dash.total_clients} sub={`${dash.active_clients} active`} />
          <Stat icon={DollarSign} label="Total Commission" value={fmtINR(dash.total_commission_inr * 100)} sub="All time" color="#10b981" />
          <Stat icon={Clock} label="Pending" value={fmtINR(dash.pending_commission_inr * 100)} sub="Awaiting payout" color="#f59e0b" />
          <Stat icon={TrendingUp} label="This Month" value={fmtINR(dash.this_month_inr * 100)} sub={`Last: ${fmtINR(dash.last_month_inr * 100)}`} color="#3b82f6" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#060d19', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['overview', 'clients', 'commissions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: tab === t ? '#0c1525' : 'transparent', color: tab === t ? '#f0f6ff' : '#64748b', fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && dash && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Plan breakdown */}
          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 16 }}>Client Plan Breakdown</div>
            {Object.entries(dash.plan_breakdown).map(([plan, count]: any) => (
              <div key={plan} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: PLAN_COLOR[plan], display: 'inline-block' }} />
                  <span style={{ fontSize: 13, color: '#94a3b8', textTransform: 'capitalize' }}>{plan}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff' }}>{count} clients</span>
              </div>
            ))}
          </div>
          {/* Top clients */}
          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 16 }}>Top Earning Clients</div>
            {dash.top_clients.map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#f0f6ff', fontWeight: 500 }}>{c.name}</div>
                  <span style={{ fontSize: 11, color: PLAN_COLOR[c.plan] || '#64748b', textTransform: 'capitalize' }}>{c.plan}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{fmtINR(c.commission_inr * 100)}/mo</span>
              </div>
            ))}
          </div>
          {/* Monthly trend */}
          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 16 }}>Monthly Commission Trend</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
              {dash.monthly_trend.map((m: any) => {
                const maxVal = Math.max(...dash.monthly_trend.map((x: any) => x.commission_inr))
                const h = Math.max(8, (m.commission_inr / maxVal) * 80)
                return (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{fmtINR(m.commission_inr * 100)}</div>
                    <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg,#00d4aa,#0891b2)', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>{m.month.split(' ')[0]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Clients tab */}
      {tab === 'clients' && (
        <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                {['Organisation', 'Plan', 'Referred', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(clients as any[]).map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={14} color="#64748b" />
                      <span style={{ fontSize: 14, color: '#f0f6ff', fontWeight: 500 }}>{c.org_name || c.organization_id}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: `${PLAN_COLOR[c.org_plan] || '#475569'}22`, color: PLAN_COLOR[c.org_plan] || '#94a3b8', textTransform: 'capitalize' }}>
                      {c.org_plan || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>
                    {new Date(c.referred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: c.is_active ? '#10b981' : '#ef4444' }}>
                      {c.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Commissions tab */}
      {tab === 'commissions' && (
        <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                {['Client', 'Month', 'Plan', 'Base Amount', 'Rate', 'Commission', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(commissions as any[]).slice(0, 20).map((c: any, i: number) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#f0f6ff', fontWeight: 500 }}>{c.client_org_name || c.client_org_id}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{c.month_key}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, color: PLAN_COLOR[c.plan] || '#64748b', textTransform: 'capitalize' }}>{c.plan || '—'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{fmtINR(c.base_amount_inr)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{c.commission_rate}%</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#10b981' }}>{fmtINR(c.commission_inr)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: `${COMM_STATUS_COLOR[c.status]}22`, color: COMM_STATUS_COLOR[c.status], textTransform: 'capitalize' }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function ResellersPage() {
  const qc = useQueryClient()
  const { data: profile, isLoading } = useQuery({ queryKey: ['reseller-profile'], queryFn: resellerApi.getProfile })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading reseller profile…</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Store size={20} color="#00d4aa" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>White-Label Reseller Program</h1>
        </div>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Resell VertiFarm XOS under your brand. Earn 15–20% recurring commission on every referred organisation.
        </p>
      </div>

      {profile ? (
        <ResellerDashboard profile={profile} />
      ) : (
        <RegisterForm onSuccess={() => qc.invalidateQueries({ queryKey: ['reseller-profile'] })} />
      )}
    </div>
  )
}
