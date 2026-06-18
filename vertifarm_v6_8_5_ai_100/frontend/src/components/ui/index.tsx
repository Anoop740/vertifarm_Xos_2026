import React, { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

/* ─── BUTTON ─────────────────────────────────────────────── */
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary'|'secondary'|'ghost'|'danger'|'success'
  size?: 'sm'|'md'|'lg'
  loading?: boolean
}
export function Button({ variant='primary', size='md', loading, children, className, disabled, ...props }: BtnProps) {
  const v = { primary:'btn-primary', secondary:'btn-secondary', ghost:'btn-ghost', danger:'btn-danger', success:'btn-success' }[variant]
  const s = { sm:'btn-sm', md:'', lg:'btn-lg' }[size]
  return (
    <button {...props} disabled={disabled||loading} className={cn(v, s, className)}>
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
}

/* ─── INPUT ──────────────────────────────────────────────── */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string
}
export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <input id={inputId} className={cn('input', error && 'input-error', className)} {...props} />
      {error && <p className="form-error flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{error}</p>}
      {hint && !error && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
    </div>
  )
}

/* ─── SELECT ─────────────────────────────────────────────── */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string   // if provided, shows a disabled "-- choose --" option at top
}
export function Select({ label, error, hint, options, className, id, placeholder, ...props }: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
  // Only add placeholder if none of the options is already empty-value
  const hasEmpty = options.some(o => o.value === '')
  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <select id={inputId} className={cn('input', error && 'input-error', className)} {...props}>
        {!hasEmpty && placeholder !== null && (
          <option value="" disabled>{placeholder || `Select ${label || 'option'}...`}</option>
        )}
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      {error && <p className="form-error flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{error}</p>}
      {hint && !error && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
    </div>
  )
}

/* ─── TEXTAREA ───────────────────────────────────────────── */
interface TAProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string; hint?: string; rows?: number
}
export function Textarea({ label, error, hint, rows=3, className, id, ...props }: TAProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
  return (
    <div className="space-y-1">
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <textarea id={inputId} rows={rows} className={cn('input', error && 'input-error', className)} {...props} />
      {error && <p className="form-error flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{error}</p>}
      {hint && !error && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
    </div>
  )
}

/* ─── BADGE ──────────────────────────────────────────────── */
type BadgeVariant = 'green'|'amber'|'red'|'blue'|'gray'|'purple'|'teal'
export function Badge({ children, variant='gray' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const cls: Record<BadgeVariant, string> = {
    green:'badge-green', amber:'badge-amber', red:'badge-red',
    blue:'badge-blue', gray:'badge-gray', purple:'badge-purple', teal:'badge-teal'
  }
  return <span className={cls[variant]}>{children}</span>
}

/* ─── MODAL ──────────────────────────────────────────────── */
interface ModalProps {
  open: boolean; onClose: () => void; title: string
  children: React.ReactNode; footer?: React.ReactNode
  size?: 'sm'|'md'|'lg'|'xl'
}
export function Modal({ open, onClose, title, children, footer, size='md' }: ModalProps) {
  if (!open) return null
  const widths = { sm:'max-w-md', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' }
  return (
    <div className="modal-backdrop" onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div className={cn('modal w-full animate-in', widths[size])}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} className="btn-ghost w-7 h-7 p-0 rounded-md flex items-center justify-center">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

/* ─── CARD ───────────────────────────────────────────────── */
export function Card({ children, className, onClick, padding=true }:
  { children: React.ReactNode; className?: string; onClick?: ()=>void; padding?: boolean }) {
  return (
    <div onClick={onClick} className={cn('card', padding && 'p-4', onClick && 'card-hover cursor-pointer', className)}>
      {children}
    </div>
  )
}

/* ─── CARD HEADER ────────────────────────────────────────── */
export function CardHeader({ title, subtitle, action, className }:
  { title: string; subtitle?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div>
        <h3 className="section-title">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  )
}

/* ─── STAT CARD ──────────────────────────────────────────── */
export function StatCard({ label, value, sub, trend, trendUp, icon: Icon, accent='blue', onClick }:
  { label: string; value: string|number; sub?: string; trend?: string; trendUp?: boolean
    icon?: any; accent?: 'blue'|'green'|'amber'|'red'|'purple'; onClick?: ()=>void }) {
  const colors = { blue:'var(--accent)', green:'var(--green)', amber:'var(--amber)', red:'var(--red-light)', purple:'#7c3aed' }
  const bg     = { blue:'var(--accent-soft)', green:'var(--green-soft)', amber:'var(--amber-soft)', red:'var(--red-soft)', purple:'rgba(124,58,237,0.10)' }
  const trendColor = trendUp === undefined ? 'text-muted' : trendUp ? 'text-[var(--green)]' : 'text-[var(--red-light)]'
  return (
    <div onClick={onClick} className={cn('card p-4 space-y-3', onClick && 'card-hover')}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: bg[accent] }}>
            <Icon className="w-4 h-4" style={{ color: colors[accent] }}/>
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-[var(--text)] leading-none">{value}</div>
        {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      </div>
      {trend && <div className={cn('text-xs font-medium', trendColor)}>{trend}</div>}
    </div>
  )
}

/* ─── PROGRESS BAR ───────────────────────────────────────── */
export function ProgressBar({ value, max=100, variant='blue', label, showPct }:
  { value: number; max?: number; variant?: 'blue'|'green'|'amber'|'red'|'teal'; label?: string; showPct?: boolean }) {
  const pct = Math.min(100, Math.max(0, (value/max)*100))
  const cls = { blue:'progress-blue', green:'progress-green', amber:'progress-amber', red:'progress-red', teal:'progress-teal' }[variant]
  return (
    <div className="space-y-1">
      {(label || showPct) && (
        <div className="flex justify-between text-xs text-muted">
          {label && <span>{label}</span>}
          {showPct && <span>{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className="progress-track">
        <div className={cls} style={{ width: `${pct}%` }}/>
      </div>
    </div>
  )
}

/* ─── ALERT BOX ──────────────────────────────────────────── */
export function AlertBox({ type='info', message, onClose }:
  { type?: 'info'|'success'|'warning'|'danger'; message: string; onClose?: ()=>void }) {
  const icons = { info: Info, success: CheckCircle, warning: AlertTriangle, danger: AlertCircle }
  const Icon = icons[type]
  return (
    <div className={`alert-${type} alert-box`}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5"/>
      <span className="flex-1 text-sm">{message}</span>
      {onClose && <button onClick={onClose} className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5"/></button>}
    </div>
  )
}

/* ─── SKELETON ───────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)}/>
}

/* ─── EMPTY STATE ────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, message, action }:
  { icon?: any; title: string; message?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      {Icon && <div className="w-12 h-12 rounded-xl bg-[var(--surface)] flex items-center justify-center mb-1">
        <Icon className="w-6 h-6 text-muted"/>
      </div>}
      <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
      {message && <div className="text-xs text-muted max-w-xs text-center leading-relaxed">{message}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* ─── SPINNER ────────────────────────────────────────────── */
export function Spinner({ size='sm' }: { size?: 'sm'|'md'|'lg' }) {
  const s = { sm:'w-4 h-4', md:'w-6 h-6', lg:'w-8 h-8' }[size]
  return <Loader2 className={cn(s, 'animate-spin text-[var(--accent)]')}/>
}

/* ─── TOGGLE ─────────────────────────────────────────────── */
export function Toggle({ checked, onChange, label }:
  { checked: boolean; onChange: (v:boolean)=>void; label?: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface2)]'
        )}
      >
        <span className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}/>
      </button>
      {label && <span className="text-sm text-[var(--text2)]">{label}</span>}
    </label>
  )
}

/* ─── TABLE ──────────────────────────────────────────────── */
export function Table({ cols, rows, empty='No data found', loading }:
  { cols: { key: string; label: string; render?: (v:any,row:any)=>React.ReactNode; width?: string }[]
    rows: any[]; empty?: string; loading?: boolean }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>{cols.map(c => <th key={c.key} style={c.width?{width:c.width}:{}}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {loading ? (
            Array(5).fill(0).map((_,i) => (
              <tr key={i}>{cols.map(c => <td key={c.key}><Skeleton className="h-4 w-full"/></td>)}</tr>
            ))
          ) : rows.length === 0 ? (
            <tr><td colSpan={cols.length} className="text-center py-12 text-muted text-sm">{empty}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row.id || i}>
              {cols.map(c => <td key={c.key}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── CONFIRM MODAL ──────────────────────────────────────── */
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel='Confirm', danger=false, loading=false }:
  { open: boolean; onClose: ()=>void; onConfirm: ()=>void; title: string; message: string
    confirmLabel?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={danger?'danger':'primary'} loading={loading}
            onClick={()=>{onConfirm()}}>{confirmLabel}</Button>
        </>
      }>
      <p className="text-sm text-[var(--text2)] leading-relaxed">{message}</p>
    </Modal>
  )
}
