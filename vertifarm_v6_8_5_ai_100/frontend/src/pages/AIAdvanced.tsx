import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { phase3AiApi } from '@/lib/api'
import { Badge, StatCard } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  Brain, TrendingUp, AlertTriangle, Zap, Calendar, Eye, Leaf,
  CheckCircle, XCircle, ChevronRight, RefreshCw, BarChart3,
  Activity, Target, Droplets, Sun, Wind, Shield, Info,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, PieChart, Pie,
} from 'recharts'

/* ── Demo fallback data (shown when backend returns empty) ── */
const DEMO_FORECAST = {
  total_forecast_kg: 28400,
  confidence_pct: 94.1,
  daily_series: Array.from({length:7},(_,i)=>({
    date: new Date(Date.now()+i*86400000).toISOString().slice(0,10),
    forecast_kg: 3800 + Math.round(Math.sin(i)*400 + Math.random()*300),
    upper: 4200 + i*50, lower: 3600 - i*30,
  })),
  zones: [
    {zone:'A1 Lettuce',    forecast_kg:4200, target_kg:4000, confidence:0.96, trend:'above_target', recommendation:'Harvest rows 1-3 on Day 5.'},
    {zone:'A2 Spinach',    forecast_kg:3100, target_kg:3000, confidence:0.91, trend:'on_track',     recommendation:'Maintain current EC 1.8 mS/cm.'},
    {zone:'A3 Basil',      forecast_kg:1850, target_kg:2200, confidence:0.81, trend:'below_target', recommendation:'Boost EC to 2.4 mS/cm to recover yield.'},
    {zone:'D1 Tomato',     forecast_kg:8900, target_kg:8500, confidence:0.94, trend:'above_target', recommendation:'Exceptional run — no changes needed.'},
    {zone:'C4 Microgreens',forecast_kg:950,  target_kg:900,  confidence:0.88, trend:'on_track',     recommendation:'Harvest in 2 days.'},
  ],
}

const DEMO_ANOMALIES = [
  {id:'a1', severity:'critical', zone_name:'Zone B2', sensor_type:'flow_rate',    anomaly_score:0.92, description:'Pump flow dropped to 0 L/min — primary pump failure detected.', suggested_action:'Activate backup pump B2-BKP01.',          is_resolved:false, created_at:new Date(Date.now()-2*60000).toISOString()},
  {id:'a2', severity:'warning',  zone_name:'Zone A3', sensor_type:'humidity',     anomaly_score:0.78, description:'Relative humidity 91.3% — 26% above Basil threshold.',           suggested_action:'Increase exhaust fan speed 15%.',           is_resolved:false, created_at:new Date(Date.now()-15*60000).toISOString()},
  {id:'a3', severity:'warning',  zone_name:'Pune',    sensor_type:'ec',           anomaly_score:0.65, description:'Nutrient EC drifting from 2.1 → 1.6 mS/cm over 4 hours.',       suggested_action:'Top-up nutrient tank; auto-dose queued.',   is_resolved:false, created_at:new Date(Date.now()-35*60000).toISOString()},
  {id:'a4', severity:'info',     zone_name:'Zone C3', sensor_type:'computer_vision',anomaly_score:0.54,description:'Early leaf curl on Strawberry — probable Ca deficiency.',        suggested_action:'Apply 0.5% foliar calcium spray.',          is_resolved:false, created_at:new Date(Date.now()-72*60000).toISOString()},
  {id:'a5', severity:'info',     zone_name:'Zone D1', sensor_type:'co2',          anomaly_score:0.41, description:'CO₂ cycle completed ahead of schedule by 8 minutes.',             suggested_action:'No action required.',                       is_resolved:true,  created_at:new Date(Date.now()-3*3600000).toISOString()},
]

const DEMO_ENERGY = {
  savings_per_day_inr: 1840,
  savings_per_month_inr: 55200,
  current_daily_cost_inr: 14850,
  optimized_daily_cost_inr: 13010,
  savings_pct: 12.4,
  total_kwh_today: 312,
  saved_kwh_today: 43.2,
  peak_hours: [8, 9, 10, 18, 19, 20, 21],
  recommendations: [
    'Shift Zone A1 lighting to 23:00–06:00 off-peak — saves ₹680/day',
    'Zone B3 fans oversized for current humidity load — reduce speed 20%',
    'CO₂ injection Zone C1 can use off-peak window (2–4 AM) — saves ₹360/week',
    'HVAC Zone D1 overshooting setpoint by 1.2°C — tune PID controller',
  ],
  breakdown: [
    {name:'Lighting', value:54},
    {name:'HVAC',     value:28},
    {name:'Pumps',    value:10},
    {name:'CO₂',      value:5 },
    {name:'Other',    value:3 },
  ],
}

const DEMO_HARVEST = [
  {
    id:'h1', crop_name:'Microgreens Mix',     zone_name:'Zone C4', urgency:'ready_now',
    days_until_optimal:0,  confidence_pct:95, predicted_yield_kg:95,
    window_start: new Date().toISOString(),
    window_end:   new Date(Date.now()+2*86400000).toISOString(),
    optimal_day:  new Date().toISOString(),
    factors:['Day 10 of 10','Target DLI met','Weight at target'],
  },
  {
    id:'h2', crop_name:'Butterhead Lettuce',  zone_name:'Zone A1', urgency:'this_week',
    days_until_optimal:3,  confidence_pct:96, predicted_yield_kg:420,
    window_start: new Date(Date.now()+2*86400000).toISOString(),
    window_end:   new Date(Date.now()+5*86400000).toISOString(),
    optimal_day:  new Date(Date.now()+3*86400000).toISOString(),
    factors:['Day 25 of 28','Head weight 180g avg','Tip-burn minimal'],
  },
  {
    id:'h3', crop_name:'Sweet Basil',         zone_name:'Zone C2', urgency:'this_week',
    days_until_optimal:1,  confidence_pct:91, predicted_yield_kg:180,
    window_start: new Date(Date.now()+86400000).toISOString(),
    window_end:   new Date(Date.now()+3*86400000).toISOString(),
    optimal_day:  new Date(Date.now()+86400000).toISOString(),
    factors:['Pre-flower stage','Strong aroma','Day 34 of 35'],
  },
  {
    id:'h4', crop_name:'Cherry Tomato F1',    zone_name:'Zone D1', urgency:'next_week',
    days_until_optimal:12, confidence_pct:94, predicted_yield_kg:890,
    window_start: new Date(Date.now()+10*86400000).toISOString(),
    window_end:   new Date(Date.now()+14*86400000).toISOString(),
    optimal_day:  new Date(Date.now()+12*86400000).toISOString(),
    factors:['Fruit set 89%','Brix 7.2','Day 78 of 90'],
  },
  {
    id:'h5', crop_name:'Rainbow Swiss Chard', zone_name:'Zone R2', urgency:'upcoming',
    days_until_optimal:8,  confidence_pct:87, predicted_yield_kg:240,
    window_start: new Date(Date.now()+7*86400000).toISOString(),
    window_end:   new Date(Date.now()+10*86400000).toISOString(),
    optimal_day:  new Date(Date.now()+8*86400000).toISOString(),
    factors:['Leaf span 22cm','Stem colour excellent','Day 22 of 30'],
  },
]

