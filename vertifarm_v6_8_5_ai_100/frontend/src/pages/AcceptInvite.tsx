import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { teamApi } from '@/lib/api'
import { Leaf, Eye, EyeOff, Users, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { fetchMe } = useAuthStore()
  const token = params.get('token') || ''
  const [form, setForm] = useState({ full_name:'', password:'', confirm:'' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!token) return (
    <Wrapper>
      <AlertCircle size={40} color="#ff4d6d" style={{ margin:'0 auto 14px', display:'block' }}/>
      <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, color:'#f0f6ff', textAlign:'center', marginBottom:8 }}>Invalid invite link</h2>
      <p style={{ fontSize:13, color:'#8ba3c4', textAlign:'center' }}>This link is invalid or has expired. Contact your team admin for a new invitation.</p>
    </Wrapper>
  )

  const set = (k: string, v: string) => { setForm(f => ({...f,[k]:v})); setError('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Full name is required'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await teamApi.acceptInvite(token, form.full_name, form.password)
      localStorage.setItem('access_token', res.access_token)
      localStorage.setItem('refresh_token', res.refresh_token)
      await fetchMe()
      toast.success('Welcome to the team! 🎉')
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to accept invitation.')
    } finally { setLoading(false) }
  }

  return (
    <Wrapper>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#3d8bff,#2563eb)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 0 20px rgba(61,139,255,0.3)' }}>
          <Users size={24} color="white" strokeWidth={2}/>
        </div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:'#f0f6ff', marginBottom:8 }}>Accept invitation</h1>
        <p style={{ fontSize:13, color:'#8ba3c4', lineHeight:1.6 }}>Create your account to join your team on VertiFarm XOS.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label style={lbl}>FULL NAME</label>
          <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Your full name" style={iStyle}/>
        </div>
        <div>
          <label style={lbl}>PASSWORD</label>
          <div style={{ position:'relative' }}>
            <input type={showPw?'text':'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" style={iStyle}/>
            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#4a6080' }}>
              {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
            </button>
          </div>
        </div>
        <div>
          <label style={lbl}>CONFIRM PASSWORD</label>
          <input type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)} placeholder="Re-enter password" style={iStyle}/>
        </div>
        {error && <p style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#ff4d6d' }}><AlertCircle size={11}/>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop:6, padding:'13px', borderRadius:10, border:'none', background: loading ? 'rgba(61,139,255,0.2)' : 'linear-gradient(135deg,#3d8bff,#2563eb)', color: loading ? '#4a6080' : 'white', fontSize:14, fontWeight:800, fontFamily:"'Syne',sans-serif", cursor: loading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 14px rgba(61,139,255,0.25)' }}>
          {loading ? <><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Joining...</> : <>Join Team <CheckCircle2 size={14}/></>}
        </button>
      </form>
      <p style={{ textAlign:'center', fontSize:12, color:'#4a6080', marginTop:20 }}>
        Already have an account? <Link to="/login" style={{ color:'#00d4aa', textDecoration:'none' }}>Sign in</Link>
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:rgba(74,96,128,0.6)}`}</style>
    </Wrapper>
  )
}

const iStyle: React.CSSProperties = { width:'100%', padding:'11px 14px', borderRadius:9, background:'rgba(0,0,0,0.3)', border:'1.5px solid rgba(99,160,255,0.15)', color:'#f0f6ff', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }
const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:600, color:'#8ba3c4', marginBottom:7, letterSpacing:'0.06em', fontFamily:"'Syne',sans-serif" }

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight:'100vh', background:'#04080f', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif", padding:20 }}>
      <div style={{ background:'rgba(12,21,37,0.9)', border:'1px solid rgba(0,212,170,0.12)', borderRadius:20, padding:'44px 36px', maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#3d8bff,transparent)' }}/>
        {children}
      </div>
    </div>
  )
}
