import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signupApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Leaf, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const FARM_TYPES = [
  { value:'rack',       label:'Rack-Based Vertical', icon:'🗄️' },
  { value:'hydroponic', label:'Hydroponic DWC',       icon:'💧' },
  { value:'nft',        label:'NFT System',            icon:'🌊' },
  { value:'aeroponic',  label:'Aeroponic',             icon:'☁️' },
  { value:'container',  label:'Container Farm',        icon:'📦' },
  { value:'other',      label:'Other',                 icon:'🌿' },
]

const STEPS = ['Account', 'Organization', 'Farm Type']

type Field = { name:string; org_name:string; email:string; password:string; confirm:string; farm_type:string; phone:string }

export default function SignupPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<Partial<Field>>({})
  const [form, setForm] = useState<Field>({ name:'', org_name:'', email:'', password:'', confirm:'', farm_type:'', phone:'' })

  const set = (k: keyof Field, v: string) => { setForm(f => ({...f,[k]:v})); setErrors((e: any) => ({...e,[k]:undefined})) }

  const validateStep = (): boolean => {
    const e: Partial<Field> = {}
    if (step === 0) {
      if (!form.name.trim())    e.name = 'Full name required'
      if (!form.email.trim())   e.email = 'Email required'
      if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required'
      if (form.password.length < 8)         e.password = 'At least 8 characters'
      if (!/[A-Z]/.test(form.password))     e.password = 'Include an uppercase letter'
      if (!/[0-9!@#$%^&*]/.test(form.password)) e.password = 'Include a number or special character'
      if (form.password !== form.confirm)   e.confirm = 'Passwords do not match'
    }
    if (step === 1) {
      if (!form.org_name.trim()) e.org_name = 'Organization name required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => { if (validateStep()) setStep((s: any) => s + 1) }

  const handleSubmit = async () => {
    if (!validateStep()) return
    setLoading(true)
    try {
      const res = await signupApi.register({
        full_name: form.name, email: form.email,
        password: form.password, org_name: form.org_name,
        farm_type: form.farm_type || undefined, phone: form.phone || undefined,
      })
      localStorage.setItem('access_token', res.access_token)
      localStorage.setItem('refresh_token', res.refresh_token)
      await login(form.email, form.password)
      toast.success('Welcome to VertiFarm XOS! 🌿')
      navigate('/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.detail
      toast.error(typeof msg === 'string' ? msg : 'Signup failed. Please try again.')
    } finally { setLoading(false) }
  }

  const pwChecks = [
    { label:'8+ characters',          ok: form.password.length >= 8 },
    { label:'Uppercase letter',        ok: /[A-Z]/.test(form.password) },
    { label:'Number or special char',  ok: /[0-9!@#$%^&*]/.test(form.password) },
    { label:'Passwords match',         ok: form.password === form.confirm && form.confirm.length > 0 },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#04080f', display:'flex', flexDirection:'column', fontFamily:"'DM Sans',-apple-system,sans-serif" }}>
      {/* bg */}
      <div style={{ position:'fixed', inset:0, backgroundImage:'linear-gradient(rgba(0,212,170,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,170,0.03) 1px,transparent 1px)', backgroundSize:'60px 60px', pointerEvents:'none', zIndex:0 }}/>
      <div style={{ position:'fixed', top:-100, right:-100, width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(0,212,170,0.07),transparent 70%)', filter:'blur(60px)', pointerEvents:'none', zIndex:0 }}/>

      {/* nav */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, height:60, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 40px', background:'rgba(4,8,15,0.8)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(0,212,170,0.08)' }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00b892)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 14px rgba(0,212,170,0.4)' }}>
            <Leaf size={15} color="#030c14" strokeWidth={2.5}/>
          </div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:800, color:'#f0f6ff' }}>Verti<span style={{color:'#00d4aa'}}>Farm</span> XOS</span>
        </Link>
        <span style={{ fontSize:13, color:'#4a6080' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'#00d4aa', textDecoration:'none', fontWeight:600 }}>Sign in</Link>
        </span>
      </nav>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'100px 20px 40px', position:'relative', zIndex:10 }}>
        <div style={{ width:'100%', maxWidth:480 }}>

          {/* header */}
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:'#f0f6ff', letterSpacing:'-0.02em', marginBottom:8 }}>
              Start your free trial
            </h1>
            <p style={{ fontSize:14, color:'#8ba3c4', fontWeight:300 }}>
              14 days full access · No credit card required
            </p>
          </div>

          {/* step bar */}
          <div style={{ display:'flex', alignItems:'center', marginBottom:32, gap:0 }}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{
                    width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:700, fontFamily:"'Syne',sans-serif",
                    background: i < step ? '#00d4aa' : i === step ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.04)',
                    color: i < step ? '#030c14' : i === step ? '#00d4aa' : '#4a6080',
                    border: i === step ? '1.5px solid #00d4aa' : '1.5px solid transparent',
                    transition:'all 0.3s',
                  }}>{i < step ? '✓' : i + 1}</div>
                  <span style={{ fontSize:12, fontWeight:i === step ? 600 : 400, color: i === step ? '#f0f6ff' : '#4a6080', transition:'all 0.3s' }}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ flex:1, height:1, background: i < step ? 'rgba(0,212,170,0.4)' : 'rgba(255,255,255,0.06)', margin:'0 10px', transition:'background 0.3s' }}/>}
              </React.Fragment>
            ))}
          </div>

          {/* card */}
          <div style={{ background:'rgba(12,21,37,0.9)', border:'1px solid rgba(0,212,170,0.12)', borderRadius:16, padding:'32px 28px', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#00d4aa,transparent)' }}/>

            {/* Step 0 — Account */}
            {step === 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:700, color:'#f0f6ff', marginBottom:4 }}>Create your account</h2>
                <Field label="Full Name" placeholder="Rajesh Kumar" value={form.name} onChange={(v: any) => set('name', v)} error={errors.name}/>
                <Field label="Email Address" type="email" placeholder="rajesh@company.com" value={form.email} onChange={(v: any) => set('email', v)} error={errors.email}/>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#8ba3c4', letterSpacing:'0.06em', fontFamily:"'Syne',sans-serif" }}>PASSWORD</label>
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ background:'none', border:'none', cursor:'pointer', color:'#4a6080', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
                      {showPw ? <EyeOff size={12}/> : <Eye size={12}/>} {showPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 chars, uppercase, number" style={inputStyle(!!errors.password)}/>
                  {errors.password && <p style={errStyle}><AlertCircle size={11}/>{errors.password}</p>}
                  {form.password && (
                    <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                      {pwChecks.map(c => (
                        <div key={c.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color: c.ok ? '#00e87a' : '#4a6080' }}>
                          <CheckCircle2 size={10} color={c.ok ? '#00e87a' : '#4a6080'}/>{c.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Field label="Confirm Password" type="password" placeholder="Re-enter password" value={form.confirm} onChange={(v: any) => set('confirm', v)} error={errors.confirm}/>
              </div>
            )}

            {/* Step 1 — Organization */}
            {step === 1 && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:700, color:'#f0f6ff', marginBottom:4 }}>Your organization</h2>
                <p style={{ fontSize:12, color:'#8ba3c4', fontWeight:300 }}>This will be the name of your VertiFarm XOS workspace.</p>
                <Field label="Organization Name" placeholder="AgroTech India Pvt Ltd" value={form.org_name} onChange={(v: any) => set('org_name', v)} error={errors.org_name}/>
                <Field label="Phone (optional)" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(v: any) => set('phone', v)}/>
                <div style={{ padding:'12px 14px', borderRadius:10, background:'rgba(0,212,170,0.05)', border:'1px solid rgba(0,212,170,0.15)', fontSize:12, color:'#8ba3c4', lineHeight:1.6 }}>
                  🎁 Your trial includes <strong style={{color:'#00d4aa'}}>14 days</strong> of full Growth plan access — 5 farms, 60 zones, 500 sensors, AI intelligence, and traceability.
                </div>
              </div>
            )}

            {/* Step 2 — Farm Type */}
            {step === 2 && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:700, color:'#f0f6ff', marginBottom:4 }}>Primary grow method</h2>
                <p style={{ fontSize:12, color:'#8ba3c4', fontWeight:300 }}>We'll pre-configure zone templates, irrigation modes, and sensor recommendations for you.</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {FARM_TYPES.map(ft => (
                    <div key={ft.value} onClick={() => set('farm_type', ft.value)} style={{
                      padding:'12px 14px', borderRadius:10, cursor:'pointer',
                      border:`1.5px solid ${form.farm_type === ft.value ? '#00d4aa' : 'rgba(99,160,255,0.12)'}`,
                      background: form.farm_type === ft.value ? 'rgba(0,212,170,0.08)' : 'rgba(255,255,255,0.01)',
                      display:'flex', alignItems:'center', gap:10, transition:'all 0.15s',
                    }}>
                      <span style={{ fontSize:20 }}>{ft.icon}</span>
                      <span style={{ fontSize:12, fontWeight:600, color: form.farm_type === ft.value ? '#00d4aa' : '#8ba3c4', fontFamily:"'Syne',sans-serif" }}>{ft.label}</span>
                      {form.farm_type === ft.value && <CheckCircle2 size={14} color="#00d4aa" style={{ marginLeft:'auto' }}/>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* actions */}
            <div style={{ display:'flex', gap:10, marginTop:28 }}>
              {step > 0 && (
                <button onClick={() => setStep((s: any) => s - 1)} style={{ flex:1, padding:'12px', borderRadius:10, border:'1.5px solid rgba(99,160,255,0.18)', background:'transparent', color:'#8ba3c4', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"'Syne',sans-serif" }}>
                  Back
                </button>
              )}
              {step < 2
                ? <button onClick={handleNext} style={primaryBtn(false)} onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,212,170,0.4)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,212,170,0.25)')}>
                    Continue <ArrowRight size={15}/>
                  </button>
                : <button onClick={handleSubmit} disabled={loading} style={primaryBtn(loading)} onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,212,170,0.4)')} onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,212,170,0.25)')}>
                    {loading ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> Creating account...</> : <>Start Free Trial <ArrowRight size={15}/></>}
                  </button>
              }
            </div>
          </div>

          <p style={{ textAlign:'center', fontSize:12, color:'#4a6080', marginTop:20, lineHeight:1.6 }}>
            By creating an account you agree to our{' '}
            <a href="#" style={{ color:'rgba(0,212,170,0.7)', textDecoration:'none' }}>Terms</a>
            {' '}and{' '}
            <a href="#" style={{ color:'rgba(0,212,170,0.7)', textDecoration:'none' }}>Privacy Policy</a>
          </p>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input::placeholder{color:rgba(74,96,128,0.6)}`}</style>
    </div>
  )
}

function Field({ label, type='text', placeholder, value, onChange, error }: any) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8ba3c4', marginBottom:7, letterSpacing:'0.06em', fontFamily:"'Syne',sans-serif" }}>{label.toUpperCase()}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle(!!error)}/>
      {error && <p style={errStyle}><AlertCircle size={11}/>{error}</p>}
    </div>
  )
}

const inputStyle = (err: boolean): React.CSSProperties => ({
  width:'100%', padding:'11px 14px', borderRadius:9,
  background:'rgba(0,0,0,0.3)', border:`1.5px solid ${err ? '#ff4d6d' : 'rgba(99,160,255,0.15)'}`,
  color:'#f0f6ff', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif",
  boxSizing:'border-box',
})

const errStyle: React.CSSProperties = {
  display:'flex', alignItems:'center', gap:5,
  fontSize:11, color:'#ff4d6d', marginTop:5,
}

const primaryBtn = (loading: boolean): React.CSSProperties => ({
  flex:1, padding:'12px 24px', borderRadius:10, border:'none',
  cursor: loading ? 'not-allowed' : 'pointer',
  background: loading ? 'rgba(99,160,255,0.2)' : 'linear-gradient(135deg,#00d4aa,#00b892)',
  color: loading ? '#4a6080' : '#030c14',
  fontSize:14, fontWeight:800, fontFamily:"'Syne',sans-serif",
  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
  boxShadow:'0 4px 14px rgba(0,212,170,0.25)', transition:'all 0.15s',
})