/* ── Per-crop Unsplash plant images ───────────────────────────── */
const CROP_IMAGES: Record<string, string> = {
  'Butterhead Lettuce':  'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600&q=80&fit=crop',
  'Basil':               'https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=600&q=80&fit=crop',
  'Strawberry':          'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&q=80&fit=crop',
  'Cherry Tomato':       'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=600&q=80&fit=crop',
  'Microgreens':         'https://images.unsplash.com/photo-1611329532992-0d859f6e5c4a?w=600&q=80&fit=crop',
  'Spinach':             'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80&fit=crop',
  'Kale':                'https://images.unsplash.com/photo-1628773822503-930a7eaecf80?w=600&q=80&fit=crop',
  'Arugula':             'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80&fit=crop',
  'Cucumber':            'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=600&q=80&fit=crop',
  'Pepper':              'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&q=80&fit=crop',
  'default':             'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=600&q=80&fit=crop',
}

function getCropImage(cropName: string): string {
  if (!cropName) return CROP_IMAGES['default']
  // exact match first
  if (CROP_IMAGES[cropName]) return CROP_IMAGES[cropName]
  // partial match — crop name may contain key or key may be in crop name
  const lower = cropName.toLowerCase()
  const key = Object.keys(CROP_IMAGES).find(k =>
    k !== 'default' && (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower))
  )
  return key ? CROP_IMAGES[key] : CROP_IMAGES['default']
}

/* Simulated YOLO bounding box definitions per scan */
interface BBox { x:number; y:number; w:number; h:number; label:string; conf:number; color:string }
const SCAN_BBOXES: Record<string, BBox[]> = {
  /* cv1 — Basil disease scan: Botrytis + healthy + spore cluster */
  cv1: [
    { x:12,  y:18,  w:32, h:28, label:'Botrytis',     conf:0.89, color:'#ef4444' },
    { x:54,  y:12,  w:38, h:35, label:'Healthy leaf',  conf:0.97, color:'#00d4aa' },
    { x:8,   y:60,  w:28, h:22, label:'Spore cluster', conf:0.73, color:'#f59e0b' },
    { x:52,  y:58,  w:35, h:28, label:'Healthy leaf',  conf:0.91, color:'#00d4aa' },
  ],
  /* cv2 — Strawberry: leaf curl + Ca deficiency + healthy */
  cv2: [
    { x:10,  y:14,  w:38, h:32, label:'Leaf curl',     conf:0.76, color:'#f59e0b' },
    { x:56,  y:12,  w:36, h:30, label:'Healthy',       conf:0.94, color:'#00d4aa' },
    { x:14,  y:58,  w:30, h:24, label:'Ca deficiency', conf:0.68, color:'#ef4444' },
    { x:54,  y:56,  w:32, h:26, label:'Healthy',       conf:0.88, color:'#00d4aa' },
  ],
  /* cv3 — Lettuce: 3 × mature heads + 1 immature */
  cv3: [
    { x:8,   y:14,  w:36, h:36, label:'Mature head',   conf:0.98, color:'#00d4aa' },
    { x:54,  y:12,  w:38, h:38, label:'Mature head',   conf:0.96, color:'#00d4aa' },
    { x:10,  y:54,  w:35, h:34, label:'Mature head',   conf:0.95, color:'#00d4aa' },
    { x:54,  y:56,  w:34, h:30, label:'Immature',      conf:0.91, color:'#f59e0b' },
  ],
  /* cv4 — Tomato: 3 × ripe + semi-ripe + unripe */
  cv4: [
    { x:10,  y:14,  w:22, h:26, label:'Ripe fruit',    conf:0.97, color:'#ef4444' },
    { x:38,  y:12,  w:22, h:24, label:'Ripe fruit',    conf:0.95, color:'#ef4444' },
    { x:67,  y:16,  w:20, h:22, label:'Semi-ripe',     conf:0.88, color:'#f59e0b' },
    { x:18,  y:54,  w:24, h:26, label:'Ripe fruit',    conf:0.94, color:'#ef4444' },
    { x:52,  y:52,  w:22, h:24, label:'Unripe',        conf:0.82, color:'#00d4aa' },
  ],
  /* cv5 — Microgreens: dense canopy + cotyledon stage */
  cv5: [
    { x:8,   y:12,  w:40, h:38, label:'Dense canopy',  conf:0.99, color:'#00d4aa' },
    { x:52,  y:12,  w:40, h:36, label:'Dense canopy',  conf:0.98, color:'#00d4aa' },
    { x:8,   y:56,  w:38, h:34, label:'Cotyledon',     conf:0.95, color:'#3b82f6' },
    { x:52,  y:58,  w:38, h:32, label:'Cotyledon',     conf:0.93, color:'#3b82f6' },
  ],
  /* cv6 — Spinach: mature leaves + young + yellowing tip */
  cv6: [
    { x:8,   y:12,  w:36, h:42, label:'Mature leaf',   conf:0.97, color:'#00d4aa' },
    { x:52,  y:10,  w:38, h:40, label:'Mature leaf',   conf:0.96, color:'#00d4aa' },
    { x:10,  y:58,  w:32, h:30, label:'Young leaf',    conf:0.91, color:'#3b82f6' },
    { x:52,  y:58,  w:30, h:28, label:'Yellowing tip', conf:0.74, color:'#f59e0b' },
  ],
}

const DEMO_CV_SCANS = [
  {
    id:'cv1', zone_name:'Zone A3', crop_name:'Basil', scan_type:'disease', severity:'warning',
    confidence:0.89, canopy_coverage_pct:82, growth_rate_index:6.4, disease_risk_pct:34,
    model_version:'YOLOv8-v1.8', created_at:new Date(Date.now()-15*60000).toISOString(),
    summary:'Early Botrytis spore signature on lower leaves (34% prob).',
    recommendation:'Reduce RH below 75%, increase exhaust fan speed 15%. Monitor daily.',
    plant_count:116, growth_stage:'Vegetative — Day 9',
    detections:[{label:'Botrytis spore',confidence:0.89,area_pct:8},{label:'Healthy leaf',confidence:0.97,area_pct:74}],
  },
  {
    id:'cv2', zone_name:'Zone C3', crop_name:'Strawberry', scan_type:'disease', severity:'warning',
    confidence:0.76, canopy_coverage_pct:71, growth_rate_index:5.1, disease_risk_pct:22,
    model_version:'YOLOv8-v1.8', created_at:new Date(Date.now()-45*60000).toISOString(),
    summary:'Leaf curl consistent with Ca deficiency on runners.',
    recommendation:'Apply 0.5% calcium foliar spray. Re-scan in 48h.',
    plant_count:78, growth_stage:'Fruiting — Day 45',
    detections:[{label:'Leaf curl',confidence:0.76,area_pct:15},{label:'Healthy tissue',confidence:0.94,area_pct:56}],
  },
  {
    id:'cv3', zone_name:'Zone A1', crop_name:'Butterhead Lettuce', scan_type:'growth', severity:'info',
    confidence:0.98, canopy_coverage_pct:94, growth_rate_index:9.1, disease_risk_pct:2,
    model_version:'YOLOv8-v1.8', created_at:new Date(Date.now()-2*3600000).toISOString(),
    summary:'Uniform head formation — 94% within 10g of 180g target.',
    recommendation:'Harvest in 3 days. Pre-cool at 4°C for 2h post-cut.',
    plant_count:188, growth_stage:'Late Vegetative — Day 18',
    detections:[{label:'Mature head',confidence:0.98,area_pct:88},{label:'Immature head',confidence:0.91,area_pct:6}],
  },
  {
    id:'cv4', zone_name:'Zone D1', crop_name:'Cherry Tomato', scan_type:'harvest', severity:'info',
    confidence:0.97, canopy_coverage_pct:88, growth_rate_index:7.8, disease_risk_pct:5,
    model_version:'YOLOv8-v1.8', created_at:new Date(Date.now()-4*3600000).toISOString(),
    summary:'Fruit colour index 7.2/10 — optimal harvest in 12 days.',
    recommendation:'Mark rows 1–3 for harvest. Maintain K at 200 ppm for sweetness.',
    plant_count:78, growth_stage:'Fruiting — Day 78',
    detections:[{label:'Ripe fruit',confidence:0.97,area_pct:45},{label:'Semi-ripe',confidence:0.88,area_pct:32},{label:'Unripe',confidence:0.82,area_pct:11}],
  },
  {
    id:'cv5', zone_name:'Zone D1', crop_name:'Microgreens', scan_type:'harvest', severity:'info',
    confidence:0.99, canopy_coverage_pct:97, growth_rate_index:9.8, disease_risk_pct:1,
    model_version:'YOLOv8-v1.8', created_at:new Date(Date.now()-6*3600000).toISOString(),
    summary:'Microgreens dense and uniform — harvest window open today.',
    recommendation:'Harvest within 24h. Target first cotyledon-to-true-leaf transition.',
    plant_count:395, growth_stage:'Cotyledon — Day 7',
    detections:[{label:'Dense canopy',confidence:0.99,area_pct:95},{label:'Cotyledon stage',confidence:0.97,area_pct:90}],
  },
  {
    id:'cv6', zone_name:'Zone A2', crop_name:'Spinach', scan_type:'growth', severity:'info',
    confidence:0.94, canopy_coverage_pct:86, growth_rate_index:8.2, disease_risk_pct:8,
    model_version:'YOLOv8-v1.8', created_at:new Date(Date.now()-8*3600000).toISOString(),
    summary:'Good canopy development. Minor tip yellowing on 4% of leaves.',
    recommendation:'Check Fe and Mn levels. Adjust pH to 6.0–6.2 range.',
    plant_count:154, growth_stage:'Mid Vegetative — Day 11',
    detections:[{label:'Mature leaf',confidence:0.94,area_pct:82},{label:'Young leaf',confidence:0.91,area_pct:14},{label:'Yellowing tip',confidence:0.74,area_pct:4}],
  },
]

