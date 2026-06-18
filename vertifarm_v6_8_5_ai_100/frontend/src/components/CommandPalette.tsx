import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronRight, Keyboard } from 'lucide-react'

interface Command {
  id: string
  label: string
  subtitle?: string
  icon: string
  category: string
  action: () => void
  keywords?: string[]
}

function useCommandPalette() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  return { open, setOpen }
}

export default function CommandPalette() {
  const navigate   = useNavigate()
  const { open, setOpen } = useCommandPalette()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const COMMANDS: Command[] = [
    // Navigation
    { id:'nav-dash',      label:'Dashboard',             icon:'🏠', category:'Navigation', action:()=>navigate('/dashboard'),        keywords:['home','overview'] },
    { id:'nav-zones',     label:'Zones',                 icon:'🌿', category:'Navigation', action:()=>navigate('/zones'),            keywords:['plants','sensors'] },
    { id:'nav-crops',     label:'Crops & Batches',       icon:'🌱', category:'Navigation', action:()=>navigate('/crops'),            keywords:['batch','harvest'] },
    { id:'nav-harvests',  label:'Harvests & Trace',      icon:'✂️', category:'Navigation', action:()=>navigate('/harvests'),         keywords:['qr','traceability'] },
    { id:'nav-alerts',    label:'Alerts',                icon:'🔔', category:'Navigation', action:()=>navigate('/alerts'),           keywords:['warning','critical'] },
    { id:'nav-ai',        label:'Advanced AI',           icon:'🤖', category:'Navigation', action:()=>navigate('/ai/advanced'),      keywords:['vision','yield','forecast'] },
    { id:'nav-journal',   label:'Grow Journal',          icon:'📔', category:'Navigation', action:()=>navigate('/grow-journal'),     keywords:['notes','scouting','observations'] },
    { id:'nav-inventory', label:'Inventory',             icon:'📦', category:'Navigation', action:()=>navigate('/inventory'),        keywords:['stock','nutrients','seeds'] },
    { id:'nav-sops',      label:'SOPs',                  icon:'📋', category:'Navigation', action:()=>navigate('/sop'),              keywords:['procedures','protocol'] },
    { id:'nav-team',      label:'Team',                  icon:'👥', category:'Navigation', action:()=>navigate('/team'),             keywords:['members','invite','roles'] },
    { id:'nav-billing',   label:'Billing',               icon:'💳', category:'Navigation', action:()=>navigate('/billing'),          keywords:['plan','subscription','invoice'] },
    { id:'nav-settings',  label:'Settings',              icon:'⚙️', category:'Navigation', action:()=>navigate('/settings'),         keywords:['profile','account','preferences'] },
    { id:'nav-apikeys',   label:'API Keys',              icon:'🔑', category:'Navigation', action:()=>navigate('/settings/api-keys'),keywords:['api','token','integration'] },
    { id:'nav-builder',   label:'Dashboard Builder',     icon:'🎛️', category:'Navigation', action:()=>navigate('/dashboard/builder'),keywords:['widgets','layout','custom'] },
    // Actions
    { id:'act-invite',    label:'Invite team member',    icon:'✉️', category:'Actions',    action:()=>navigate('/team'),             keywords:['add','user','email'] },
    { id:'act-newzone',   label:'Add new zone',          icon:'➕', category:'Actions',    action:()=>navigate('/zones'),            keywords:['create','zone','area'] },
    { id:'act-newcrop',   label:'Start new crop batch',  icon:'🌱', category:'Actions',    action:()=>navigate('/crops'),            keywords:['batch','seeding','plant'] },
    { id:'act-harvest',   label:'Log a harvest',         icon:'✂️', category:'Actions',    action:()=>navigate('/harvests'),         keywords:['weigh','record','batch'] },
    { id:'act-journal',   label:'New journal entry',     icon:'📝', category:'Actions',    action:()=>navigate('/grow-journal'),     keywords:['note','observation','scout'] },
    { id:'act-alert',     label:'View active alerts',    icon:'🚨', category:'Actions',    action:()=>navigate('/alerts'),           keywords:['warning','unresolved'] },
    { id:'act-cv',        label:'Run CV scan',           icon:'👁️', category:'Actions',    action:()=>navigate('/ai/advanced'),      keywords:['yolo','vision','disease','photo'] },
    // AI
    { id:'ai-yield',      label:'AI yield forecast',     icon:'📈', category:'AI',         action:()=>navigate('/ai/advanced'),      keywords:['predict','harvest','future'] },
    { id:'ai-recipe',     label:'AI recipe generator',   icon:'🧬', category:'AI',         action:()=>navigate('/crops'),            keywords:['generate','nutrients','ec','ph'] },
    { id:'ai-anomaly',    label:'Anomaly detection',     icon:'⚠️', category:'AI',         action:()=>navigate('/ai/advanced'),      keywords:['anomaly','sensor','outlier'] },
  ]

  const filtered = query.trim()
    ? COMMANDS.filter(c => {
        const q = query.toLowerCase()
        return c.label.toLowerCase().includes(q) ||
          c.subtitle?.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.keywords?.some(k => k.includes(q))
      })
    : COMMANDS

  // Group by category
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  const flat = filtered  // flat list for keyboard nav

  useEffect(() => { if (open) { setQuery(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 50) } }, [open])

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c+1, flat.length-1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c-1, 0)) }
    if (e.key === 'Enter' && flat[cursor]) { flat[cursor].action(); setOpen(false) }
  }, [flat, cursor])

  const run = (cmd: Command) => { cmd.action(); setOpen(false) }

  const CAT_COLORS: Record<string, string> = {
    Navigation: '#2563eb', Actions: '#0d9488', AI: '#7c3aed'
  }

  return (
    <>
      {/* Trigger button — shown in nav */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open command palette (⌘K)"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+k"
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
        <Search className="w-3 h-3" aria-hidden="true"/>
        Search…
        <span className="flex items-center gap-0.5 ml-1" aria-hidden="true">
          <kbd style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:4, padding:'1px 5px', fontSize:10, fontFamily:'monospace' }}>⌘</kbd>
          <kbd style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:4, padding:'1px 5px', fontSize:10, fontFamily:'monospace' }}>K</kbd>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[900]"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setOpen(false)}/>
            <div className="fixed inset-0 z-[901] flex items-start justify-center pt-[15vh] px-4 pointer-events-none" role="presentation">
              <motion.div
                role="dialog"
                aria-label="Command palette"
                aria-modal="true"
                initial={{ scale:.97, opacity:0, y:-8 }}
                animate={{ scale:1, opacity:1, y:0 }}
                exit={{ scale:.97, opacity:0, y:-8 }}
                transition={{ duration:.18, ease:[.22,1,.36,1] }}
                className="pointer-events-auto w-full max-w-xl rounded-2xl overflow-hidden"
                style={{ background:'var(--card)', border:'1px solid var(--border)', boxShadow:'0 32px 80px rgba(0,0,0,.25)' }}>

                {/* Search input */}
                <div className="flex items-center gap-3 px-4 border-b border-[var(--border)]"
                  style={{ height:54 }}>
                  <Search className="w-4 h-4 text-[var(--muted)] flex-shrink-0" aria-hidden="true"/>
                  <input ref={inputRef}
                    role="combobox"
                    aria-label="Search commands and pages"
                    aria-expanded={flat.length > 0}
                    aria-autocomplete="list"
                    aria-controls="command-palette-results"
                    aria-activedescendant={flat[cursor] ? `cmd-${flat[cursor].id}` : undefined}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-[var(--muted)] text-[var(--text)]"
                    placeholder="Search pages, actions, AI features…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setCursor(0) }}
                    onKeyDown={handleKey}/>
                  <kbd onClick={() => setOpen(false)}
                    role="button"
                    aria-label="Close command palette"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setOpen(false)}
                    className="text-[10px] px-2 py-1 rounded cursor-pointer text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                    style={{ background:'var(--bg3)', border:'1px solid var(--border)', fontFamily:'monospace' }}>ESC</kbd>
                </div>

                {/* Results */}
                <div id="command-palette-results" role="listbox" aria-label="Search results" style={{ maxHeight:400, overflowY:'auto' }} className="py-2">
                  {flat.length === 0 ? (
                    <div role="option" aria-selected="false" className="text-center py-10 text-sm text-[var(--muted)]">
                      No results for "{query}"
                    </div>
                  ) : (
                    Object.entries(grouped).map(([cat, cmds]) => (
                      <div key={cat} role="group" aria-label={cat}>
                        <div className="px-4 py-1.5 text-[10px] font-700 uppercase tracking-widest" aria-hidden="true"
                          style={{ color: CAT_COLORS[cat] || 'var(--muted)', letterSpacing:'.1em', fontWeight:700 }}>
                          {cat}
                        </div>
                        {cmds.map(cmd => {
                          const idx = flat.indexOf(cmd)
                          const active = idx === cursor
                          return (
                            <button key={cmd.id}
                              id={`cmd-${cmd.id}`}
                              role="option"
                              aria-selected={active}
                              aria-label={cmd.subtitle ? `${cmd.label}: ${cmd.subtitle}` : cmd.label}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                              style={{ background: active ? 'var(--accent-soft)' : 'transparent' }}
                              onMouseEnter={() => setCursor(idx)}
                              onClick={() => run(cmd)}>
                              <span className="text-lg w-7 text-center flex-shrink-0" aria-hidden="true">{cmd.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-[var(--text)]">{cmd.label}</div>
                                {cmd.subtitle && <div className="text-xs text-[var(--muted)]">{cmd.subtitle}</div>}
                              </div>
                              {active && <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)]" aria-hidden="true"/>}
                            </button>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)]"
                  style={{ background:'var(--bg3)' }}>
                  <div className="flex items-center gap-4 text-[10px] text-[var(--muted)]">
                    <span className="flex items-center gap-1.5">
                      <kbd style={{ fontFamily:'monospace', fontSize:10, background:'var(--card)', border:'1px solid var(--border)', borderRadius:4, padding:'0 4px' }}>↑</kbd>
                      <kbd style={{ fontFamily:'monospace', fontSize:10, background:'var(--card)', border:'1px solid var(--border)', borderRadius:4, padding:'0 4px' }}>↓</kbd>
                      navigate
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd style={{ fontFamily:'monospace', fontSize:10, background:'var(--card)', border:'1px solid var(--border)', borderRadius:4, padding:'0 4px' }}>↵</kbd>
                      open
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
                    <Keyboard className="w-3 h-3"/> {flat.length} results
                  </span>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
