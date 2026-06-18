import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Loader2, Check, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const G = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

.auth-root {
  font-family: 'Geist', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: #fafaf8;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #18180f;
}
.auth-root *, .auth-root *::before, .auth-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Ticker */
.auth-ticker { height: 32px; background: #18180f; overflow: hidden; display: flex; align-items: center; flex-shrink: 0; }
.auth-ticker-track { display: flex; gap: 0; animation: auth-scroll 36s linear infinite; white-space: nowrap; }
.auth-ticker-item { display: inline-flex; align-items: center; gap: 8px; padding: 0 28px; font-family: 'Geist Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: .07em; color: #4b5563; }
.auth-ticker-item b { color: #9ca3af; }
.auth-ticker-sep { color: #1a6641; font-size: 12px; margin: 0 4px; }
@keyframes auth-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

/* Layout */
.auth-layout { display: flex; flex: 1; overflow: hidden; }

/* Left — decorative panel */
.auth-left {
  flex: 1;
  position: relative;
  background: #18180f;
  display: flex;
  flex-direction: column;
  padding: 44px 52px;
  overflow: hidden;
  min-height: calc(100vh - 32px);
}

/* Organic blob backgrounds */
.auth-left-blob1 {
  position: absolute;
  width: 600px; height: 600px;
  top: -120px; right: -160px;
  background: radial-gradient(circle, rgba(26,102,65,.35) 0%, transparent 65%);
  pointer-events: none;
}
.auth-left-blob2 {
  position: absolute;
  width: 500px; height: 500px;
  bottom: -100px; left: -100px;
  background: radial-gradient(circle, rgba(13,122,110,.2) 0%, transparent 65%);
  pointer-events: none;
}
.auth-left-dots {
  position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
}

/* Logo on left */
.auth-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; position: relative; z-index: 2; }
.auth-logo-mark { width: 36px; height: 36px; background: linear-gradient(135deg, #1a6641, #0d7a6e); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(26,102,65,.5); }
.auth-logo-mark svg { width: 18px; height: 18px; stroke: #e8f5ee; fill: none; stroke-width: 2; }
.auth-logo-name { font-size: 17px; font-weight: 700; color: white; letter-spacing: -.03em; }
.auth-logo-sub { font-size: 9px; font-weight: 600; letter-spacing: .09em; color: #4ade80; background: rgba(74,222,128,.1); border: 1px solid rgba(74,222,128,.2); padding: 2px 8px; border-radius: 20px; }

/* Hero text on left */
.auth-hero { flex: 1; display: flex; flex-direction: column; justify-content: center; position: relative; z-index: 2; padding: 40px 0 20px; }
.auth-eyebrow { display: inline-flex; align-items: center; gap: 7px; font-family: 'Geist Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: #4ade80; margin-bottom: 20px; }
.auth-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #4ade80; animation: pulse-g 2s ease-in-out infinite; }
@keyframes pulse-g { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.5)}50%{box-shadow:0 0 0 6px rgba(74,222,128,0)} }
.auth-h1 { font-family: 'DM Serif Display', Georgia, serif; font-size: clamp(38px, 3.5vw, 56px); line-height: 1.07; letter-spacing: -.02em; color: white; margin-bottom: 18px; }
.auth-h1 em { font-style: italic; color: #4ade80; }
.auth-sub { font-size: 15px; color: #6b7280; line-height: 1.75; max-width: 380px; margin-bottom: 32px; }

/* Feature list */
.auth-feats { display: flex; flex-direction: column; gap: 10px; margin-bottom: 36px; }
.auth-feat { display: flex; align-items: center; gap: 10px; }
.auth-feat-check { width: 20px; height: 20px; border-radius: 50%; background: rgba(74,222,128,.15); border: 1px solid rgba(74,222,128,.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.auth-feat-check svg { width: 10px; height: 10px; stroke: #4ade80; fill: none; stroke-width: 3; }
.auth-feat-text { font-size: 13.5px; font-weight: 500; color: #d1d5db; }

/* Mini dashboard on left */
.auth-dash { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 16px; overflow: hidden; position: relative; z-index: 2; backdrop-filter: blur(8px); }
.auth-dash-bar { background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(255,255,255,.07); padding: 9px 14px; display: flex; align-items: center; gap: 7px; }
.auth-dash-dot { width: 8px; height: 8px; border-radius: 50%; }
.auth-dash-url { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 5px; padding: 2px 10px; font-size: 10px; font-family: 'Geist Mono', monospace; color: #6b7280; flex: 1; }
.auth-dash-live { font-size: 9px; font-weight: 700; color: #4ade80; background: rgba(74,222,128,.1); padding: 2px 8px; border-radius: 20px; letter-spacing: .05em; display: flex; align-items: center; gap: 4px; }
.auth-dash-live-dot { width: 5px; height: 5px; border-radius: 50%; background: #4ade80; animation: pulse-g 1.5s ease-in-out infinite; }
.auth-dash-body { padding: 14px; }
.auth-dash-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 10px; }
.auth-dash-kpi { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.07); border-radius: 8px; padding: 9px 10px; }
.auth-dash-kpi-val { font-family: 'DM Serif Display', serif; font-size: 19px; color: white; line-height: 1; margin-bottom: 2px; }
.auth-dash-kpi-val em { font-style: normal; color: #4ade80; }
.auth-dash-kpi-label { font-size: 9px; font-weight: 500; color: #4b5563; letter-spacing: .04em; text-transform: uppercase; }
.auth-dash-sensors { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; margin-bottom: 10px; }
.auth-dash-sensor { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); border-radius: 6px; padding: 6px 5px; text-align: center; }
.auth-dash-sensor-val { font-size: 11px; font-weight: 700; color: #4ade80; font-family: 'Geist Mono', monospace; }
.auth-dash-sensor-key { font-size: 8px; color: #4b5563; margin-top: 1px; }
.auth-dash-chart { display: flex; align-items: flex-end; gap: 2px; height: 48px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); border-radius: 8px; padding: 8px; margin-bottom: 10px; }
.auth-dash-chart-bar { flex: 1; border-radius: 2px 2px 0 0; }
.auth-dash-ai { background: rgba(26,102,65,.2); border: 1px solid rgba(74,222,128,.15); border-radius: 8px; padding: 9px 12px; display: flex; align-items: center; gap: 10px; }
.auth-dash-ai-orb { width: 26px; height: 26px; background: linear-gradient(135deg, #1a6641, #0d7a6e); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.auth-dash-ai-orb svg { width: 13px; height: 13px; stroke: #4ade80; fill: none; stroke-width: 2; }
.auth-dash-ai-text { font-size: 10.5px; font-weight: 700; color: #d1d5db; flex: 1; }
.auth-dash-ai-sub { font-size: 9.5px; color: #6b7280; margin-top: 1px; }
.auth-dash-ai-badge { font-size: 9px; font-weight: 700; color: #4ade80; background: rgba(74,222,128,.1); border: 1px solid rgba(74,222,128,.2); padding: 2px 8px; border-radius: 12px; flex-shrink: 0; white-space: nowrap; }

/* Left footer stats */
.auth-left-footer { position: relative; z-index: 2; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.07); display: flex; align-items: center; justify-content: space-between; }
.auth-left-stats { display: flex; gap: 24px; }
.auth-left-stat-val { font-size: 16px; font-weight: 700; color: white; }
.auth-left-stat-val em { font-style: normal; color: #4ade80; }
.auth-left-stat-label { font-size: 11px; color: #4b5563; margin-top: 1px; }
.auth-trust-row { display: flex; gap: 8px; }
.auth-trust-pill { font-size: 9.5px; font-weight: 600; letter-spacing: .06em; color: #4b5563; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); padding: 3px 9px; border-radius: 20px; }

/* Right — form panel */
.auth-right {
  width: 440px;
  flex-shrink: 0;
  background: white;
  border-left: 1px solid rgba(0,0,0,.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 52px 48px;
  min-height: calc(100vh - 32px);
  overflow-y: auto;
}

.auth-form-logo { display: none; margin-bottom: 32px; }

.auth-form-head { margin-bottom: 32px; }
.auth-form-title { font-family: 'DM Serif Display', Georgia, serif; font-size: 28px; letter-spacing: -.02em; color: #18180f; margin-bottom: 6px; }
.auth-form-sub { font-size: 14px; color: #6b7280; line-height: 1.55; }

/* Form */
.auth-field { margin-bottom: 16px; }
.auth-label { font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #3a3a30; display: block; margin-bottom: 8px; }
.auth-input-wrap { position: relative; }
.auth-input {
  width: 100%; height: 46px;
  border: 1.5px solid #e5e5e0;
  border-radius: 10px;
  padding: 0 14px;
  font-size: 14px; font-weight: 500;
  color: #18180f;
  background: #fafaf8;
  font-family: 'Geist', sans-serif;
  outline: none;
  transition: all .15s;
}
.auth-input::placeholder { color: #9b9b88; }
.auth-input:focus { border-color: #1a6641; background: white; box-shadow: 0 0 0 3px rgba(26,102,65,.1); }
.auth-input.has-error { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,.08); }
.auth-input-pw { padding-right: 46px; }
.auth-pw-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9b9b88; display: flex; align-items: center; transition: color .15s; padding: 4px; }
.auth-pw-btn:hover { color: #3a3a30; }
.auth-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.auth-forgot { font-size: 12px; font-weight: 600; color: #1a6641; text-decoration: none; }
.auth-forgot:hover { text-decoration: underline; }
.auth-error-msg { font-size: 12px; color: #dc2626; margin-top: 5px; display: flex; align-items: center; gap: 4px; }

/* Submit */
.auth-submit {
  width: 100%; height: 48px;
  background: #18180f;
  color: #e8f5ee;
  font-size: 15px; font-weight: 700;
  font-family: 'Geist', sans-serif;
  border: none; border-radius: 10px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all .2s;
  margin-top: 24px;
  box-shadow: 0 2px 0 rgba(0,0,0,.3), 0 4px 16px rgba(0,0,0,.12);
  position: relative; overflow: hidden;
}
.auth-submit::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, #1a6641, #0d7a6e); opacity: 0; transition: opacity .2s; }
.auth-submit:hover::before { opacity: 1; }
.auth-submit:hover { transform: translateY(-1px); box-shadow: 0 4px 0 rgba(26,102,65,.4), 0 8px 24px rgba(26,102,65,.25); }
.auth-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }
.auth-submit span { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; }

/* Demo box */
.auth-demo {
  margin-top: 18px;
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all .15s;
}
.auth-demo:hover { border-color: #4ade80; box-shadow: 0 2px 12px rgba(26,102,65,.1); }
.auth-demo-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
.auth-demo-title { font-size: 10.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: #1a6641; }
.auth-demo-hint { font-size: 10px; color: #4ade80; font-weight: 600; background: rgba(26,102,65,.1); padding: 2px 8px; border-radius: 20px; }
.auth-demo-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.auth-demo-key { font-size: 12px; color: #6b7280; }
.auth-demo-val { font-size: 12px; font-weight: 700; color: #18180f; font-family: 'Geist Mono', monospace; }

/* Social proof grid */
.auth-proof { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
.auth-proof-cell { background: #fafaf8; border: 1px solid #e5e5e0; border-radius: 9px; padding: 12px 14px; text-align: center; }
.auth-proof-val { font-family: 'DM Serif Display', serif; font-size: 20px; color: #18180f; line-height: 1; }
.auth-proof-val em { font-style: normal; color: #1a6641; }
.auth-proof-label { font-size: 11px; color: #9b9b88; margin-top: 2px; }

/* Divider */
.auth-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
.auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: #e5e5e0; }
.auth-divider span { font-size: 12px; color: #9b9b88; }

/* Signup link */
.auth-signup-row { text-align: center; font-size: 13px; color: #6b7280; }
.auth-signup-row a { color: #1a6641; font-weight: 700; text-decoration: none; }
.auth-signup-row a:hover { text-decoration: underline; }

/* Form footer */
.auth-form-footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f0eb; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.auth-sec-badges { display: flex; gap: 12px; flex-wrap: wrap; }
.auth-sec-badge { font-size: 10px; font-weight: 600; color: #9b9b88; display: flex; align-items: center; gap: 3px; }
.auth-sec-badge svg { width: 11px; height: 11px; stroke: #9b9b88; fill: none; stroke-width: 2; }
.auth-copy { font-size: 11px; color: #c4c4b0; }

@media(max-width:900px){
  .auth-left { display: none; }
  .auth-right { width: 100%; border-left: none; padding: 32px 24px; }
  .auth-form-logo { display: flex; }
}
@keyframes spin { to { transform: rotate(360deg); } }
`

const CHART_VALS = [38,45,52,48,58,62,55,68,72,65,78,74,84,88]

function useLive() {
  const [v, setV] = useState({ t:23.5, h:65.1, c:1042, p:6.12, e:2.08, l:287 })
  useEffect(() => {
    const id = setInterval(() => setV(s => ({
      t: +(s.t+(Math.random()-.5)*.4).toFixed(1),
      h: +(s.h+(Math.random()-.5)*1.2).toFixed(1),
      c: Math.round(s.c+(Math.random()-.5)*28),
      p: +(s.p+(Math.random()-.5)*.05).toFixed(2),
      e: +(s.e+(Math.random()-.5)*.07).toFixed(2),
      l: Math.round(s.l+(Math.random()-.5)*14),
    })), 2600)
    return () => clearInterval(id)
  }, [])
  return v
}

const TICKS = ['◆ LIVE SENSORS','847 DEVICES ONLINE','◆ YIELD TODAY','4,280 KG ACROSS ALL FARMS',
  '◆ AI ACCURACY','94.1% MODEL CONFIDENCE','◆ WATER EFFICIENCY','94% VS CONVENTIONAL',
  '◆ ENERGY SAVED','28.4 KWH VIA AI','◆ LIVE SENSORS','847 DEVICES ONLINE',
  '◆ YIELD TODAY','4,280 KG ACROSS ALL FARMS','◆ AI ACCURACY','94.1% MODEL CONFIDENCE',
  '◆ WATER EFFICIENCY','94% VS CONVENTIONAL','◆ ENERGY SAVED','28.4 KWH VIA AI',
]

const FEATS = [
  'Real-time IoT monitoring — 847 sensors',
  'AI yield forecast — 94.1% accuracy',
  'Full lifecycle automation & recipes',
  'QR traceability & compliance certs',
]

const FADE_UP = {
  hidden: { opacity:0, y:20 },
  show:   { opacity:1, y:0, transition:{ duration:.5, ease:[.22,1,.36,1] } }
}
const STAGGER = { hidden:{}, show:{ transition:{ staggerChildren:.08 } } }

export default function LoginPage() {
  const navigate    = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [errors,   setErrors]   = useState<Record<string,string>>({})
  const live = useLive()
  const maxBar = Math.max(...CHART_VALS)

  useEffect(() => {
    const s = document.createElement('style')
    s.textContent = G
    document.head.appendChild(s)
    return () => s.remove()
  }, [])

  const validate = () => {
    const e: Record<string,string> = {}
    if (!email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    try {
      await login(email.trim(), password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid email or password'
      setErrors({ password: msg })
      toast.error(msg)
    }
  }

  const fillDemo = () => {
    setEmail('admin@vertifarm.io')
    setPassword('Admin@123456')
    setErrors({})
    toast.success('Demo credentials filled — click Sign In')
  }

  return (
    <div className="auth-root">
      {/* Ticker */}
      <div className="auth-ticker">
        <div className="auth-ticker-track">
          {[...TICKS,...TICKS].map((t,i) => (
            <span key={i} className="auth-ticker-item">
              {t.startsWith('◆') ? <span className="auth-ticker-sep">/</span> : null}
              {t.startsWith('◆') ? <b>{t.replace('◆ ','')}</b> : t}
            </span>
          ))}
        </div>
      </div>

      <div className="auth-layout">
        {/* ── Left panel ── */}
        <div className="auth-left">
          <div className="auth-left-blob1"/>
          <div className="auth-left-blob2"/>
          <div className="auth-left-dots"/>

          {/* Logo */}
          <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5 }}>
            <Link to="/" className="auth-logo">
              <div className="auth-logo-mark">
                <svg viewBox="0 0 24 24"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z"/><path d="M12 7v10M4 7l8 5 8-5"/></svg>
              </div>
              <span className="auth-logo-name">VertiFarm XOS</span>
              <span className="auth-logo-sub">ENTERPRISE</span>
            </Link>
          </motion.div>

          {/* Hero */}
          <div className="auth-hero">
            <motion.div initial="hidden" animate="show" variants={STAGGER}>
              <motion.div variants={FADE_UP} className="auth-eyebrow">
                <span className="auth-eyebrow-dot"/>
                AI-POWERED AGRICULTURE OS
              </motion.div>
              <motion.h1 variants={FADE_UP} className="auth-h1">
                Grow <em>Smarter.</em><br/>
                Scale <em>Faster.</em>
              </motion.h1>
              <motion.p variants={FADE_UP} className="auth-sub">
                The world's most advanced OS for indoor vertical farms — real-time IoT
                monitoring, AI crop intelligence, and full lifecycle automation.
              </motion.p>

              {/* Feature list */}
              <motion.div variants={FADE_UP} className="auth-feats">
                {FEATS.map(f => (
                  <div key={f} className="auth-feat">
                    <div className="auth-feat-check">
                      <svg viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <span className="auth-feat-text">{f}</span>
                  </div>
                ))}
              </motion.div>

              {/* Mini dashboard */}
              <motion.div variants={FADE_UP} className="auth-dash">
                <div className="auth-dash-bar">
                  <div className="auth-dash-dot" style={{ background:'#ff6059' }}/>
                  <div className="auth-dash-dot" style={{ background:'#ffbd2e' }}/>
                  <div className="auth-dash-dot" style={{ background:'#28c840' }}/>
                  <div className="auth-dash-url">vertifarm-xos · delhi-hq · live</div>
                  <div className="auth-dash-live"><span className="auth-dash-live-dot"/>LIVE</div>
                </div>
                <div className="auth-dash-body">
                  <div className="auth-dash-kpis">
                    {[['847','SENSORS'],['4.28t','YIELD'],['94%','H₂O EFF'],['5','ALERTS']].map(([v,l]) => (
                      <div key={l} className="auth-dash-kpi">
                        <div className="auth-dash-kpi-val">{v}</div>
                        <div className="auth-dash-kpi-label">{l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="auth-dash-sensors">
                    {[['°C',live.t],['RH',live.h],['CO₂',live.c],['pH',live.p],['EC',live.e],['PPFD',live.l]].map(([k,v]) => (
                      <div key={k} className="auth-dash-sensor">
                        <div className="auth-dash-sensor-val">{v}</div>
                        <div className="auth-dash-sensor-key">{k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="auth-dash-chart">
                    {CHART_VALS.map((v,i) => (
                      <div key={i} className="auth-dash-chart-bar" style={{
                        flex:1, borderRadius:'2px 2px 0 0',
                        height:`${(v/maxBar)*100}%`, minHeight:3,
                        background: i===CHART_VALS.length-1 ? '#4ade80' : i>9 ? 'rgba(74,222,128,.35)' : 'rgba(255,255,255,.08)'
                      }}/>
                    ))}
                  </div>
                  <div className="auth-dash-ai">
                    <div className="auth-dash-ai-orb">
                      <svg viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                    </div>
                    <div style={{ flex:1 }}>
                      <div className="auth-dash-ai-text">AI · Zone A3 Basil Recommendation</div>
                      <div className="auth-dash-ai-sub">↑ EC to 2.4 mS/cm · +14% yield · 94.1% confidence</div>
                    </div>
                    <div className="auth-dash-ai-badge">AI ✦</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Left footer */}
          <motion.div className="auth-left-footer"
            initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.6 }}>
            <div className="auth-left-stats">
              {[['847+','Live sensors'],['99.97%','Uptime SLA'],['4','Active farms']].map(([v,l]) => (
                <div key={l}>
                  <div className="auth-left-stat-val"><em>{v}</em></div>
                  <div className="auth-left-stat-label">{l}</div>
                </div>
              ))}
            </div>
            <div className="auth-trust-row">
              {['ISO 27001','SOC 2','FSSAI'].map(b => (
                <span key={b} className="auth-trust-pill">{b}</span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Right panel — form ── */}
        <div className="auth-right">
          {/* Mobile-only logo */}
          <div className="auth-form-logo">
            <Link to="/" className="auth-logo">
              <div className="auth-logo-mark" style={{ background:'#18180f' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="#e8f5ee" fill="none" strokeWidth="2"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z"/><path d="M12 7v10M4 7l8 5 8-5"/></svg>
              </div>
              <span style={{ fontFamily:'Geist,sans-serif', fontSize:16, fontWeight:700, color:'#18180f' }}>VertiFarm XOS</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity:0, x:20 }}
            animate={{ opacity:1, x:0 }}
            transition={{ duration:.5, delay:.1, ease:[.22,1,.36,1] }}>

            <div className="auth-form-head">
              <h2 className="auth-form-title">Sign in to your account</h2>
              <p className="auth-form-sub">Access your farm dashboard, AI insights, and live sensor data.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate aria-label="Sign in form">
              {/* Email */}
              <div className="auth-field">
                <label htmlFor="login-email" className="auth-label">Email Address</label>
                <div className="auth-input-wrap">
                  <input
                    id="login-email"
                    className={`auth-input ${errors.email ? 'has-error' : ''}`}
                    type="email"
                    placeholder="admin@vertifarm.io"
                    value={email}
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'login-email-error' : undefined}
                    onChange={e => { setEmail(e.target.value); setErrors(v=>({...v,email:''})) }}
                  />
                </div>
                <AnimatePresence>
                  {errors.email && (
                    <motion.div id="login-email-error" role="alert" className="auth-error-msg"
                      initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                      ⚠ {errors.email}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="login-password" className="auth-label" style={{ margin:0 }}>Password</label>
                  <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>
                </div>
                <div className="auth-input-wrap">
                  <input
                    id="login-password"
                    className={`auth-input auth-input-pw ${errors.password ? 'has-error' : ''}`}
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    autoComplete="current-password"
                    aria-required="true"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                    onChange={e => { setPassword(e.target.value); setErrors(v=>({...v,password:''})) }}
                  />
                  <button type="button" className="auth-pw-btn"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPw(!showPw)}>
                    {showPw ? <EyeOff size={15} aria-hidden="true"/> : <Eye size={15} aria-hidden="true"/>}
                  </button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.div id="login-password-error" role="alert" className="auth-error-msg"
                      initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                      ⚠ {errors.password}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button type="submit" className="auth-submit" disabled={isLoading} aria-busy={isLoading}>
                <span>
                  {isLoading
                    ? <><Loader2 size={15} aria-hidden="true" style={{ animation:'spin 1s linear infinite' }}/> Signing in…</>
                    : <>Sign In <ArrowRight size={15} aria-hidden="true"/></>
                  }
                </span>
              </button>
            </form>

            {/* Demo credentials */}
            <div className="auth-demo" onClick={fillDemo} role="button" tabIndex={0}
              aria-label="Fill demo credentials"
              onKeyDown={e => e.key==='Enter' && fillDemo()}>
              <div className="auth-demo-head">
                <span className="auth-demo-title">Demo Credentials</span>
                <span className="auth-demo-hint">Click to fill</span>
              </div>
              <div className="auth-demo-row">
                <span className="auth-demo-key">Email</span>
                <span className="auth-demo-val">admin@vertifarm.io</span>
              </div>
              <div className="auth-demo-row">
                <span className="auth-demo-key">Password</span>
                <span className="auth-demo-val">Admin@123456</span>
              </div>
            </div>

            {/* Social proof */}
            <div className="auth-proof">
              {[['847+','Live sensors'],['99.97%','Uptime SLA'],['+14%','Yield with AI'],['4','Sites active']].map(([v,l]) => (
                <div key={l} className="auth-proof-cell">
                  <div className="auth-proof-val"><em>{v}</em></div>
                  <div className="auth-proof-label">{l}</div>
                </div>
              ))}
            </div>

            <div className="auth-divider"><span>or</span></div>

            <div className="auth-signup-row">
              Don't have an account? <Link to="/signup">Start free trial →</Link>
            </div>

            {/* Footer */}
            <div className="auth-form-footer">
              <div className="auth-sec-badges">
                {['256-bit TLS','SOC 2','ISO 27001','GDPR'].map(b => (
                  <span key={b} className="auth-sec-badge">
                    <svg viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    {b}
                  </span>
                ))}
              </div>
              <span className="auth-copy">© 2026 VertiFarm</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
