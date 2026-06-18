import React, { useEffect, useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { signupApi } from '@/lib/api'
import { Leaf, CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading'|'success'|'error'|'idle'>(token ? 'loading' : 'idle')
  const [message, setMessage] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (!token) return
    signupApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(err => { setStatus('error'); setMessage(err?.response?.data?.detail || 'Verification failed.') })
  }, [token])

  const handleResend = async () => {
    setResending(true)
    try {
      await signupApi.resendVerify()
      setResent(true)
    } catch { /* already logged in check */ }
    finally { setResending(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#04080f', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif", padding:20 }}>
      <div style={{ background:'rgba(12,21,37,0.9)', border:'1px solid rgba(0,212,170,0.15)', borderRadius:20, padding:'48px 40px', maxWidth:440, width:'100%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#00d4aa,transparent)' }}/>

        <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#00d4aa,#00b892)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', boxShadow:'0 0 24px rgba(0,212,170,0.3)' }}>
          <Leaf size={24} color="#030c14" strokeWidth={2.5}/>
        </div>

        {status === 'loading' && (
          <>
            <Loader2 size={36} color="#00d4aa" style={{ margin:'0 auto 16px', animation:'spin 1s linear infinite', display:'block' }}/>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:'#f0f6ff', marginBottom:8 }}>Verifying your email…</h2>
            <p style={{ fontSize:13, color:'#8ba3c4' }}>Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={48} color="#00e87a" style={{ margin:'0 auto 16px', display:'block' }}/>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:'#f0f6ff', marginBottom:10 }}>Email verified! 🎉</h2>
            <p style={{ fontSize:13, color:'#8ba3c4', marginBottom:28, lineHeight:1.6 }}>Your account is fully activated. You now have access to all VertiFarm XOS features.</p>
            <button onClick={() => navigate('/dashboard')} style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#00d4aa,#00b892)', color:'#030c14', fontSize:14, fontWeight:800, fontFamily:"'Syne',sans-serif", cursor:'pointer', boxShadow:'0 4px 16px rgba(0,212,170,0.3)' }}>
              Go to Dashboard →
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} color="#ff4d6d" style={{ margin:'0 auto 16px', display:'block' }}/>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:'#f0f6ff', marginBottom:10 }}>Verification failed</h2>
            <p style={{ fontSize:13, color:'#8ba3c4', marginBottom:24, lineHeight:1.6 }}>{message || 'This link is invalid or has expired.'}</p>
            <button onClick={handleResend} disabled={resending || resent} style={{ width:'100%', padding:'12px', borderRadius:10, border:'1.5px solid rgba(0,212,170,0.3)', background:'transparent', color:'#00d4aa', fontSize:13, fontWeight:600, fontFamily:"'Syne',sans-serif", cursor:'pointer' }}>
              {resent ? '✓ Email sent!' : resending ? 'Sending…' : 'Resend verification email'}
            </button>
          </>
        )}

        {status === 'idle' && (
          <>
            <Mail size={48} color="#00d4aa" style={{ margin:'0 auto 16px', display:'block' }}/>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:'#f0f6ff', marginBottom:10 }}>Check your inbox</h2>
            <p style={{ fontSize:13, color:'#8ba3c4', marginBottom:24, lineHeight:1.6 }}>We sent a verification link to your email. Click it to activate your account.</p>
            <button onClick={handleResend} disabled={resending || resent} style={{ width:'100%', padding:'12px', borderRadius:10, border:'1.5px solid rgba(0,212,170,0.25)', background:'rgba(0,212,170,0.05)', color:'#00d4aa', fontSize:13, fontWeight:600, fontFamily:"'Syne',sans-serif", cursor:'pointer' }}>
              {resent ? '✓ Sent!' : resending ? 'Sending…' : 'Resend verification email'}
            </button>
          </>
        )}

        <p style={{ fontSize:11, color:'#4a6080', marginTop:24 }}>
          <Link to="/login" style={{ color:'rgba(0,212,170,0.6)', textDecoration:'none' }}>← Back to sign in</Link>
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
