import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'

/* ─── Design System: DM Serif Display + Geist — Luxury AgriTech ─── */
const G = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
:root{
  --bg:#fafaf8; --bg2:#f4f4ef; --bg3:#eeeee8;
  --ink:#18180f; --ink2:#3a3a30; --ink3:#6b6b5a; --muted:#9b9b88;
  --green:#1a6641; --green-l:#e8f5ee; --green-m:#b8dfc8;
  --teal:#0d7a6e; --teal-l:#e0f4f1;
  --amber:#c47a1e; --amber-l:#fdf0dc;
  --accent:#1a6641;
  --radius-sm:6px; --radius:10px; --radius-lg:16px; --radius-xl:24px;
  font-family:'Geist','Inter',sans-serif;
  background:var(--bg); color:var(--ink);
  -webkit-font-smoothing:antialiased; scroll-behavior:smooth;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{overflow-x:hidden}
/* Scrollbar */
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--green-m);border-radius:4px}

/* ── Ticker ── */
.tk{height:34px;background:var(--ink);overflow:hidden;display:flex;align-items:center}
.tk-inner{display:flex;gap:0;animation:tk-run 40s linear infinite;white-space:nowrap}
.tk-item{display:inline-flex;align-items:center;gap:10px;padding:0 32px;font-family:'Geist Mono',monospace;font-size:10.5px;font-weight:500;letter-spacing:.06em;color:#6b7280}
.tk-item b{color:#d1d5db}
.tk-sep{color:var(--teal);font-size:14px}
@keyframes tk-run{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

/* ── Navigation ── */
.nav{position:fixed;top:34px;left:0;right:0;z-index:200;transition:all .3s}
.nav.solid{background:rgba(250,250,248,.94);backdrop-filter:blur(20px);border-bottom:1px solid rgba(0,0,0,.07);box-shadow:0 1px 0 rgba(0,0,0,.04)}
.nav-inner{max-width:1200px;margin:0 auto;padding:0 32px;height:58px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.nav-logo-mark{width:34px;height:34px;background:var(--ink);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-logo-mark svg{width:18px;height:18px;stroke:#e8f5ee;fill:none;stroke-width:2}
.nav-logo-text{font-family:'Geist',sans-serif;font-size:16px;font-weight:700;color:var(--ink);letter-spacing:-.03em}
.nav-logo-badge{font-size:9px;font-weight:600;letter-spacing:.08em;color:var(--green);background:var(--green-l);border:1px solid var(--green-m);padding:2px 8px;border-radius:20px}
.nav-links{display:flex;gap:2px}
.nav-link{font-size:13.5px;font-weight:500;color:var(--ink3);text-decoration:none;padding:6px 14px;border-radius:6px;transition:all .15s}
.nav-link:hover{color:var(--ink);background:var(--bg3)}
.nav-actions{display:flex;align-items:center;gap:10px}
.btn-nav-ghost{font-size:13.5px;font-weight:600;color:var(--ink2);border:1px solid rgba(0,0,0,.15);border-radius:8px;padding:7px 18px;text-decoration:none;background:transparent;cursor:pointer;transition:all .15s}
.btn-nav-ghost:hover{background:var(--bg3);border-color:rgba(0,0,0,.25)}
.btn-nav-cta{font-size:13.5px;font-weight:700;color:var(--bg);background:var(--ink);border:none;border-radius:8px;padding:8px 20px;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s}
.btn-nav-cta:hover{background:var(--green);transform:translateY(-1px);box-shadow:0 4px 14px rgba(26,102,65,.35)}

/* ── Hero ── */
.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:120px 0 80px;position:relative;overflow:hidden}
.hero-mesh{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.hero-mesh::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 60% 30%,rgba(26,102,65,.07) 0%,transparent 70%)}
.hero-mesh::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 80% 70%,rgba(13,122,110,.05) 0%,transparent 70%)}
.hero-dots{position:absolute;inset:0;background-image:radial-gradient(rgba(26,102,65,.18) 1px,transparent 1px);background-size:28px 28px;mask-image:radial-gradient(ellipse 90% 90% at 50% 50%,black 40%,transparent 100%)}
.hero-inner{max-width:1200px;margin:0 auto;padding:0 32px;position:relative;z-index:1}
.hero-tag{display:inline-flex;align-items:center;gap:8px;font-family:'Geist Mono',monospace;font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--green);border:1px solid var(--green-m);background:var(--green-l);padding:5px 14px;border-radius:20px;margin-bottom:28px}
.hero-tag-pulse{width:5px;height:5px;border-radius:50%;background:var(--green);animation:pulse-green 2s ease-in-out infinite}
@keyframes pulse-green{0%,100%{box-shadow:0 0 0 0 rgba(26,102,65,.5)}50%{box-shadow:0 0 0 5px rgba(26,102,65,0)}}
.hero-h1{font-family:'DM Serif Display',Georgia,serif;font-size:clamp(52px,5.5vw,88px);line-height:1.03;letter-spacing:-.02em;color:var(--ink);margin-bottom:24px;max-width:800px}
.hero-h1 em{font-style:italic;color:var(--green)}
.hero-sub{font-size:18px;font-weight:400;color:var(--ink3);line-height:1.7;max-width:520px;margin-bottom:40px}
.hero-ctas{display:flex;align-items:center;gap:14px;margin-bottom:64px;flex-wrap:wrap}
.btn-hero{font-size:15px;font-weight:700;color:var(--bg);background:var(--ink);border:none;border-radius:10px;padding:14px 28px;text-decoration:none;display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .2s;box-shadow:0 2px 0 rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.15)}
.btn-hero:hover{background:var(--green);transform:translateY(-2px);box-shadow:0 4px 0 rgba(26,102,65,.4),0 8px 24px rgba(26,102,65,.3)}
.btn-hero-ghost{font-size:15px;font-weight:600;color:var(--ink2);background:white;border:1.5px solid rgba(0,0,0,.15);border-radius:10px;padding:13px 24px;text-decoration:none;display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .2s}
.btn-hero-ghost:hover{border-color:var(--green);color:var(--green)}

