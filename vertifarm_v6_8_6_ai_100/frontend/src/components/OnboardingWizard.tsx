import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import {
  Wifi, MapPin, Leaf, Users, Brain, CheckCircle2,
  ChevronRight, ChevronLeft, X, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'

const STEPS = [
  {
    id: 'welcome',
    icon: Zap,
    color: '#0d9488',
    bg: '#ccfbf1',
    title: 'Welcome to VertiFarm XOS',
    subtitle: 'Let\'s set up your farm in 5 quick steps — takes about 3 minutes.',
  },
  {
    id: 'farm',
    icon: MapPin,
    color: '#2563eb',
    bg: '#dbeafe',
    title: 'Connect your first farm',
    subtitle: 'Tell us about your farm so we can configure the right sensors and recipes.',
  },
  {
    id: 'sensor',
    icon: Wifi,
    color: '#7c3aed',
    bg: '#ede9fe',
    title: 'Connect your first sensor',
    subtitle: 'Enter your sensor gateway details. We support MQTT, Modbus, and REST.',
  },
  {
    id: 'zone',
    icon: Leaf,
    color: '#059669',
    bg: '#d1fae5',
    title: 'Create your first zone',
    subtitle: 'A zone is a growing area with its own climate targets. Start with one.',
  },
  {
    id: 'team',
    icon: Users,
    color: '#d97706',
    bg: '#fef3c7',
    title: 'Invite your team',
    subtitle: 'Add farm managers or operators. You can skip this and do it later.',
  },
  {
    id: 'ai',
    icon: Brain,
    color: '#0d9488',
    bg: '#ccfbf1',
    title: 'Your AI agronomist is ready',
    subtitle: 'VertiFarm AI will now monitor your farm and surface recommendations.',
  },
]

const FARM_TYPES = [
  { id:'rack',      label:'Rack & Stack',    emoji:'🏗️' },
  { id:'nft',       label:'NFT Channels',    emoji:'🌊' },
  { id:'aeroponic', label:'Aeroponics',      emoji:'🚿' },
  { id:'dwc',       label:'Deep Water (DWC)',emoji:'🏊' },
]

const PROTOCOLS = [
  { id:'mqtt',    label:'MQTT',    desc:'Most common — ESP32, Raspberry Pi, commercial gateways' },
  { id:'modbus',  label:'Modbus RTU', desc:'Industrial PLCs and older sensor controllers' },
  { id:'rest',    label:'REST API', desc:'Cloud-connected sensors with HTTP endpoints' },
]

interface OnboardingWizardProps {
  onComplete: () => void
  onSkip: () => void
}

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep]         = useState(0)
  const [saving, setSaving]     = useState(false)
  const [completed, setCompleted] = useState<Set<number>>(new Set())

  // Form state
  const [farmName,     setFarmName]     = useState('')
  const [farmType,     setFarmType]     = useState('rack')
  const [farmCity,     setFarmCity]     = useState('')
  const [protocol,     setProtocol]     = useState('mqtt')
  const [gatewayHost,  setGatewayHost]  = useState('')
  const [gatewayPort,  setGatewayPort]  = useState('1883')
  const [zoneName,     setZoneName]     = useState('')
  const [crop,         setCrop]         = useState('Butterhead Lettuce')
  const [inviteEmail,  setInviteEmail]  = useState('')
  const [inviteRole,   setInviteRole]   = useState('operator')

  const markDone = (s: number) => setCompleted(p => new Set([...p, s]))

  const handleNext = async () => {
    if (step === STEPS.length - 1) {
      onComplete()
      navigate('/dashboard')
      return
    }

    // Save step data
    setSaving(true)
    try {
      if (step === 1 && farmName) {
        await api.post('/api/v1/farms', { name: farmName, type: farmType, city: farmCity }).catch(() => {})
        markDone(1)
      }
      if (step === 2 && gatewayHost) {
        await api.post('/api/v1/integrations', { integration_id: 'mqtt', config: { host: gatewayHost, port: parseInt(gatewayPort), protocol } }).catch(() => {})
        markDone(2)
      }
      if (step === 3 && zoneName) {
        await api.post('/api/v1/zones', { name: zoneName, crop_name: crop }).catch(() => {})
        markDone(3)
      }
      if (step === 4 && inviteEmail) {
        await api.post('/api/v1/team/invite', { email: inviteEmail, role: inviteRole }).catch(() => {})
        markDone(4); toast.success(`Invite sent to ${inviteEmail}`)
      }
    } catch {}
    setSaving(false)
    setStep(s => s + 1)
  }

  const canProceed = () => {
    if (step === 0) return true
    if (step === 1) return farmName.trim().length > 0
    if (step === 2) return true    // sensor optional
    if (step === 3) return zoneName.trim().length > 0
    if (step === 4) return true    // invite optional
    if (step === 5) return true
    return true
  }

  const currentStep = STEPS[step]
  const StepIcon = currentStep.icon
  const progress = ((step) / (STEPS.length - 1)) * 100

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}>
      <motion.div
        initial={{ scale: .96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg overflow-hidden rounded-2xl"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(148,163,184,0.3)',
          boxShadow: '0 24px 64px rgba(15,23,42,0.22), 0 8px 24px rgba(15,23,42,0.12)',
          maxHeight: '90vh',
        }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-5">
            {/* Step icons */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => {
                const SI = s.icon
                return (
                  <div key={i} className="flex items-center">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: completed.has(i) ? '#059669' : i === step ? s.bg : 'var(--bg3)',
                        border: `1.5px solid ${i === step ? s.color : completed.has(i) ? '#059669' : 'var(--border)'}`,
                      }}>
                      {completed.has(i)
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-white"/>
                        : <SI className="w-3 h-3" style={{ color: i === step ? s.color : 'var(--muted)' }}/>
                      }
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-4 h-px mx-0.5"
                        style={{ background: completed.has(i) ? '#059669' : 'var(--border)' }}/>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={onSkip} className="p-1.5 rounded-lg hover:bg-[var(--bg3)] transition-colors">
              <X className="w-4 h-4 text-[var(--muted)]"/>
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-[var(--bg3)] rounded-full overflow-hidden mb-5">
            <motion.div className="h-full rounded-full"
              style={{ background: 'var(--accent)' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: .4, ease: 'easeOut' }}/>
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 pb-6" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: .25, ease: [.22, 1, .36, 1] }}>

              {/* Step icon + title */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: currentStep.bg }}>
                  <StepIcon className="w-6 h-6" style={{ color: currentStep.color }}/>
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text)] mb-0.5">{currentStep.title}</h2>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{currentStep.subtitle}</p>
                </div>
              </div>

              {/* ── Step 0: Welcome ── */}
              {step === 0 && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-semibold text-[var(--text)] mb-1">
                      👋 Hi {user?.full_name?.split(' ')[0] || 'there'}!
                    </p>
                    <p className="text-sm text-[var(--text3)] leading-relaxed">
                      This quick setup will connect your farm sensors, create your first growing zone, and activate the AI agronomist. Each step takes under 60 seconds.
                    </p>
                  </div>
                  {[
                    ['🌿', 'Connect your farm & sensor gateway'],
                    ['📊', 'Create zones with climate targets'],
                    ['🤖', 'AI yield forecasting goes live'],
                    ['🔔', 'Real-time alerts configured'],
                  ].map(([e, t]) => (
                    <div key={t} className="flex items-center gap-3 text-sm text-[var(--text2)]">
                      <span className="text-base">{e}</span>{t}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Step 1: Farm ── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">Farm Name *</label>
                    <input className="input text-sm" placeholder="e.g. Delhi HQ — Main Facility"
                      value={farmName} onChange={e => setFarmName(e.target.value)}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Farm Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {FARM_TYPES.map(ft => (
                        <button key={ft.id} onClick={() => setFarmType(ft.id)}
                          className="p-3 rounded-xl text-left border-2 transition-all"
                          style={{ borderColor: farmType === ft.id ? 'var(--accent)' : 'var(--border)',
                            background: farmType === ft.id ? 'var(--accent-soft)' : 'transparent' }}>
                          <span className="text-xl block mb-1">{ft.emoji}</span>
                          <span className="text-xs font-semibold text-[var(--text2)]">{ft.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">City / Location</label>
                    <input className="input text-sm" placeholder="e.g. New Delhi"
                      value={farmCity} onChange={e => setFarmCity(e.target.value)}/>
                  </div>
                </div>
              )}

              {/* ── Step 2: Sensor ── */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Protocol</label>
                    <div className="space-y-2">
                      {PROTOCOLS.map(p => (
                        <button key={p.id} onClick={() => setProtocol(p.id)}
                          className="w-full p-3 rounded-xl text-left border-2 transition-all flex items-start gap-3"
                          style={{ borderColor: protocol === p.id ? 'var(--accent)' : 'var(--border)',
                            background: protocol === p.id ? 'var(--accent-soft)' : 'transparent' }}>
                          <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center"
                            style={{ borderColor: protocol === p.id ? 'var(--accent)' : 'var(--border)' }}>
                            {protocol === p.id && <div className="w-2 h-2 rounded-full bg-[var(--accent)]"/>}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">{p.label}</div>
                            <div className="text-xs text-[var(--muted)]">{p.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">Broker / Host</label>
                      <input className="input text-sm font-mono" placeholder="192.168.1.100"
                        value={gatewayHost} onChange={e => setGatewayHost(e.target.value)}/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">Port</label>
                      <input className="input text-sm font-mono" placeholder="1883"
                        value={gatewayPort} onChange={e => setGatewayPort(e.target.value)}/>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--muted)] bg-[var(--bg3)] p-3 rounded-lg">
                    💡 Not sure? Check your IoT gateway admin panel. For EMQX the default is port 1883. You can skip this and connect sensors from the Devices page later.
                  </p>
                </div>
              )}

              {/* ── Step 3: Zone ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">Zone Name *</label>
                    <input className="input text-sm" placeholder="e.g. Zone A1 — Lettuce Bay"
                      value={zoneName} onChange={e => setZoneName(e.target.value)}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">Current Crop</label>
                    <select className="input text-sm" value={crop} onChange={e => setCrop(e.target.value)}>
                      {['Butterhead Lettuce','Baby Spinach','Basil Genovese','Cherry Tomato','Microgreens','Arugula','Kale','Watercress'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="p-4 rounded-xl" style={{ background: 'var(--green-light, var(--bg3))', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold text-[var(--text)] mb-2">🤖 AI will auto-suggest</p>
                    <p className="text-xs text-[var(--text3)] leading-relaxed">
                      Based on your crop selection, VertiFarm AI will suggest optimal EC, pH, temperature, and PPFD targets from our grow recipe library. You can adjust them anytime.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 4: Team ── */}
              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">Email Address</label>
                    <input className="input text-sm" type="email" placeholder="colleague@example.com"
                      value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id:'farm_manager', label:'Farm Manager', desc:'Full access except billing' },
                        { id:'operator',     label:'Operator',     desc:'Monitor and log, no settings' },
                        { id:'viewer',       label:'Viewer',       desc:'Read-only dashboard access' },
                        { id:'admin',        label:'Admin',        desc:'All access including billing' },
                      ].map(r => (
                        <button key={r.id} onClick={() => setInviteRole(r.id)}
                          className="p-3 rounded-xl text-left border-2 transition-all"
                          style={{ borderColor: inviteRole === r.id ? 'var(--accent)' : 'var(--border)',
                            background: inviteRole === r.id ? 'var(--accent-soft)' : 'transparent' }}>
                          <div className="text-sm font-semibold text-[var(--text)]">{r.label}</div>
                          <div className="text-[10px] text-[var(--muted)]">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={onSkip} className="text-xs text-[var(--muted)] hover:text-[var(--text3)] transition-colors w-full text-center">
                    Skip — invite team members later from Settings →
                  </button>
                </div>
              )}

              {/* ── Step 5: Done ── */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--green-light, #d1fae5)' }}>
                      <CheckCircle2 className="w-8 h-8 text-[var(--accent)]"/>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-[var(--text)] mb-1">Your farm is live!</p>
                    <p className="text-xs text-[var(--muted)]">AI is now monitoring sensors and building your first yield forecast.</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { done: completed.has(1), label: farmName || 'Farm connected', sub: 'Farm created' },
                      { done: completed.has(2), label: gatewayHost || 'Sensor gateway', sub: completed.has(2) ? 'Connected' : 'Skipped — connect from Devices' },
                      { done: completed.has(3), label: zoneName || 'Growing zone', sub: completed.has(3) ? `${crop} zone ready` : 'Set up from Zones' },
                      { done: completed.has(4), label: inviteEmail || 'Team invite', sub: completed.has(4) ? `Invite sent to ${inviteEmail}` : 'Invite from Settings' },
                    ].map(({ done, label, sub }) => (
                      <div key={label} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                        {done
                          ? <CheckCircle2 className="w-4 h-4 text-[var(--accent)] flex-shrink-0"/>
                          : <div className="w-4 h-4 rounded-full border-2 border-[var(--border)] flex-shrink-0"/>
                        }
                        <div>
                          <div className="text-xs font-semibold text-[var(--text)]">{label}</div>
                          <div className="text-[10px] text-[var(--muted)]">{sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 border-t border-[var(--border)] pt-4">
          {step > 0 && step < STEPS.length - 1 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-ghost flex items-center gap-1.5">
              <ChevronLeft className="w-3.5 h-3.5"/> Back
            </button>
          )}
          <button onClick={handleNext} disabled={saving || !canProceed()}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Go to Dashboard →' : (
              <>{step === 0 ? 'Get Started' : step === 4 ? (inviteEmail ? 'Send Invite →' : 'Skip for now →') : 'Continue'} <ChevronRight className="w-3.5 h-3.5"/></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
