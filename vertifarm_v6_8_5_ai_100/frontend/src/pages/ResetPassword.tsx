import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { signupApi } from '@/lib/api'
import { Leaf, Eye, EyeOff, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  if (!token) return (
    <Centered>
      <AlertCircle size={40} color="#ff4d6d" style={{ margin:'0 auto 12px', display:'block' }}/>
      <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, color:'#f0f6ff', textAlign:'center', marginBottom:8 }}>Invalid reset link</h2>
      <p style={{ fontSize:13, color:'#8ba3c4', textAlign:'center', marginBottom:20 }}>This link is invalid or has already been used.</p>
      <Link to="/forgot-password" style={{ display:'block', textAlign:'center', color:'#00d4aa', fontSize:13, textDecoration:'none' }}>Request a new reset link →</Link>
    </Centered>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) { setError('Password must be at least 8 characters'); return }
    if (pw !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    try {
      await signupApi.resetPassword(token, pw)
      setDone(true)
      toast.success('Password updated successfully!')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid or expired link.')
    } finally { setLoading(false) }
  }

  return (
    <Centered>
      {done ? (
        <>
          <CheckCircle2 size={40} color="#00e87a" style={{ margin:'0 auto 12px', display:'block' }}/>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:'#f0f6ff', textAlign:'center', marginBottom:8 }}>Password updated!</h2>
          <p style={{ fontSize:13, color:'#8ba3c4', textAlign:'center', marginBottom:24 }}>You can now sign in with your new password.</p>
          <button onClick={() => navigate('/login')} style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00d4aa,#00b892)', color:'#030c14', fontSize:14, fontWeight:800, fontFamily:"'Syne',sans-serif", cursor:'pointer' }}>
            Sign in →
          </button>
        </>
      ) : (
        <>
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ width:44, height:44, borderRadius:11, background:'linear-gradient(135deg,#00d4aa,#00b892)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', boxShadow:'0 0 20px rgba(0,212,170,0.3)' }}>
              <Leaf size={20} color="#030c14" strokeWidth={2.5}/>
            </div>
            <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:'#f0f6ff', marginBottom:6 }}>Set new password</h1>
            <p style={{ fontSize:13, color:'#8ba3c4' }}>Must be at least 8 characters with an uppercase letter.</p>
          </div>
          <form onSubmit={handleSubmit} noValidate style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ position:'relative' }}>
              <input type={showPw?'text':'password'} value={pw} onChange={e=>{ setPw(e.target.value); setError('') }} placeholder="New password" style={iStyle}/>
              <button type="button" onClick={()=>setShowPw(!showPw)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#4a6080' }}>
                {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            <input type="password" value={confirm} onChange={e=>{ setConfirm(e.target.value); setError('') }} placeholder="Confirm new password" style={iStyle}/>
            {error && <p style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#ff4d6d' }}><AlertCircle size={11}/>{error}</p>}
            <button type="submit" disabled={loading} style={{ padding:'12px', borderRadius:10, border:'none', background: loading ? 'rgba(99,160,255,0.15)' : 'linear-gradient(135deg,#00d4aa,#00b892)', color: loading ? '#4a6080' : '#030c14', fontSize:14, fontWeight:800, fontFamily:"'Syne',sans-serif", cursor: loading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading ? <><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Updating...</> : 'Update Password'}
            </button>
          </form>
          <Link to="/login" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginTop:20, fontSize:12, color:'#4a6080', textDecoration:'none' }}>
            <ArrowLeft size={11}/> Back to sign in
          </Link>
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:rgba(74,96,128,0.6)}`}</style>
    </Centered>
  )
}

const iStyle: React.CSSProperties = { width:'100%', padding:'11px 14px', borderRadius:9, background:'rgba(0,0,0,0.3)', border:'1.5px solid rgba(99,160,255,0.15)', color:'#f0f6ff', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight:'100vh', background:'#04080f', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif", padding:20 }}>
      <div style={{ background:'rgba(12,21,37,0.9)', border:'1px solid rgba(0,212,170,0.12)', borderRadius:20, padding:'44px 36px', maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#00d4aa,transparent)' }}/>
        {children}
      </div>
    </div>
  )
}