/* ── Stat strip ── */
.stat-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid rgba(0,0,0,.1);border-radius:var(--radius-lg);overflow:hidden;background:white;box-shadow:0 1px 12px rgba(0,0,0,.06)}
.stat-item{padding:22px 24px;border-right:1px solid rgba(0,0,0,.08);position:relative}
.stat-item:last-child{border-right:none}
.stat-val{font-family:'DM Serif Display',serif;font-size:34px;color:var(--ink);line-height:1;margin-bottom:4px}
.stat-val em{font-style:normal;color:var(--green)}
.stat-label{font-size:12px;font-weight:500;color:var(--ink3);letter-spacing:.01em}
.stat-change{position:absolute;top:14px;right:14px;font-size:11px;font-weight:600;color:var(--green);background:var(--green-l);padding:2px 8px;border-radius:20px}

/* ── Dashboard visual ── */
.hero-visual{margin-top:72px}
.dash-card{background:white;border:1px solid rgba(0,0,0,.1);border-radius:20px;box-shadow:0 20px 80px rgba(0,0,0,.10),0 4px 16px rgba(0,0,0,.05);overflow:hidden;max-width:960px;margin:0 auto;position:relative}
.dash-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(26,102,65,.03),transparent 50%);pointer-events:none;z-index:0}
.dash-topbar{background:#f8f8f5;border-bottom:1px solid rgba(0,0,0,.08);padding:11px 18px;display:flex;align-items:center;gap:10px;position:relative;z-index:1}
.dash-dot{width:10px;height:10px;border-radius:50%}
.dash-addr{background:white;border:1px solid rgba(0,0,0,.1);border-radius:6px;padding:3px 12px;font-size:11px;font-family:'Geist Mono',monospace;color:var(--ink3);flex:1;max-width:320px}
.dash-live{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;color:var(--green);letter-spacing:.06em;background:var(--green-l);padding:3px 10px;border-radius:20px}
.dash-live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse-green 1.5s ease-in-out infinite}
.dash-body{padding:20px;position:relative;z-index:1}
.dash-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
.dash-kpi{background:var(--bg);border:1px solid rgba(0,0,0,.07);border-radius:10px;padding:12px 14px}
.dash-kpi-val{font-family:'DM Serif Display',serif;font-size:22px;color:var(--ink);line-height:1;margin-bottom:3px}
.dash-kpi-val em{font-style:normal;color:var(--green)}
.dash-kpi-label{font-size:9.5px;font-weight:500;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
.dash-kpi-trend{font-size:10px;font-weight:600;color:var(--green);margin-top:4px}
.dash-lower{display:grid;grid-template-columns:2fr 1fr;gap:12px}
.dash-chart-wrap{background:var(--bg);border:1px solid rgba(0,0,0,.07);border-radius:10px;padding:14px}
.dash-chart-title{font-size:10px;font-weight:600;color:var(--ink3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px}
.dash-bars{display:flex;align-items:flex-end;gap:3px;height:64px}
.dash-bar{flex:1;border-radius:3px 3px 0 0;transition:height .5s ease}
.dash-sensors{display:flex;flex-direction:column;gap:6px}
.dash-sensor-row{background:var(--bg);border:1px solid rgba(0,0,0,.07);border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between}
.dash-sensor-key{font-size:10px;font-weight:600;color:var(--ink3);letter-spacing:.04em}
.dash-sensor-val{font-size:13px;font-weight:700;color:var(--green);font-family:'Geist Mono',monospace}
.dash-ai{background:linear-gradient(135deg,var(--green-l),var(--teal-l));border:1px solid var(--green-m);border-radius:10px;padding:12px 14px;margin-top:12px;display:flex;align-items:center;gap:12px}
.dash-ai-orb{width:32px;height:32px;background:var(--ink);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.dash-ai-orb svg{width:15px;height:15px;stroke:var(--green-l);fill:none;stroke-width:2}
.dash-ai-content{flex:1}
.dash-ai-title{font-size:11px;font-weight:700;color:var(--ink);margin-bottom:2px}
.dash-ai-sub{font-size:10px;color:var(--ink3)}
.dash-ai-badge{font-size:10px;font-weight:700;color:var(--green);background:white;border:1px solid var(--green-m);padding:3px 10px;border-radius:20px;flex-shrink:0}

/* ── Section shell ── */
.section{padding:96px 0}
.container{max-width:1200px;margin:0 auto;padding:0 32px}
.sec-eyebrow{display:inline-flex;align-items:center;gap:7px;font-family:'Geist Mono',monospace;font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--green);margin-bottom:16px}
.sec-eyebrow::before{content:'';width:20px;height:1px;background:var(--green)}
.sec-h2{font-family:'DM Serif Display',serif;font-size:clamp(34px,3.5vw,52px);line-height:1.1;letter-spacing:-.02em;color:var(--ink);margin-bottom:14px}
.sec-h2 em{font-style:italic;color:var(--green)}
.sec-p{font-size:17px;color:var(--ink3);line-height:1.7}

/* ── Features bento ── */
.bento{display:grid;grid-template-columns:repeat(12,1fr);grid-auto-rows:auto;gap:12px;margin-top:56px}
.bento-card{background:white;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius-lg);padding:28px;transition:all .2s;overflow:hidden;position:relative}
.bento-card::after{content:'';position:absolute;inset:0;opacity:0;transition:opacity .2s;pointer-events:none}
.bento-card:hover{border-color:rgba(26,102,65,.2);box-shadow:0 8px 40px rgba(26,102,65,.08);transform:translateY(-2px)}
.bento-card:hover::after{opacity:1;background:radial-gradient(circle at top left,rgba(26,102,65,.03),transparent 60%)}
.bento-wide{grid-column:span 8}
.bento-narrow{grid-column:span 4}
.bento-half{grid-column:span 6}
.bento-third{grid-column:span 4}
.bento-icon{width:44px;height:44px;border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;flex-shrink:0}
.bento-icon svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.bento-title{font-size:17px;font-weight:700;color:var(--ink);letter-spacing:-.02em;margin-bottom:8px}
.bento-desc{font-size:14px;color:var(--ink3);line-height:1.65}
.bento-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.chip{font-size:11px;font-weight:600;color:var(--ink3);background:var(--bg2);border:1px solid rgba(0,0,0,.1);padding:3px 10px;border-radius:20px}
/* Wide card accent bar */
.bento-accent-bar{height:3px;background:linear-gradient(90deg,var(--green),var(--teal));border-radius:3px;margin-bottom:20px}

/* ── Metrics band ── */
.metrics-band{background:var(--ink);padding:80px 0}
.metrics-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-xl);overflow:hidden}
.metric-cell{padding:40px 32px;text-align:center;border-right:1px solid rgba(255,255,255,.06)}
.metric-cell:last-child{border-right:none}
.metric-big{font-family:'DM Serif Display',serif;font-size:56px;line-height:1;color:white;margin-bottom:6px}
.metric-big em{font-style:normal;color:#4ade80}
.metric-label{font-size:12px;font-weight:500;color:#6b7280;letter-spacing:.06em;text-transform:uppercase}
.metric-sub{font-size:13px;color:#22c55e;margin-top:6px;font-weight:500}

/* ── Testimonials ── */
.testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:52px}
.testi-card{background:white;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius-lg);padding:28px;transition:all .2s;display:flex;flex-direction:column}
.testi-card:hover{border-color:var(--green-m);box-shadow:0 4px 24px rgba(26,102,65,.08)}
.testi-stars{display:flex;gap:2px;margin-bottom:16px}
.testi-star{color:var(--amber)}
.testi-quote{font-size:15px;color:var(--ink2);line-height:1.75;flex:1;margin-bottom:20px;font-style:italic}
.testi-author{display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid var(--bg3)}
.testi-avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:white;flex-shrink:0}
.testi-name{font-size:14px;font-weight:700;color:var(--ink);letter-spacing:-.01em}
.testi-role{font-size:12px;color:var(--muted)}