const DEMO_MODELS = [
  {id:'m1', model_type:'yield_prediction',   version:'3.2.1', accuracy:0.961, is_active:true,  trained_at:new Date(Date.now()-7*86400000).toISOString(),  metrics:{rmse:0.034, mae:0.021}, notes:'LSTM trained on 18 months of sensor + harvest data.'},
  {id:'m2', model_type:'anomaly_detection',  version:'3.1.0', accuracy:0.943, is_active:true,  trained_at:new Date(Date.now()-14*86400000).toISOString(), metrics:{rmse:0.052, mae:0.038}, notes:'Isolation Forest + LSTM autoencoder ensemble.'},
  {id:'m3', model_type:'nutrient_optimizer', version:'2.4.0', accuracy:0.918, is_active:true,  trained_at:new Date(Date.now()-21*86400000).toISOString(), metrics:{rmse:0.041, mae:0.028}, notes:'Bayesian optimizer trained on 47 crop varieties.'},
  {id:'m4', model_type:'energy_optimizer',   version:'2.2.0', accuracy:0.887, is_active:true,  trained_at:new Date(Date.now()-30*86400000).toISOString(), metrics:{rmse:0.071, mae:0.055}, notes:'Reinforcement learning agent — 28% avg energy saving.'},
  {id:'m5', model_type:'harvest_scheduler',  version:'3.0.1', accuracy:0.929, is_active:true,  trained_at:new Date(Date.now()-10*86400000).toISOString(), metrics:{rmse:0.048, mae:0.032}, notes:'Gradient boosted trees with phenological calendar.'},
  {id:'m6', model_type:'computer_vision',    version:'1.8.0', accuracy:0.952, is_active:false, trained_at:new Date(Date.now()-45*86400000).toISOString(), metrics:{rmse:0.031, mae:0.019}, notes:'YOLOv8 fine-tuned on 12,000 annotated plant images.'},
]


const C = { accent: '#00d4aa', amber: '#ffb547', red: '#ff4d6d', blue: '#3b82f6', purple: '#8b5cf6', muted: '#64748b' }
const TS = {
  contentStyle: { background: '#0c1525', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8, fontSize: 11, color: '#e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' },
  labelStyle: { color: '#94a3b8', fontSize: 11 },
}

type Tab = 'overview' | 'yield' | 'anomaly' | 'nutrient' | 'energy' | 'harvest' | 'vision' | 'models'

/* ── Severity badge ─────────────────────────────────────── */
function SevBadge({ sev }: { sev: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'rgba(255,77,109,0.15)', color: '#ff4d6d' },
    warning: { bg: 'rgba(255,181,71,0.15)', color: '#ffb547' },
    info: { bg: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
  }
  const s = map[sev] || map.info
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {sev}
    </span>
  )
}

/* ── Trend chip ─────────────────────────────────────────── */
function TrendChip({ trend }: { trend: string }) {
  const map: Record<string, { label: string; color: string }> = {
    above_target: { label: '↑ Above Target', color: C.accent },
    on_track:     { label: '✓ On Track',     color: C.blue },
    below_target: { label: '↓ Below Target', color: C.red },
  }
  const t = map[trend] || { label: trend, color: C.muted }
  return <span style={{ fontSize: 10, fontWeight: 600, color: t.color }}>{t.label}</span>
}

/* ── Section header ─────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid rgba(0,212,170,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 18, height: 18, color: C.accent }} />
      </div>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{subtitle}</p>}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════ */
export default function AIAdvancedPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const qc = useQueryClient()

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview',   icon: Brain },
    { id: 'yield',    label: 'Yield',      icon: TrendingUp },
    { id: 'anomaly',  label: 'Anomalies',  icon: AlertTriangle },
    { id: 'nutrient', label: 'Nutrients',  icon: Droplets },
    { id: 'energy',   label: 'Energy',     icon: Zap },
    { id: 'harvest',  label: 'Harvest',    icon: Calendar },
    { id: 'vision',   label: 'Vision',     icon: Eye },
    { id: 'models',   label: 'AI Models',  icon: Shield },
  ]

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,rgba(0,212,170,0.2),rgba(139,92,246,0.2))', border: '1px solid rgba(0,212,170,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Brain style={{ width: 22, height: 22, color: C.accent }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Advanced AI Intelligence</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Phase 3 · Predictive analytics, anomaly detection, and optimisation</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, boxShadow: `0 0 6px ${C.accent}` }} />
          <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>AI ONLINE · v3.0</span>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid rgba(148,163,184,0.1)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
              color: tab === t.id ? C.accent : C.muted,
              fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
              transition: 'all 0.15s',
            }}>
            <t.icon style={{ width: 13, height: 13 }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'yield'    && <YieldTab />}
      {tab === 'anomaly'  && <AnomalyTab qc={qc} />}
      {tab === 'nutrient' && <NutrientTab />}
      {tab === 'energy'   && <EnergyTab />}
      {tab === 'harvest'  && <HarvestTab />}
      {tab === 'vision'   && <VisionTab />}
      {tab === 'models'   && <ModelsTab />}
    </div>
  )
}

