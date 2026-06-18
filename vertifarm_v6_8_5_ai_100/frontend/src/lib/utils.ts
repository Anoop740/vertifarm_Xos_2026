import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(n: number, decimals = 1) {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtKg(n: number) {
  if (n >= 1000) return `${fmt(n / 1000)}t`
  return `${fmt(n, 0)}kg`
}

export function relativeTime(d: string | Date) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function randomBetween(a: number, b: number) {
  return Math.round((a + Math.random() * (b - a)) * 10) / 10
}

export function severityColor(s: string) {
  if (s === 'critical') return 'text-[var(--red-light)]'
  if (s === 'warning') return 'text-[var(--amber-light)]'
  return 'text-[var(--info)]'
}

export function statusBadgeVariant(s: string): 'green' | 'red' | 'amber' | 'gray' | 'blue' {
  if (s === 'online' || s === 'active') return 'green'
  if (s === 'error' || s === 'critical') return 'red'
  if (s === 'warning' || s === 'maintenance') return 'amber'
  if (s === 'offline') return 'gray'
  return 'blue'
}

export function formatCurrency(n: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

export function formatDate(d: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString('en-IN', opts || { day: 'numeric', month: 'short', year: 'numeric' })
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function truncate(s: string, max = 50) {
  return s.length > max ? s.slice(0, max) + '…' : s
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function generateSeedData(seed: number, n: number, base: number, spread: number) {
  // Deterministic fake data that doesn't change on re-render
  return Array.from({ length: n }, (_, i) => {
    const x = Math.sin(seed + i * 0.7) * 0.5 + 0.5
    const d = new Date()
    d.setDate(d.getDate() - (n - i))
    return {
      date: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      value: Math.round((base + (x - 0.5) * spread * 2) * 10) / 10,
    }
  })
}