/* ── Pricing ── */
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:52px}
.plan-card{background:white;border:1.5px solid rgba(0,0,0,.09);border-radius:var(--radius-xl);padding:32px;position:relative;transition:all .2s}
.plan-card:hover{box-shadow:0 8px 40px rgba(0,0,0,.09)}
.plan-card.featured{border-color:var(--green);box-shadow:0 0 0 4px rgba(26,102,65,.08)}
.plan-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--green-l);font-size:10px;font-weight:700;letter-spacing:.08em;padding:4px 14px;border-radius:20px;white-space:nowrap}
.plan-name{font-family:'DM Serif Display',serif;font-size:24px;color:var(--ink);margin-bottom:4px}
.plan-tagline{font-size:13px;color:var(--muted);margin-bottom:24px}
.plan-price{font-family:'DM Serif Display',serif;font-size:44px;color:var(--ink);line-height:1;margin-bottom:4px}
.plan-price sup{font-family:'Geist',sans-serif;font-size:18px;font-weight:700;vertical-align:top;margin-top:8px}
.plan-period{font-size:13px;color:var(--muted);margin-bottom:28px}
.plan-feats{list-style:none;margin-bottom:28px;display:flex;flex-direction:column;gap:10px}
.plan-feat{display:flex;align-items:flex-start;gap:9px;font-size:14px;color:var(--ink2)}
.plan-feat-check{width:18px;height:18px;border-radius:50%;background:var(--green-l);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.plan-feat-check svg{width:10px;height:10px;stroke:var(--green);fill:none;stroke-width:3}
.plan-cta{width:100%;padding:12px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;display:block;text-align:center;transition:all .15s;font-family:'Geist',sans-serif}
.plan-cta-outline{border:1.5px solid rgba(0,0,0,.15);color:var(--ink);background:transparent}
.plan-cta-outline:hover{border-color:var(--green);color:var(--green);background:var(--green-l)}
.plan-cta-solid{border:none;background:var(--ink);color:var(--green-l)}
.plan-cta-solid:hover{background:var(--green)}

/* ── CTA strip ── */
.cta-strip{background:linear-gradient(135deg,var(--ink) 0%,#1a3d2a 100%);padding:80px 0;position:relative;overflow:hidden}
.cta-strip::before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.03) 1px,transparent 1px);background-size:32px 32px}
.cta-strip-inner{text-align:center;position:relative;z-index:1}
.cta-strip-h2{font-family:'DM Serif Display',serif;font-size:clamp(36px,4vw,60px);color:white;letter-spacing:-.02em;line-height:1.1;margin-bottom:14px}
.cta-strip-h2 em{font-style:italic;color:#4ade80}
.cta-strip-p{font-size:17px;color:#94a3b8;margin-bottom:36px}
.btn-cta-white{font-size:15px;font-weight:700;color:var(--ink);background:white;border:none;border-radius:10px;padding:14px 28px;text-decoration:none;display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .2s;box-shadow:0 4px 20px rgba(0,0,0,.25)}
.btn-cta-white:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.3);background:#f0fdf4}
.btn-cta-ghost{font-size:15px;font-weight:600;color:rgba(255,255,255,.7);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:14px 24px;text-decoration:none;display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .2s}
.btn-cta-ghost:hover{background:rgba(255,255,255,.12);color:white}

/* ── Footer ── */
.footer{background:var(--bg2);border-top:1px solid rgba(0,0,0,.08);padding:56px 0 32px}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:48px}
.footer-brand-text{font-size:13px;color:var(--ink3);line-height:1.7;margin-top:12px;max-width:240px}
.footer-col-h{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);margin-bottom:14px}
.footer-link{display:block;font-size:13.5px;color:var(--ink3);text-decoration:none;margin-bottom:9px;transition:.15s}
.footer-link:hover{color:var(--ink)}
.footer-bottom{border-top:1px solid rgba(0,0,0,.08);padding-top:24px;display:flex;align-items:center;justify-content:space-between}
.footer-copy{font-size:12.5px;color:var(--muted)}
.footer-legal{display:flex;gap:20px}
.footer-legal a{font-size:12.5px;color:var(--muted);text-decoration:none}
.footer-legal a:hover{color:var(--ink3)}