/* ── Overview Tab ───────────────────────────────────────── */
function OverviewTab() {
  const { data: forecastRaw } = useQuery({ queryKey: ['p3-yield-forecast'], queryFn: () => phase3AiApi.yieldForecast({ days_ahead: 7 }), retry:1 })
  const { data: anomaliesRaw } = useQuery({ queryKey: ['p3-anomalies'], queryFn: () => phase3AiApi.anomalies({ resolved: false }), retry:1 })
  const { data: energyRaw } = useQuery({ queryKey: ['p3-energy'], queryFn: () => phase3AiApi.energyOptimize(), retry:1 })
  const { data: harvestRaw } = useQuery({ queryKey: ['p3-harvest'], queryFn: () => phase3AiApi.harvestSchedule(), retry:1 })
  const forecast  = (forecastRaw  && (forecastRaw as any).total_forecast_kg) ? forecastRaw  : DEMO_FORECAST
  const anomalies = (anomaliesRaw && (anomaliesRaw as any[]).length)          ? anomaliesRaw : DEMO_ANOMALIES
  const energy    = (energyRaw    && (energyRaw as any).savings_per_day_inr)  ? energyRaw    : DEMO_ENERGY
  const harvest   = (harvestRaw   && (harvestRaw as any[]).length)            ? harvestRaw   : DEMO_HARVEST

  const criticalAnoms = (anomalies || []).filter((a: any) => a.severity === 'critical').length
  const urgentHarvests = (harvest || []).filter((h: any) => h.urgency === 'ready_now' || h.urgency === 'this_week').length

  const OVERVIEW_CARDS = [
    { label: '7-Day Yield Forecast', value: forecast ? `${forecast.total_forecast_kg?.toFixed(1)}t` : '—', sub: `${forecast?.confidence_pct?.toFixed(1) || '—'}% confidence`, icon: TrendingUp, color: C.accent },
    { label: 'Active Anomalies', value: String((anomalies || []).length), sub: `${criticalAnoms} critical`, icon: AlertTriangle, color: criticalAnoms > 0 ? C.red : C.amber },
    { label: 'Daily Energy Savings', value: energy ? `₹${energy.savings_per_day_inr?.toFixed(0)}` : '—', sub: `${energy?.savings_pct?.toFixed(1) || '—'}% optimised`, icon: Zap, color: C.blue },
    { label: 'Harvest Windows', value: String(urgentHarvests), sub: 'Ready this week', icon: Calendar, color: C.purple },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {OVERVIEW_CARDS.map(c => (
          <div key={c.label} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <c.icon style={{ width: 16, height: 16, color: c.color }} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{c.sub}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Yield daily series chart */}
      {forecast?.daily_series && (
        <div className="card p-4">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>7-Day Yield Forecast with Confidence Bands</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={forecast.daily_series} margin={{ top: 5, right: 15, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.accent} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} width={40} axisLine={false} tickLine={false} />
              <Tooltip {...TS} formatter={(v: any, n: string) => [`${v} kg`, n]} />
              <Area type="monotone" dataKey="upper" fill="transparent" stroke="rgba(0,212,170,0.15)" name="Upper bound" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="forecast_kg" fill="url(#yieldGrad)" stroke={C.accent} strokeWidth={2} name="Forecast kg" dot={false} />
              <Area type="monotone" dataKey="lower" fill="transparent" stroke="rgba(0,212,170,0.15)" name="Lower bound" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top anomalies */}
      {(anomalies || []).length > 0 && (
        <div className="card p-4">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Recent Anomalies (Isolation Forest)</h3>
          <div className="space-y-2">
            {(anomalies || []).slice(0, 4).map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <SevBadge sev={a.severity} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.description}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{a.zone_name} · {a.sensor_type} · score {a.anomaly_score?.toFixed(2)}</div>
                </div>
                <span style={{ fontSize: 11, color: C.muted }}>{new Date(a.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Yield Tab ──────────────────────────────────────────── */
function YieldTab() {
  const [days, setDays] = useState(7)
  const { data: yieldRaw, isLoading } = useQuery({
    queryKey: ['p3-yield-detail', days],
    queryFn: () => phase3AiApi.yieldForecast({ days_ahead: days }),
    retry: 1,
  })
  const data: any = (yieldRaw && (yieldRaw as any).total_forecast_kg) ? yieldRaw : DEMO_FORECAST

  return (
    <div className="space-y-5">
      <SectionHeader icon={TrendingUp} title="Yield Prediction Engine" subtitle="Time-series forecasting with confidence intervals per zone" />
      <div className="flex items-center gap-3 mb-2">
        <span style={{ fontSize: 12, color: C.muted }}>Forecast horizon:</span>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${days === d ? C.accent : 'rgba(148,163,184,0.2)'}`, background: days === d ? 'rgba(0,212,170,0.1)' : 'transparent', color: days === d ? C.accent : C.muted }}>
            {d}d
          </button>
        ))}
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Running prediction model…</div>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 col-span-1">
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Total {days}-day forecast</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.accent }}>{data.total_forecast_kg?.toFixed(1)}<span style={{ fontSize: 14, marginLeft: 4 }}>kg</span></div>
              <div style={{ fontSize: 11, color: C.muted }}>Target: {data.total_target_kg?.toFixed(1)} kg</div>
              <div style={{ marginTop: 8, padding: '6px 12px', background: 'rgba(0,212,170,0.08)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{data.confidence_pct?.toFixed(1)}% confidence · {data.model_version}</span>
              </div>
            </div>
            <div className="card p-4 col-span-2">
              <h4 style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 12 }}>Daily forecast series</h4>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={data.daily_series || []} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="yfg2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C.accent} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: C.muted }} width={35} axisLine={false} tickLine={false} />
                  <Tooltip {...TS} />
                  <Area type="monotone" dataKey="forecast_kg" fill="url(#yfg2)" stroke={C.accent} strokeWidth={2} name="kg" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4">
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Per-Zone Forecast</h4>
            <div className="space-y-3">
              {(data.zones || []).map((z: any) => (
                <div key={z.zone_id} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
                  <div style={{ minWidth: 120 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{z.zone_name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{z.crop}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="flex justify-between mb-1">
                      <span style={{ fontSize: 11, color: C.muted }}>{z.forecast_kg} kg / {z.target_kg} kg</span>
                      <TrendChip trend={z.trend} />
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(148,163,184,0.1)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(z.forecast_kg / z.target_kg * 100, 100)}%`, background: z.trend === 'below_target' ? C.red : C.accent, borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{z.confidence_pct}%</div>
                    <div style={{ fontSize: 10, color: C.muted }}>confidence</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, maxWidth: 200 }}>{z.recommendation}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Anomaly Tab ────────────────────────────────────────── */
function AnomalyTab({ qc }: { qc: any }) {
  const [showResolved, setShowResolved] = useState(false)
  const { data: anomRaw } = useQuery({
    queryKey: ['p3-anomalies-tab', showResolved],
    queryFn: () => phase3AiApi.anomalies({ resolved: showResolved }),
    retry: 1,
    refetchInterval: 30000,
  })
  const resolveMut = useMutation({
    mutationFn: (id: string) => phase3AiApi.resolveAnomaly(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['p3-anomalies-tab'] }); toast.success('Anomaly resolved') },
  })

  const data: any[] = (anomRaw && (anomRaw as any[]).length)
    ? (anomRaw as any[]).filter((a: any) => showResolved ? true : !a.is_resolved)
    : DEMO_ANOMALIES.filter((a: any) => showResolved ? true : !a.is_resolved)

  const bySev = {
    critical: data.filter((a: any) => a.severity === 'critical').length,
    warning:  data.filter((a: any) => a.severity === 'warning').length,
    info:     data.filter((a: any) => a.severity === 'info').length,
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={AlertTriangle} title="Anomaly Detection" subtitle="Isolation Forest on sensor streams — flags unusual patterns before they become alerts" />
      <div className="grid grid-cols-3 gap-4">
        {[{ k: 'critical', label: 'Critical', color: C.red }, { k: 'warning', label: 'Warning', color: C.amber }, { k: 'info', label: 'Info', color: C.blue }].map(s => (
          <div key={s.k} className="card p-4 flex items-center gap-3">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: s.color }}>
              {(bySev as any)[s.k]}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.label} Anomalies</div>
              <div style={{ fontSize: 11, color: C.muted }}>Isolation Forest score &gt; 0.7</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Detected Anomalies</h4>
          <button onClick={() => setShowResolved(v => !v)}
            style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: showResolved ? 'rgba(0,212,170,0.1)' : 'transparent', color: showResolved ? C.accent : C.muted, cursor: 'pointer' }}>
            {showResolved ? 'Showing Resolved' : 'Show Resolved'}
          </button>
        </div>
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: C.muted }}>
            <CheckCircle style={{ width: 32, height: 32, color: C.accent, marginBottom: 8 }} />
            <p style={{ fontSize: 13 }}>No anomalies detected — all sensors within expected range.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${a.severity === 'critical' ? 'rgba(255,77,109,0.2)' : 'rgba(148,163,184,0.08)'}` }}>
                <SevBadge sev={a.severity} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.description}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    <span style={{ marginRight: 12 }}>{a.zone_name} · {a.farm_name}</span>
                    <span style={{ marginRight: 12 }}>Sensor: <b style={{ color: 'var(--text)' }}>{a.sensor_type}</b></span>
                    <span>Value: <b style={{ color: C.amber }}>{a.detected_value}</b> (expected {a.expected_range?.min}–{a.expected_range?.max})</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Anomaly score: {a.anomaly_score?.toFixed(3)} · {new Date(a.created_at).toLocaleString()}</div>
                </div>
                {!a.is_resolved && (
                  <button onClick={() => resolveMut.mutate(a.id)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid rgba(0,212,170,0.3)`, background: 'rgba(0,212,170,0.08)', color: C.accent, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Nutrient Tab ───────────────────────────────────────── */
function NutrientTab() {
  const [stage, setStage] = useState('vegetative')
  const [readings, setReadings] = useState({ ec_mscm: 2.1, ph: 6.1, nitrogen_ppm: 150, phosphorus_ppm: 55, potassium_ppm: 180 })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const STAGES = ['seeding', 'germination', 'vegetative', 'flowering', 'fruiting', 'ready']

  const run = async () => {
    setLoading(true)
    try {
      const data = await phase3AiApi.nutrientOptimize(readings, { crop_stage: stage })
      setResult(data)
    } catch { toast.error('Failed to run optimisation') }
    finally { setLoading(false) }
  }

  const ADJ_COLOR = { increase: C.accent, decrease: C.amber, maintain: C.blue }

  return (
    <div className="space-y-5">
      <SectionHeader icon={Droplets} title="Nutrient Optimisation" subtitle="EC/pH recommendations based on crop stage, current readings, and target yield" />
      <div className="grid grid-cols-2 gap-5">
        {/* Input form */}
        <div className="card p-5">
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Current Readings</h4>
          <div className="space-y-4">
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6 }}>Crop Stage</label>
              <div className="flex flex-wrap gap-2">
                {STAGES.map(s => (
                  <button key={s} onClick={() => setStage(s)}
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${stage === s ? C.accent : 'rgba(148,163,184,0.2)'}`, background: stage === s ? 'rgba(0,212,170,0.1)' : 'transparent', color: stage === s ? C.accent : C.muted, textTransform: 'capitalize' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {[
              { key: 'ec_mscm', label: 'EC', unit: 'mS/cm', min: 0, max: 4, step: 0.1 },
              { key: 'ph', label: 'pH', unit: '', min: 4, max: 8, step: 0.1 },
              { key: 'nitrogen_ppm', label: 'Nitrogen (N)', unit: 'ppm', min: 0, max: 300, step: 5 },
              { key: 'phosphorus_ppm', label: 'Phosphorus (P)', unit: 'ppm', min: 0, max: 200, step: 5 },
              { key: 'potassium_ppm', label: 'Potassium (K)', unit: 'ppm', min: 0, max: 500, step: 5 },
            ].map(f => (
              <div key={f.key}>
                <div className="flex justify-between mb-1">
                  <label style={{ fontSize: 11, color: C.muted }}>{f.label}</label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{(readings as any)[f.key]} {f.unit}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step}
                  value={(readings as any)[f.key]}
                  onChange={e => setReadings(r => ({ ...r, [f.key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%', accentColor: C.accent }} />
              </div>
            ))}
            <button onClick={run} disabled={loading}
              style={{ width: '100%', padding: '10px', borderRadius: 8, background: loading ? 'rgba(0,212,170,0.3)' : 'rgba(0,212,170,0.15)', border: `1px solid rgba(0,212,170,0.4)`, color: C.accent, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              {loading ? 'Optimising…' : '⚡ Run Nutrient Optimisation'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="card p-5">
          {!result ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
              <Brain style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>Configure readings and run optimisation</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Recommendations</h4>
                <div style={{ padding: '4px 12px', background: 'rgba(0,212,170,0.1)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: C.accent }}>
                  +{result.overall_expected_improvement_pct}% yield improvement
                </div>
              </div>
              <div className="space-y-3">
                {(result.recommendations || []).map((rec: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{rec.nutrient}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={rec.priority === 'high' ? 'red' : rec.priority === 'medium' ? 'amber' : 'green'}>{rec.priority}</Badge>
                        <span style={{ fontSize: 11, fontWeight: 700, color: (ADJ_COLOR as any)[rec.adjustment] || C.muted, textTransform: 'uppercase' }}>{rec.adjustment}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{rec.current_value} → <b style={{ color: C.accent }}>{rec.recommended_value} {rec.unit}</b> · +{rec.expected_yield_improvement_pct}% yield</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{rec.rationale}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: '10px', background: 'rgba(59,130,246,0.08)', borderRadius: 8, fontSize: 11, color: '#93c5fd' }}>
                <Info style={{ display: 'inline', width: 12, height: 12, marginRight: 4 }} />
                {result.recipe_adjustments}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Energy Tab ─────────────────────────────────────────── */
function EnergyTab() {
  const { data: energyRaw2, isLoading } = useQuery({ queryKey: ['p3-energy-tab'], queryFn: () => phase3AiApi.energyOptimize(), retry:1 })
  const data: any = (energyRaw2 && (energyRaw2 as any).savings_per_day_inr) ? energyRaw2 : DEMO_ENERGY

  const breakdown = data?.breakdown || DEMO_ENERGY.breakdown
  const PIE_COLORS = [C.accent, C.blue, C.purple, C.amber, C.muted]

  return (
    <div className="space-y-5">
      <SectionHeader icon={Zap} title="Energy Optimisation" subtitle="Time-of-use tariff scheduling — shift devices to off-peak windows" />
      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Calculating optimisation…</div>}
      {data && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Current Daily Cost', value: `₹${data.current_daily_cost_inr?.toFixed(0)}`, color: C.red },
              { label: 'Optimised Cost', value: `₹${data.optimized_daily_cost_inr?.toFixed(0)}`, color: C.accent },
              { label: 'Daily Saving', value: `₹${data.savings_per_day_inr?.toFixed(0)}`, color: C.accent },
              { label: 'Monthly Saving', value: `₹${(data.savings_per_month_inr || 0).toLocaleString()}`, color: C.blue },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="card p-4">
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Device Power Breakdown</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={breakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                    {breakdown.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TS} formatter={(v: any, n: string) => [`${v}%`, n]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: C.muted }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-4">
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>AI Recommendations</h4>
              <div className="space-y-3">
                {(data.recommendations || []).map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.1)' }}>
                    <Zap style={{ width: 14, height: 14, color: C.accent, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{r}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,181,71,0.08)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>Peak hours (expensive): {(data.peak_hours || []).join(', ')}:00</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Off-peak rate: ₹6.5/kWh · Peak rate: ₹12/kWh</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Harvest Tab ────────────────────────────────────────── */
function HarvestTab() {
  const { data: harvestRaw2, isLoading } = useQuery({ queryKey: ['p3-harvest-tab'], queryFn: () => phase3AiApi.harvestSchedule(), retry:1 })
  const data: any[] = (harvestRaw2 && (harvestRaw2 as any[]).length) ? harvestRaw2 as any[] : DEMO_HARVEST

  const URGENCY_COLOR: Record<string, string> = { ready_now: C.red, this_week: C.amber, next_week: C.accent, upcoming: C.blue }
  const URGENCY_LABEL: Record<string, string> = { ready_now: '🚨 Ready Now', this_week: '📅 This Week', next_week: '🗓 Next Week', upcoming: '⏰ Upcoming' }

  return (
    <div className="space-y-5">
      <SectionHeader icon={Calendar} title="Harvest Scheduler" subtitle="Optimal harvest windows (3-day window with confidence %) per batch" />
      {isLoading && <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Predicting harvest windows…</div>}
      <div className="grid grid-cols-2 gap-4">
        {(data as any[]).map((w: any) => (
          <div key={w.id} className="card p-4" style={{ borderLeft: `3px solid ${URGENCY_COLOR[w.urgency] || C.muted}` }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{w.crop_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{w.zone_name}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${URGENCY_COLOR[w.urgency]}18`, color: URGENCY_COLOR[w.urgency] }}>
                {URGENCY_LABEL[w.urgency] || w.urgency}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{w.days_until_optimal}</div>
                <div style={{ fontSize: 10, color: C.muted }}>days until optimal</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{w.confidence_pct}%</div>
                <div style={{ fontSize: 10, color: C.muted }}>confidence</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{w.predicted_yield_kg}kg</div>
                <div style={{ fontSize: 10, color: C.muted }}>predicted yield</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
              Window: {new Date(w.window_start).toLocaleDateString()} – {new Date(w.window_end).toLocaleDateString()} · Optimal: <b style={{ color: C.accent }}>{new Date(w.optimal_day).toLocaleDateString()}</b>
            </div>
            <div className="space-y-1">
              {(w.factors || []).map((f: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
                  <CheckCircle style={{ width: 10, height: 10, color: C.accent, flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Vision Tab ─────────────────────────────────────────── */
function BBoxOverlay({ scanId }: { scanId: string }) {
  const boxes = SCAN_BBOXES[scanId] || []
  if (!boxes.length) return null
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' }}
    >
      {boxes.map((b, i) => {
        const labelBelow = b.y < 12
        const tagH = 5.5
        const tagW = Math.min(b.w + 4, b.label.length * 2.2 + 12)
        const tagX = b.x
        const tagY = labelBelow ? b.y + b.h + 0.5 : b.y - tagH
        const textY = labelBelow ? tagY + tagH - 1.2 : tagY + tagH - 1.2
        const cw = b.w * 0.28  // corner width
        const ch = b.h * 0.28  // corner height
        return (
          <g key={i}>
            {/* Main detection box */}
            <rect
              x={b.x} y={b.y}
              width={b.w} height={b.h}
              fill="none"
              stroke={b.color}
              strokeWidth={1.2}
              rx={0.8}
              opacity={0.7}
            />
            {/* ── Corner bracket: Top-Left ── */}
            <line x1={b.x}      y1={b.y + ch} x2={b.x}      y2={b.y}      stroke={b.color} strokeWidth={2.5} strokeLinecap="round"/>
            <line x1={b.x}      y1={b.y}      x2={b.x + cw} y2={b.y}      stroke={b.color} strokeWidth={2.5} strokeLinecap="round"/>
            {/* ── Corner bracket: Top-Right ── */}
            <line x1={b.x+b.w-cw} y1={b.y}      x2={b.x+b.w} y2={b.y}      stroke={b.color} strokeWidth={2.5} strokeLinecap="round"/>
            <line x1={b.x+b.w}   y1={b.y}      x2={b.x+b.w} y2={b.y + ch} stroke={b.color} strokeWidth={2.5} strokeLinecap="round"/>
            {/* ── Corner bracket: Bottom-Left ── */}
            <line x1={b.x}      y1={b.y+b.h-ch} x2={b.x}      y2={b.y+b.h} stroke={b.color} strokeWidth={2.5} strokeLinecap="round"/>
            <line x1={b.x}      y1={b.y+b.h}    x2={b.x + cw} y2={b.y+b.h} stroke={b.color} strokeWidth={2.5} strokeLinecap="round"/>
            {/* ── Corner bracket: Bottom-Right ── */}
            <line x1={b.x+b.w-cw} y1={b.y+b.h} x2={b.x+b.w}   y2={b.y+b.h}    stroke={b.color} strokeWidth={2.5} strokeLinecap="round"/>
            <line x1={b.x+b.w}   y1={b.y+b.h-ch} x2={b.x+b.w} y2={b.y+b.h}   stroke={b.color} strokeWidth={2.5} strokeLinecap="round"/>
            {/* ── Label tag ── */}
            <rect
              x={tagX} y={tagY}
              width={tagW} height={tagH}
              fill={b.color} rx={0.8}
              fillOpacity={0.92}
            />
            <text
              x={tagX + 1.3}
              y={textY}
              fontSize={3.4}
              fill="white"
              fontWeight="700"
              fontFamily="monospace"
            >
              {b.label} {Math.round(b.conf * 100)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}


function guessCropFromZone(zoneName?: string): string {
  if (!zoneName) return 'Unknown'
  const z = zoneName.toUpperCase()
  if (z.includes('A1')) return 'Butterhead Lettuce'
  if (z.includes('A2')) return 'Spinach'
  if (z.includes('A3')) return 'Basil'
  if (z.includes('B1')) return 'Arugula'
  if (z.includes('B2')) return 'Chard'
  if (z.includes('C2')) return 'Cherry Tomato'
  if (z.includes('C3')) return 'Strawberry'
  if (z.includes('D1')) return 'Microgreens'
  return 'Crop'
}

function VisionTab() {
  const [scanType,    setScanType]    = useState<string | undefined>(undefined)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [imgErrors,   setImgErrors]   = useState<Record<string, boolean>>({})

  const { data: cvRaw } = useQuery({
    queryKey: ['p3-cv-vision', scanType],
    queryFn:  () => phase3AiApi.cvScans({ scan_type: scanType }),
    retry: 1,
  })

  // normalise: API response may lack crop_name / severity / recommendation
  const normaliseCV = (s: any): any => ({
    ...s,
    id:             s.id || 'cv1',
    crop_name:      s.crop_name || guessCropFromZone(s.zone_name),
    severity:       s.severity || (s.disease_risk_pct > 20 ? 'warning' : 'info'),
    recommendation: s.recommendation || '',
    growth_stage:   s.growth_stage || '',
    plant_count:    s.plant_count || null,
    model_version:  s.model_version ? s.model_version.replace('cv-','').replace('-yolov8','') + ' YOLOv8' : 'YOLOv8-v1.8',
  })

  const raw: any[] = (cvRaw && (cvRaw as any[]).length) ? cvRaw as any[] : DEMO_CV_SCANS
  const allScans   = raw.map(normaliseCV)
  const scans: any[] = scanType ? allScans.filter(s => s.scan_type === scanType) : allScans

  const selectedScan = selectedId ? allScans.find((s: any) => s.id === selectedId) : null

  const RISK_COLOR  = (pct: number) => pct > 40 ? C.red : pct > 20 ? C.amber : C.accent
  const SEV_ICON: Record<string, string> = { warning:'⚠️', info:'✅', critical:'🚨' }
  const SCAN_TYPE_LABEL: Record<string, string> = { disease:'🦠 Disease', growth:'🌱 Growth', harvest:'✂️ Harvest' }

  const STAGE_COLORS: Record<string, string> = {
    'Seedling':     '#10b981',
    'Vegetative':   '#3b82f6',
    'Late Vegetative': '#0d9488',
    'Mid Vegetative':  '#0891b2',
    'Fruiting':     '#f59e0b',
    'Cotyledon':    '#8b5cf6',
    'default':      '#64748b',
  }
  const stageColor = (stage: string) => {
    const key = Object.keys(STAGE_COLORS).find(k => stage?.includes(k))
    return key ? STAGE_COLORS[key] : STAGE_COLORS.default
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={Eye} title="Computer Vision — VisionAI"
        subtitle="YOLOv8 real-time analysis · crop health, growth stage, disease detection" />

      {/* Summary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Zones Scanned',  value: allScans.length,                                         color:'text-[var(--accent)]' },
          { label:'Disease Alerts', value: allScans.filter((s:any)=>s.severity==='warning'||s.disease_risk_pct>20).length, color:'text-amber-500' },
          { label:'Harvest Ready',  value: allScans.filter((s:any)=>s.scan_type==='harvest').length, color:'text-purple-500' },
          { label:'Avg Canopy',     value: `${Math.round(allScans.reduce((a:number,s:any)=>a+(s.canopy_coverage_pct||0),0)/Math.max(allScans.length,1))}%`, color:'text-[var(--accent)]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-3">
            <div className="text-xs text-muted mb-1">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter + count bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { v: undefined,  label: 'All Scans' },
          { v: 'disease',  label: '🦠 Disease' },
          { v: 'growth',   label: '🌱 Growth' },
          { v: 'harvest',  label: '✂️ Harvest Ready' },
        ].map(f => (
          <button key={String(f.v)} onClick={() => setScanType(f.v)}
            style={{
              fontSize: 11, padding: '5px 16px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${scanType === f.v ? C.accent : 'rgba(148,163,184,0.2)'}`,
              background: scanType === f.v ? 'rgba(0,212,170,0.1)' : 'transparent',
              color: scanType === f.v ? C.accent : C.muted,
            }}>
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:11, color:C.muted }}>
          {scans.length} zone scan{scans.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Detail lightbox */}
      {selectedScan && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:999, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:24,
        }} onClick={() => setSelectedId(null)}>
          <div style={{
            background:'var(--card)', borderRadius:16, maxWidth:760, width:'100%',
            maxHeight:'90vh', overflow:'auto', boxShadow:'0 25px 60px rgba(0,0,0,0.4)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ position:'relative', height:340, overflow:'hidden', lineHeight:0 }}>
              {!imgErrors[selectedScan.id] ? (
                <img
                  src={getCropImage(selectedScan.crop_name)}
                  alt={selectedScan.crop_name}
                  style={{ width:'100%', height:340, objectFit:'cover', borderRadius:'16px 16px 0 0', display:'block', verticalAlign:'top' }}
                  onError={() => setImgErrors(e => ({...e, [selectedScan.id]: true}))}
                />
              ) : (
                <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,rgba(13,148,136,0.2),rgba(59,130,246,0.1))', borderRadius:'16px 16px 0 0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Eye style={{ width:60, height:60, color:`${C.accent}44` }} />
                </div>
              )}
              <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:'16px 16px 0 0' }}>
                <BBoxOverlay scanId={selectedScan.id} />
              </div>
              {/* Overlays */}
              <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:8 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:20, background:'rgba(0,0,0,0.6)', color:C.accent }}>
                  {(selectedScan.scan_type||'').toUpperCase()} · {selectedScan.model_version}
                </span>
                <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:20,
                  background: selectedScan.severity==='warning' ? 'rgba(245,158,11,0.8)' : 'rgba(16,185,129,0.7)', color:'white' }}>
                  {SEV_ICON[selectedScan.severity]} {selectedScan.severity?.toUpperCase()}
                </span>
              </div>
              <div style={{ position:'absolute', top:12, right:12 }}>
                <button onClick={() => setSelectedId(null)}
                  style={{ width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.6)', border:'none', color:'white', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  ✕
                </button>
              </div>
              <div style={{ position:'absolute', bottom:12, left:12 }}>
                <span style={{ fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20, background:'rgba(0,0,0,0.65)', color:'white' }}>
                  {selectedScan.crop_name} · {selectedScan.zone_name}
                </span>
              </div>
            </div>
            <div style={{ padding:20 }}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label:'Canopy', value:`${selectedScan.canopy_coverage_pct}%`, color:C.accent },
                  { label:'Growth Index', value:`${selectedScan.growth_rate_index}/10`, color:C.blue },
                  { label:'Disease Risk', value:`${selectedScan.disease_risk_pct}%`, color:RISK_COLOR(selectedScan.disease_risk_pct) },
                  { label:'Plants', value:selectedScan.plant_count, color:'var(--text)' },
                  { label:'Confidence', value:`${Math.round(selectedScan.confidence*100)}%`, color:C.accent },
                  { label:'Stage', value:selectedScan.growth_stage?.split('—')[0]?.trim(), color:stageColor(selectedScan.growth_stage||'') },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding:'10px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--border)', textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:800, color }}>{value}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{label}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12, color:'var(--text2)', marginBottom:10, lineHeight:1.6 }}>{selectedScan.summary}</p>
              {selectedScan.recommendation && (
                <div style={{ padding:'10px 14px', borderRadius:8, background:`${C.accent}0d`, border:`1px solid ${C.accent}22`, fontSize:12, color:C.accent, marginBottom:12 }}>
                  <b>Recommendation:</b> {selectedScan.recommendation}
                </div>
              )}
              <div className="space-y-1">
                {(selectedScan.detections||[]).map((d: any, i: number) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', borderRadius:7, background:'var(--bg3)' }}>
                    <span style={{ fontSize:11, color:'var(--text2)' }}>{d.label}</span>
                    <span style={{ fontSize:11, color:C.muted }}>{Math.round(d.confidence*100)}% conf · {d.area_pct}% of frame</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scan grid */}
      {scans.length === 0 ? (
        <div className="card p-10 text-center">
          <Eye style={{ width:40, height:40, color:C.muted, margin:'0 auto 12px' }} />
          <p style={{ fontSize:13, color:C.muted }}>No CV scans match the current filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scans.map((s: any) => {
            const risk   = s.disease_risk_pct ?? Math.round((1 - s.confidence) * 40)
            const canopy = s.canopy_coverage_pct ?? Math.round(s.confidence * 95)
            const growth = s.growth_rate_index  ?? Math.round(s.confidence * 10 * 10) / 10
            const scanTime = s.created_at || s.scanned_at
            const imgSrc = getCropImage(s.crop_name)
            const hasErr = imgErrors[s.id]

            return (
              <div key={s.id}
                className="card overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
                style={{ border: s.severity==='warning' ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border)' }}
                onClick={() => setSelectedId(s.id)}>

                {/* ── Plant photo with YOLO overlay ── */}
                <div style={{ position:'relative', height:180, overflow:'hidden', display:'block', lineHeight:0 }}>
                  {!hasErr ? (
                    <img
                      src={imgSrc}
                      alt={s.crop_name}
                      referrerPolicy="no-referrer"
                      style={{ width:'100%', height:180, objectFit:'cover', display:'block', verticalAlign:'top' }}
                      onError={() => setImgErrors(e => ({...e, [s.id]: true}))}
                    />
                  ) : (
                    <div style={{
                      width:'100%', height:'100%',
                      background: s.scan_type==='disease'
                        ? 'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(245,158,11,0.08))'
                        : s.scan_type==='harvest'
                        ? 'linear-gradient(135deg,rgba(139,92,246,0.1),rgba(59,130,246,0.08))'
                        : 'linear-gradient(135deg,rgba(13,148,136,0.12),rgba(16,185,129,0.07))',
                      display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' as const, gap:6,
                    }}>
                      <Eye style={{ width:36, height:36, color:`${C.accent}55` }} />
                      <span style={{ fontSize:11, color:`${C.accent}88`, fontWeight:600 }}>{s.crop_name || 'Plant'}</span>
                    </div>
                  )}

                  {/* YOLO bounding boxes */}
                  <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, pointerEvents:'none' }}>
                    <BBoxOverlay scanId={s.id} />
                  </div>

                  {/* Scan-type badge top-left */}
                  <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:6 }}>
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:12, background:'rgba(0,0,0,0.55)', color:C.accent, backdropFilter:'blur(4px)' }}>
                      {(s.scan_type||'').toUpperCase()}
                    </span>
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:12, background:'rgba(0,0,0,0.55)', color:'rgba(255,255,255,0.8)', backdropFilter:'blur(4px)' }}>
                      {s.model_version}
                    </span>
                  </div>

                  {/* Severity badge top-right */}
                  <div style={{ position:'absolute', top:8, right:8 }}>
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 9px', borderRadius:12,
                      background: s.severity==='warning' ? 'rgba(245,158,11,0.85)' : 'rgba(16,185,129,0.8)',
                      color:'white', backdropFilter:'blur(4px)' }}>
                      {SEV_ICON[s.severity]} {s.severity?.toUpperCase() || 'CLEAR'}
                    </span>
                  </div>

                  {/* Crop + zone nameplate */}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'20px 10px 8px', background:'linear-gradient(transparent,rgba(0,0,0,0.7))' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'white' }}>{s.crop_name}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>{s.zone_name}</div>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding:'12px 14px 14px' }}>
                  {/* Growth stage pill */}
                  {s.growth_stage && (
                    <div style={{ marginBottom:10 }}>
                      <span style={{ fontSize:10, fontWeight:600, padding:'2px 10px', borderRadius:20,
                        background:`${stageColor(s.growth_stage)}18`,
                        color:stageColor(s.growth_stage),
                        border:`1px solid ${stageColor(s.growth_stage)}30` }}>
                        🌿 {s.growth_stage}
                      </span>
                    </div>
                  )}

                  {/* Metrics row */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {[
                      { label:'Canopy',  value:`${canopy}%`,   color:C.accent },
                      { label:'Growth',  value:`${growth}/10`, color:C.blue },
                      { label:'Disease', value:`${risk}%`,     color:RISK_COLOR(risk) },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign:'center', padding:'6px 4px', borderRadius:8, background:'var(--bg3)', border:'1px solid var(--border)' }}>
                        <div style={{ fontSize:14, fontWeight:800, color, lineHeight:1 }}>{value}</div>
                        <div style={{ fontSize:9, color:C.muted, marginTop:2 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.5, marginBottom:8 }}>
                    {s.summary}
                  </div>

                  {/* Recommendation */}
                  {s.recommendation && (
                    <div style={{ fontSize:10, padding:'6px 9px', borderRadius:7, marginBottom:8,
                      background: s.severity==='warning' ? 'rgba(245,158,11,0.07)' : 'rgba(0,212,170,0.05)',
                      border: `1px solid ${s.severity==='warning' ? 'rgba(245,158,11,0.2)' : 'rgba(0,212,170,0.12)'}`,
                      color: s.severity==='warning' ? C.amber : C.accent }}>
                      → {s.recommendation}
                    </div>
                  )}

                  {/* Detection labels */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {(s.detections||[]).map((d: any, i: number) => (
                      <span key={i} style={{ fontSize:9, padding:'1px 7px', borderRadius:10,
                        background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)' }}>
                        {d.label} {Math.round(d.confidence*100)}%
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:9, color:C.muted }}>
                      {scanTime ? new Date(scanTime).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}
                    </span>
                    <span style={{ fontSize:10, color:C.accent, fontWeight:600 }}>
                      Tap to expand →
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Models Tab ─────────────────────────────────────────── */
function ModelsTab() {
  const { data: modelsRaw, refetch } = useQuery({ queryKey: ['p3-ai-models'], queryFn: () => phase3AiApi.models(), retry:1 })
  const data = (modelsRaw && (modelsRaw as any[]).length) ? modelsRaw : DEMO_MODELS
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ model_type: 'yield_prediction', version: '', accuracy: '', notes: '' })
  const qc = useQueryClient()

  const createMut = useMutation({
    mutationFn: (d: any) => phase3AiApi.createModel(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['p3-ai-models'] }); setShowCreate(false); toast.success('AI model registered') },
    onError: () => toast.error('Failed to register model'),
  })

  const MODEL_ICONS: Record<string, any> = {
    yield_prediction: TrendingUp, anomaly_detection: AlertTriangle,
    nutrient_optimizer: Droplets, energy_optimizer: Zap,
    harvest_scheduler: Calendar, computer_vision: Eye,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon={Shield} title="AI Model Registry" subtitle="Version tracking, accuracy metrics, and activation control" />
        <button onClick={() => setShowCreate(v => !v)}
          style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: C.accent, cursor: 'pointer', fontWeight: 600 }}>
          + Register Model
        </button>
      </div>

      {showCreate && (
        <div className="card p-5">
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Register New Model Version</h4>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'model_type', label: 'Model Type', type: 'select', options: ['yield_prediction','anomaly_detection','nutrient_optimizer','energy_optimizer','harvest_scheduler','computer_vision'] },
              { key: 'version', label: 'Version (semver)', type: 'text', placeholder: 'e.g. 3.1.0' },
              { key: 'accuracy', label: 'Accuracy (0–1)', type: 'number', placeholder: '0.94' },
              { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Brief description' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--text)', fontSize: 12 }}>
                    {f.options?.map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
                  </select>
                ) : (
                  <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.2)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createMut.mutate({ ...form, accuracy: form.accuracy ? parseFloat(form.accuracy) : undefined })}
              style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.3)', color: C.accent, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
              Register
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '8px 20px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', color: C.muted, cursor: 'pointer', fontSize: 12 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {(data as any[]).map((m: any) => {
          const Icon = MODEL_ICONS[m.model_type] || Brain
          return (
            <div key={m.id} className="card p-4" style={{ borderTop: `2px solid ${m.is_active ? C.accent : 'rgba(148,163,184,0.2)'}` }}>
              <div className="flex items-start justify-between mb-3">
                <div style={{ width: 34, height: 34, borderRadius: 9, background: m.is_active ? 'rgba(0,212,170,0.12)' : 'rgba(148,163,184,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 16, height: 16, color: m.is_active ? C.accent : C.muted }} />
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: m.is_active ? 'rgba(0,212,170,0.12)' : 'rgba(148,163,184,0.1)', color: m.is_active ? C.accent : C.muted }}>
                    {m.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{m.model_type?.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>v{m.version}</div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{m.accuracy ? `${(m.accuracy * 100).toFixed(1)}%` : '—'}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>Accuracy</div>
                </div>
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{m.trained_at ? new Date(m.trained_at).toLocaleDateString() : '—'}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>Trained</div>
                </div>
              </div>
              {m.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{m.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
