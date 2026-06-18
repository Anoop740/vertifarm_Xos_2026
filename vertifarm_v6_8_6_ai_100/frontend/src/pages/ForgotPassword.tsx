import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { signupApi } from '@/lib/api'
import { Leaf, Mail, ArrowLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address'); return }
    setLoading(true); setError('')
    try {
      await signupApi.forgotPassword(email.trim())
      setSent(true)
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#04080f', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif", padding:20 }}>
      <div style={{ background:'rgba(12,21,37,0.9)', border:'1px solid rgba(0,212,170,0.12)', borderRadius:20, padding:'44px 36px', maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#00d4aa,transparent)' }}/>

        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:44, height:44, borderRadius:11, background:'linear-gradient(135deg,#00d4aa,#00b892)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 0 20px rgba(0,212,170,0.3)' }}>
            <Leaf size={20} color="#030c14" strokeWidth={2.5}/>
          </div>
          {!sent ? (
            <>
              <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:'#f0f6ff', marginBottom:8 }}>Forgot password?</h1>
              <p style={{ fontSize:13, color:'#8ba3c4', lineHeight:1.6 }}>Enter your email and we'll send a reset link valid for 2 hours.</p>
            </>
          ) : (
            <>
              <CheckCircle2 size={36} color="#00e87a" style={{ margin:'0 auto 12px', display:'block' }}/>
              <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:'#f0f6ff', marginBottom:8 }}>Check your inbox</h1>
              <p style={{ fontSize:13, color:'#8ba3c4', lineHeight:1.6 }}>If <strong style={{color:'#f0f6ff'}}>{email}</strong> is registered, a reset link has been sent. Check your spam folder if you don't see it.</p>
            </>
          )}
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} noValidate style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8ba3c4', marginBottom:7, letterSpacing:'0.06em', fontFamily:"'Syne',sans-serif" }}>EMAIL ADDRESS</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }} placeholder="admin@company.com"
                style={{ width:'100%', padding:'11px 14px', borderRadius:9, background:'rgba(0,0,0,0.3)', border:`1.5px solid ${error ? '#ff4d6d' : 'rgba(99,160,255,0.15)'}`, color:'#f0f6ff', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(0,212,170,0.5)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = error ? '#ff4d6d' : 'rgba(99,160,255,0.15)'}/>
              {error && <p style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#ff4d6d', marginTop:5 }}><AlertCircle size={11}/>{error}</p>}
            </div>
            <button type="submit" disabled={loading} style={{ padding:'13px', borderRadius:10, border:'none', background: loading ? 'rgba(99,160,255,0.15)' : 'linear-gradient(135deg,#00d4aa,#00b892)', color: loading ? '#4a6080' : '#030c14', fontSize:14, fontWeight:800, fontFamily:"'Syne',sans-serif", cursor: loading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 14px rgba(0,212,170,0.25)' }}>
              {loading ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> Sending...</> : <><Mail size={15}/> Send reset link</>}
            </button>
          </form>
        )}

        <div style={{ textAlign:'center', marginTop:24 }}>
          <Link to="/login" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'#4a6080', textDecoration:'none' }}>
            <ArrowLeft size={13}/> Back to sign in
          </Link>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:rgba(74,96,128,0.6)}`}</style>
    </div>
  )
}