@media(max-width:900px){
  .hero-h1{font-size:40px}.stat-strip{grid-template-columns:1fr 1fr}
  .bento{grid-template-columns:1fr}.bento-wide,.bento-narrow,.bento-half,.bento-third{grid-column:span 1}
  .metrics-grid,.testi-grid,.pricing-grid,.footer-grid{grid-template-columns:1fr}
  .nav-links,.nav-actions .btn-nav-ghost{display:none}
  .container{padding:0 20px}.dash-grid{grid-template-columns:repeat(3,1fr)}
  .dash-lower{grid-template-columns:1fr}
}
`

/* ── Live sensor hook ── */
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

/* ── Animated counter ── */
function Counter({ to, suffix='' }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once:true })
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = to / 60
    const id = setInterval(() => {
      start += step
      if (start >= to) { setN(to); clearInterval(id) } else setN(Math.floor(start))
    }, 16)
    return () => clearInterval(id)
  }, [inView, to])
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>
}

/* ── Ticker data ── */
const TICKS = ['◆ LIVE SENSORS','847 DEVICES ONLINE','◆ YIELD TODAY','4,280 KG ACROSS ALL FARMS',
  '◆ AI ACCURACY','94.1% MODEL CONFIDENCE','◆ WATER EFFICIENCY','94% VS CONVENTIONAL',
  '◆ ENERGY SAVED','28.4 KWH VIA AI','◆ UPTIME SLA','99.97% AVAILABILITY',
  '◆ LIVE SENSORS','847 DEVICES ONLINE','◆ YIELD TODAY','4,280 KG ACROSS ALL FARMS',
  '◆ AI ACCURACY','94.1% MODEL CONFIDENCE','◆ WATER EFFICIENCY','94% VS CONVENTIONAL',
  '◆ ENERGY SAVED','28.4 KWH VIA AI','◆ UPTIME SLA','99.97% AVAILABILITY',
]

/* ── Chart bars ── */
const BARS = [38,45,52,48,58,62,55,68,72,65,78,74,84,88]

const FADE_UP = { hidden:{ opacity:0, y:28 }, show:{ opacity:1, y:0 } }
const STAGGER = { hidden:{}, show:{ transition:{ staggerChildren:.1 } } }

/* ── Features ── */
const FEATURES = [
  { span:'wide', icon:'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18', color:'#1a6641', bg:'#e8f5ee',
    title:'Real-Time IoT Monitoring', chips:['MQTT','Modbus','REST','OPC-UA','WebSocket'],
    desc:'847 sensors streaming at 100ms intervals. Temperature, RH, CO₂, pH, EC, PPFD, flow rate, pressure — all unified in a single live view with configurable alert thresholds.' },
  { span:'narrow', icon:'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0', color:'#0d7a6e', bg:'#e0f4f1',
    title:'AI Yield Intelligence', chips:['YOLOv8','LSTM','Bayesian'],
    desc:'Predictive analytics 7 days ahead. 94.1% confidence on harvest yield, anomaly detection, and computer vision crop health scanning.' },
  { span:'half', icon:'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color:'#c47a1e', bg:'#fdf0dc',
    title:'Full Lifecycle Automation', chips:['Climate','Irrigation','CO₂','Lighting'],
    desc:'Recipe-driven grow cycles. Trigger-based rules that close the loop between sensors and actuators — no manual intervention required.' },
  { span:'half', icon:'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color:'#7c3aed', bg:'#ede9fe',
    title:'Analytics & Traceability', chips:['QR Trace','FSSAI','GlobalGAP','PDF Reports'],
    desc:'Yield performance, cost-of-production, sustainability scores. Full QR traceability from seed lot to buyer scan at point of sale.' },
  { span:'third', icon:'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197', color:'#2563eb', bg:'#dbeafe',
    title:'Team & RBAC', chips:['Roles','Audit'],
    desc:'Granular permissions, invite flows, and full audit trails across every action.' },
  { span:'third', icon:'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z', color:'#db2777', bg:'#fce7f3',
    title:'API & Integrations', chips:['REST','SDK','Webhooks'],
    desc:'Connect SAP, Salesforce, Slack, Stripe, WhatsApp. Full REST API with rate limiting.' },
  { span:'third', icon:'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', color:'#0d7a6e', bg:'#e0f4f1',
    title:'Multi-Site Franchise', chips:['Franchise','Reseller'],
    desc:'Push recipes and configs across franchise sites from a central control panel.' },
]

const METRICS = [
  { val:94, unit:'%', label:'Water Efficiency', sub:'+12% vs soil' },
  { val:28, unit:'kWh', label:'AI Energy Saved / Day', sub:'₹840 average savings' },
  { val:847, unit:'+', label:'Live IoT Sensors', sub:'99.97% uptime SLA' },
  { val:18, unit:'%', label:'Yield Increase', sub:'Avg with AI recipes' },
]

const TESTIMONIALS = [
  { init:'AS', color:'#1a6641', name:'Arjun Sharma', role:'CEO, GreenLeaf Farms Delhi',
    text:'VertiFarm XOS cut our time-to-harvest by 18% in Q1. The AI yield forecast is remarkable — we now pre-sell 90% before harvest, which transformed our cash flow.' },
  { init:'PM', color:'#0d7a6e', name:'Priya Menon', role:'Operations Lead, FreshGrow Bengaluru',
    text:'8 farms onboarded in a weekend. The zone health grid and live alerts replaced our entire ops WhatsApp group. Support response time is genuinely exceptional.' },
  { init:'RK', color:'#7c3aed', name:'Rahul Kumar', role:'Founder, AeroFarms Pune',
    text:'QR traceability is a game changer for premium restaurant clients. They scan the bag and see EC level, harvest date, zone. That transparency commands 15% premium pricing.' },
]

const PLANS = [
  { name:'Starter', tagline:'For pilots & small ops', price:'4,999', period:'/ month', featured:false,
    feats:['1 farm · 10 zones · 50 sensors','3 team members','Real-time monitoring & alerts','Basic AI yield forecast','30-day data retention','Email support'],
    cta:'Start Free Trial' },
  { name:'Growth', tagline:'For scaling indoor farms', price:'14,999', period:'/ month', featured:true,
    feats:['5 farms · 60 zones · 500 sensors','15 team members','Full AI intelligence suite','Automation rule builder','Traceability & QR certs','1-year data retention','Priority support'],
    cta:'Start Free Trial' },
  { name:'Enterprise', tagline:'For multi-site operators', price:'Custom', period:'Contact us', featured:false,
    feats:['Unlimited farms, zones, sensors','Unlimited users & roles','White-label option','Franchise management','Dedicated SLA & CSM','5-year data retention','24/7 phone support'],
    cta:'Talk to Sales' },
]

export default function LandingPage() {
  const [solid, setSolid] = useState(false)
  const live = useLive()
  const maxBar = Math.max(...BARS)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60])

  useEffect(() => {
    const s = document.createElement('style')
    s.textContent = G
    document.head.appendChild(s)
    return () => s.remove()
  }, [])

  useEffect(() => {
    const fn = () => setSolid(window.scrollY > 60)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <>
      {/* ── Ticker ── */}
      <div className="tk">
        <div className="tk-inner">
          {[...TICKS, ...TICKS].map((t, i) => (
            <span key={i} className="tk-item">
              {t.startsWith('◆') ? <span className="tk-sep">/</span> : null}
              {t.startsWith('◆')
                ? <b>{t.replace('◆ ','')}</b>
                : <>{t}</>
              }
            </span>
          ))}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className={`nav ${solid?'solid':''}`}>
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <div className="nav-logo-mark">
              <svg viewBox="0 0 24 24"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z"/><path d="M12 7v10M4 7l8 5 8-5"/></svg>
            </div>
            <span className="nav-logo-text">VertiFarm XOS</span>
            <span className="nav-logo-badge">v1.0</span>
          </Link>
          <div className="nav-links">
            {['Platform','Features','Farm Types','Pricing','Customers'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(' ','-')}`} className="nav-link">{l}</a>
            ))}
          </div>
          <div className="nav-actions">
            <Link to="/login" className="btn-nav-ghost">Sign in</Link>
            <Link to="/signup" className="btn-nav-cta">
              Start Free Trial
              <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero" ref={heroRef} id="platform">
        <div className="hero-mesh"/>
        <div className="hero-dots"/>
        <motion.div className="hero-inner" style={{ y: heroY }}>
          <motion.div initial="hidden" animate="show" variants={STAGGER}>
            <motion.div variants={FADE_UP}>
              <div className="hero-tag">
                <span className="hero-tag-pulse"/>
                AI-POWERED PRECISION AGRICULTURE OS
              </div>
            </motion.div>
            <motion.h1 className="hero-h1" variants={FADE_UP}>
              Grow <em>Smarter.</em><br/>
              Scale <em>Faster.</em><br/>
              Harvest <em>More.</em>
            </motion.h1>
            <motion.p className="hero-sub" variants={FADE_UP}>
              VertiFarm XOS combines real-time IoT monitoring, AI-driven crop intelligence,
              and full lifecycle automation — in one enterprise platform built for indoor vertical farms.
            </motion.p>
            <motion.div className="hero-ctas" variants={FADE_UP}>
              <Link to="/signup" className="btn-hero">
                Start 14-Day Free Trial
                <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </Link>
              <a href="#features" className="btn-hero-ghost">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg>
                See Features
              </a>
            </motion.div>

            {/* ── Stat strip ── */}
            <motion.div className="stat-strip" variants={FADE_UP}>
              {[
                { val:'847', label:'Live Sensors', change:'↑ +12 today' },
                { val:'94%', label:'Water Efficiency', change:'vs conventional' },
                { val:'4.3t', label:'Avg Daily Yield', change:'↑ +18% AI lift' },
                { val:'99.97%', label:'Uptime SLA', change:'Last 12 months' },
              ].map(s => (
                <div key={s.label} className="stat-item">
                  <div className="stat-val">{s.val}</div>
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-change">{s.change}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* ── Dashboard mockup ── */}
          <motion.div className="hero-visual"
            initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:.4, duration:.7, ease:[.22,1,.36,1] }}>
            <div className="dash-card">
              <div className="dash-topbar">
                <div className="dash-dot" style={{ background:'#ff6059' }}/>
                <div className="dash-dot" style={{ background:'#ffbd2e' }}/>
                <div className="dash-dot" style={{ background:'#28c840' }}/>
                <div className="dash-addr">vertifarm-xos · farm-dashboard · Delhi HQ</div>
                <div className="dash-live"><span className="dash-live-dot"/>LIVE</div>
              </div>
              <div className="dash-body">
                <div className="dash-grid">
                  {[['847','SENSORS','↑ 2 new'],['4.28t','YIELD TODAY','↑ +4.4%'],['94%','WATER EFF.','Target: 90%'],['312kWh','ENERGY','↓ 8% saved'],['5','ACTIVE ALERTS','2 critical']].map(([v,l,t]) => (
                    <div key={l} className="dash-kpi">
                      <div className="dash-kpi-val">{v}</div>
                      <div className="dash-kpi-label">{l}</div>
                      <div className="dash-kpi-trend">{t}</div>
                    </div>
                  ))}
                </div>
                <div className="dash-lower">
                  <div className="dash-chart-wrap">
                    <div className="dash-chart-title">Yield Trend — 14 Days (kg/day)</div>
                    <div className="dash-bars">
                      {BARS.map((v, i) => (
                        <div key={i} className="dash-bar" style={{
                          height: `${(v/maxBar)*100}%`,
                          background: i === BARS.length-1 ? 'var(--green)' : i > 9 ? 'rgba(26,102,65,.45)' : 'var(--bg3)',
                          minHeight: 4
                        }}/>
                      ))}
                    </div>
                  </div>
                  <div className="dash-sensors">
                    {[['TEMP',`${live.t}°C`],['RH %',`${live.h}%`],['CO₂',`${live.c}ppm`],['pH',`${live.p}`],['EC',`${live.e}`]].map(([k,v]) => (
                      <div key={k} className="dash-sensor-row">
                        <span className="dash-sensor-key">{k}</span>
                        <span className="dash-sensor-val">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="dash-ai">
                  <div className="dash-ai-orb">
                    <svg viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                  </div>
                  <div className="dash-ai-content">
                    <div className="dash-ai-title">AI Agronomist · Zone A3 Basil Recommendation</div>
                    <div className="dash-ai-sub">↑ EC to 2.4 mS/cm · +14% yield forecast · 94.1% confidence · Approve or defer</div>
                  </div>
                  <div className="dash-ai-badge">AI ✦</div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features bento ── */}
      <section className="section" id="features" style={{ background:'var(--bg2)' }}>
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once:true, margin:'-80px' }} variants={STAGGER}>
            <motion.div variants={FADE_UP} className="sec-eyebrow">Platform Features</motion.div>
            <motion.h2 variants={FADE_UP} className="sec-h2">Everything your farm needs<br/><em>in one platform</em></motion.h2>
            <motion.p variants={FADE_UP} className="sec-p" style={{ maxWidth:500 }}>
              From seed to shelf — real-time monitoring, AI intelligence, automation, and traceability.
            </motion.p>
          </motion.div>
          <motion.div className="bento"
            initial="hidden" whileInView="show" viewport={{ once:true, margin:'-60px' }} variants={STAGGER}>
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} variants={FADE_UP}
                className={`bento-card bento-${f.span}`}
                style={{ background:'white' }}>
                {f.span === 'wide' && <div className="bento-accent-bar"/>}
                <div className="bento-icon" style={{ background:f.bg, color:f.color }}>
                  <svg viewBox="0 0 24 24" stroke={f.color}><path strokeLinecap="round" strokeLinejoin="round" d={f.icon}/></svg>
                </div>
                <div className="bento-title">{f.title}</div>
                <div className="bento-desc">{f.desc}</div>
                <div className="bento-chips">{f.chips.map(c => <span key={c} className="chip">{c}</span>)}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section className="metrics-band">
        <div className="container">
          <motion.div style={{ textAlign:'center', marginBottom:48 }}
            initial="hidden" whileInView="show" viewport={{ once:true }} variants={STAGGER}>
            <motion.div variants={FADE_UP} className="sec-eyebrow" style={{ color:'#4ade80', justifyContent:'center' }}>
              <span style={{ background:'#4ade80' }}/>Proven Results
            </motion.div>
            <motion.h2 variants={FADE_UP} className="sec-h2" style={{ color:'white' }}>
              Numbers that speak<br/><em style={{ color:'#4ade80' }}>for themselves</em>
            </motion.h2>
          </motion.div>
          <motion.div className="metrics-grid"
            initial="hidden" whileInView="show" viewport={{ once:true }} variants={STAGGER}>
            {METRICS.map(m => (
              <motion.div key={m.label} className="metric-cell" variants={FADE_UP}>
                <div className="metric-big">
                  <em><Counter to={m.val}/></em>{m.unit}
                </div>
                <div className="metric-label">{m.label}</div>
                <div className="metric-sub">{m.sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="section" id="customers">
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once:true }} variants={STAGGER}>
            <motion.div variants={FADE_UP} className="sec-eyebrow">Customer Stories</motion.div>
            <motion.h2 variants={FADE_UP} className="sec-h2">
              Trusted by farm operators<br/><em>across India</em>
            </motion.h2>
          </motion.div>
          <motion.div className="testi-grid"
            initial="hidden" whileInView="show" viewport={{ once:true }} variants={STAGGER}>
            {TESTIMONIALS.map(t => (
              <motion.div key={t.name} className="testi-card" variants={FADE_UP}>
                <div className="testi-stars">{'★★★★★'.split('').map((s,i) => <span key={i} className="testi-star">{s}</span>)}</div>
                <p className="testi-quote">"{t.text}"</p>
                <div className="testi-author">
                  <div className="testi-avatar" style={{ background:`linear-gradient(135deg,${t.color},#0f172a)` }}>{t.init}</div>
                  <div>
                    <div className="testi-name">{t.name}</div>
                    <div className="testi-role">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="section" id="pricing" style={{ background:'var(--bg2)' }}>
        <div className="container">
          <motion.div initial="hidden" whileInView="show" viewport={{ once:true }} variants={STAGGER}>
            <motion.div variants={FADE_UP} className="sec-eyebrow">Pricing</motion.div>
            <motion.h2 variants={FADE_UP} className="sec-h2">Simple, <em>transparent pricing</em></motion.h2>
            <motion.p variants={FADE_UP} className="sec-p">14-day free trial. No credit card required. No lock-in.</motion.p>
          </motion.div>
          <motion.div className="pricing-grid"
            initial="hidden" whileInView="show" viewport={{ once:true }} variants={STAGGER}>
            {PLANS.map(p => (
              <motion.div key={p.name} className={`plan-card ${p.featured?'featured':''}`} variants={FADE_UP}>
                {p.featured && <div className="plan-badge">MOST POPULAR</div>}
                <div className="plan-name">{p.name}</div>
                <div className="plan-tagline">{p.tagline}</div>
                {p.price === 'Custom' ? (
                  <div className="plan-price" style={{ fontSize:32 }}>Custom</div>
                ) : (
                  <div className="plan-price"><sup>₹</sup>{p.price}</div>
                )}
                <div className="plan-period">{p.period}</div>
                <ul className="plan-feats">
                  {p.feats.map(f => (
                    <li key={f} className="plan-feat">
                      <span className="plan-feat-check"><svg viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={p.cta === 'Talk to Sales' ? '/contact' : '/signup'}
                  className={`plan-cta ${p.featured ? 'plan-cta-solid' : 'plan-cta-outline'}`}>
                  {p.cta}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section className="cta-strip">
        <div className="container">
          <motion.div className="cta-strip-inner"
            initial="hidden" whileInView="show" viewport={{ once:true }} variants={STAGGER}>
            <motion.h2 variants={FADE_UP} className="cta-strip-h2">
              Ready to grow <em>smarter?</em>
            </motion.h2>
            <motion.p variants={FADE_UP} className="cta-strip-p">
              Join 48+ indoor farms running on VertiFarm XOS. Free 14-day trial — no credit card, no lock-in.
            </motion.p>
            <motion.div variants={FADE_UP} style={{ display:'flex', justifyContent:'center', gap:14, flexWrap:'wrap' }}>
              <Link to="/signup" className="btn-cta-white">
                Start Free Trial →
              </Link>
              <a href="mailto:sales@vertifarm.io" className="btn-cta-ghost">Talk to Sales</a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link to="/" className="nav-logo" style={{ textDecoration:'none' }}>
                <div className="nav-logo-mark"><svg viewBox="0 0 24 24" width="18" height="18" stroke="#e8f5ee" fill="none" strokeWidth="2"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z"/><path d="M12 7v10M4 7l8 5 8-5"/></svg></div>
                <span className="nav-logo-text">VertiFarm XOS</span>
              </Link>
              <p className="footer-brand-text">The world's most advanced OS for indoor vertical farms. Real-time IoT, AI intelligence, and lifecycle automation.</p>
            </div>
            {[['Platform',['Overview','Features','Integrations','API Docs']],['Company',['About','Blog','Careers','Contact']],['Legal',['Privacy','Terms','Security','GDPR']]].map(([h, links]) => (
              <div key={h as string}>
                <div className="footer-col-h">{h}</div>
                {(links as string[]).map(l => <a key={l} href="#" className="footer-link">{l}</a>)}
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <span className="footer-copy">© 2026 VertiFarm Technologies Pvt. Ltd.</span>
            <div className="footer-legal">
              <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
