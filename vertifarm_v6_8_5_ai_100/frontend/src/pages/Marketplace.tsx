import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  ShoppingCart, Package, TrendingUp, DollarSign, Plus,
  Search, Filter, Star, Truck, CheckCircle, Clock,
  XCircle, AlertTriangle, Eye, FileText, Leaf,
  Building2, BarChart2, ArrowUpRight, Banknote,
  ShieldCheck, RefreshCw, ChevronDown, X, MapPin,
} from 'lucide-react'

// ─── API layer ────────────────────────────────────────────────────
const mktApi = {
  // Farm side
  getMyListings:   ()     => api.get('/api/v1/marketplace/listings').then(r => r.data),
  createListing:   (d: any) => api.post('/api/v1/marketplace/listings', d).then(r => r.data),
  updateListing:   (id: string, d: any) => api.patch(`/api/v1/marketplace/listings/${id}`, d).then(r => r.data),
  deleteListing:   (id: string) => api.delete(`/api/v1/marketplace/listings/${id}`).then(r => r.data),
  getIncoming:     (status?: string) => api.get(`/api/v1/marketplace/orders/incoming${status ? `?status=${status}` : ''}`).then(r => r.data),
  updateOrderStatus: (id: string, d: any) => api.patch(`/api/v1/marketplace/orders/${id}/status`, d).then(r => r.data),
  getEscrow:       () => api.get('/api/v1/marketplace/escrow').then(r => r.data),
  getAnalytics:    () => api.get('/api/v1/marketplace/analytics').then(r => r.data),
  // Public browse
  browse:          (params: any) => api.get('/api/v1/marketplace/browse', { params }).then(r => r.data),
  getStats:        () => api.get('/api/v1/marketplace/stats').then(r => r.data),
  getInvoice:      (id: string) => api.get(`/api/v1/marketplace/orders/${id}/invoice`).then(r => r.data),
}

// ─── Helpers ─────────────────────────────────────────────────────
const ORDER_STATUS_META: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  pending:   { color: '#f59e0b', bg: '#f59e0b22', label: 'Pending',   icon: Clock },
  confirmed: { color: '#3b82f6', bg: '#3b82f622', label: 'Confirmed', icon: CheckCircle },
  packed:    { color: '#8b5cf6', bg: '#8b5cf622', label: 'Packed',    icon: Package },
  shipped:   { color: '#06b6d4', bg: '#06b6d422', label: 'Shipped',   icon: Truck },
  delivered: { color: '#10b981', bg: '#10b98122', label: 'Delivered', icon: CheckCircle },
  cancelled: { color: '#ef4444', bg: '#ef444422', label: 'Cancelled', icon: XCircle },
  disputed:  { color: '#f97316', bg: '#f9731622', label: 'Disputed',  icon: AlertTriangle },
}

const PAY_STATUS_META: Record<string, { color: string; label: string }> = {
  unpaid:   { color: '#64748b', label: 'Unpaid'   },
  held:     { color: '#f59e0b', label: '🔒 In Escrow' },
  released: { color: '#10b981', label: 'Released' },
  refunded: { color: '#ef4444', label: 'Refunded' },
}

const GRADE_COLOR: Record<string, string> = { A: '#10b981', B: '#f59e0b', C: '#ef4444' }

function fmtINR(v: number) {
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function StatusBadge({ status, type = 'order' }: { status: string; type?: 'order' | 'pay' }) {
  const meta = type === 'pay' ? PAY_STATUS_META[status] : ORDER_STATUS_META[status]
  if (!meta) return <span style={{ fontSize: 12, color: '#64748b' }}>{status}</span>
  const Icon = (ORDER_STATUS_META[status] as any)?.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: (ORDER_STATUS_META[status] as any)?.bg || '#1e293b',
      color: meta.color,
    }}>
      {Icon && <Icon size={10} />} {meta.label}
    </span>
  )
}

// ─── Add Listing Modal ────────────────────────────────────────────
function AddListingModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({
    crop_name: '', variety: '', grade: 'A', description: '',
    quantity_kg: '', min_order_kg: '5', price_per_kg_inr: '',
    bulk_discount_pct: '0', bulk_threshold_kg: '50',
    packaging: '', shelf_life_days: '', storage_temp_c: '',
    origin_city: '', origin_state: '',
    available_until: '', certifications: [] as string[],
    platform_commission_pct: '2.5',
  })
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))
  const toggleCert = (c: string) => setForm(f => ({
    ...f,
    certifications: f.certifications.includes(c)
      ? f.certifications.filter(x => x !== c)
      : [...f.certifications, c],
  }))

  const CERTS = ['organic', 'fssai', 'globalgap', 'export']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: '#0c1525', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 18, width: '100%', maxWidth: 620, padding: 32 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f6ff' }}>Post New Produce Listing</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Your harvest will appear on the B2B marketplace</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { k: 'crop_name', label: 'Crop Name *', ph: 'e.g. Butterhead Lettuce', full: true },
            { k: 'variety', label: 'Variety', ph: 'e.g. Rex, Lollo Rosso', full: false },
            { k: 'quantity_kg', label: 'Total Quantity (kg) *', ph: '100', full: false, type: 'number' },
            { k: 'min_order_kg', label: 'Min Order (kg)', ph: '5', full: false, type: 'number' },
            { k: 'price_per_kg_inr', label: 'Price per kg (₹) *', ph: '180', full: false, type: 'number' },
            { k: 'bulk_discount_pct', label: 'Bulk Discount (%)', ph: '5', full: false, type: 'number' },
            { k: 'bulk_threshold_kg', label: 'Bulk Threshold (kg)', ph: '50', full: false, type: 'number' },
            { k: 'packaging', label: 'Packaging', ph: '5kg crate', full: false },
            { k: 'shelf_life_days', label: 'Shelf Life (days)', ph: '7', full: false, type: 'number' },
            { k: 'storage_temp_c', label: 'Storage Temp (°C)', ph: '4', full: false, type: 'number' },
            { k: 'origin_city', label: 'Origin City', ph: 'Bengaluru', full: false },
            { k: 'origin_state', label: 'Origin State', ph: 'Karnataka', full: false },
            { k: 'available_until', label: 'Available Until', ph: '', full: false, type: 'date' },
          ].map(({ k, label, ph, full, type }) => (
            <div key={k} style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{label}</label>
              <input type={type || 'text'} placeholder={ph} value={(form as any)[k]} onChange={set(k)}
                style={{ width: '100%', background: '#060d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 12px', color: '#f0f6ff', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          ))}

          {/* Grade */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Grade</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['A', 'B', 'C'].map(g => (
                <button key={g} onClick={() => setForm(f => ({ ...f, grade: g }))}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${form.grade === g ? GRADE_COLOR[g] : 'rgba(148,163,184,0.2)'}`, background: form.grade === g ? `${GRADE_COLOR[g]}18` : 'transparent', color: form.grade === g ? GRADE_COLOR[g] : '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{g}</button>
              ))}
            </div>
          </div>

          {/* Commission */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Platform Commission</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['2.0', '2.5', '3.0'].map(r => (
                <button key={r} onClick={() => setForm(f => ({ ...f, platform_commission_pct: r }))}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${form.platform_commission_pct === r ? '#00d4aa' : 'rgba(148,163,184,0.2)'}`, background: form.platform_commission_pct === r ? 'rgba(0,212,170,0.1)' : 'transparent', color: form.platform_commission_pct === r ? '#00d4aa' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{r}%</button>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 8 }}>Certifications</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CERTS.map(c => (
                <button key={c} onClick={() => toggleCert(c)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${form.certifications.includes(c) ? '#10b981' : 'rgba(148,163,184,0.2)'}`, background: form.certifications.includes(c) ? 'rgba(16,185,129,0.12)' : 'transparent', color: form.certifications.includes(c) ? '#10b981' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: 12, textTransform: 'uppercase' }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Description</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Describe your produce — growing method, quality notes, packaging details..."
              rows={3} style={{ width: '100%', background: '#060d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 12px', color: '#f0f6ff', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button
            onClick={() => onSave({
              ...form,
              quantity_kg: parseFloat(form.quantity_kg),
              min_order_kg: parseFloat(form.min_order_kg),
              price_per_kg_inr: parseFloat(form.price_per_kg_inr),
              bulk_discount_pct: parseFloat(form.bulk_discount_pct),
              bulk_threshold_kg: parseFloat(form.bulk_threshold_kg),
              shelf_life_days: form.shelf_life_days ? parseInt(form.shelf_life_days) : undefined,
              storage_temp_c: form.storage_temp_c ? parseFloat(form.storage_temp_c) : undefined,
              platform_commission_pct: parseFloat(form.platform_commission_pct),
              available_until: form.available_until || undefined,
            })}
            disabled={!form.crop_name || !form.quantity_kg || !form.price_per_kg_inr}
            style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #00d4aa, #0891b2)', color: '#060d19', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            Post Listing
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invoice Modal ────────────────────────────────────────────────
function InvoiceModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: inv, isLoading } = useQuery({ queryKey: ['invoice', orderId], queryFn: () => mktApi.getInvoice(orderId) })
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
        {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading…</div> : inv && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f0f6ff' }}>{inv.invoice_number}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Order: {inv.order_number}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusBadge status={inv.payment_status} type="pay" />
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Issued: {new Date(inv.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: '#060d19', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>From</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff' }}>{inv.seller.name}</div>
              </div>
              <div style={{ background: '#060d19', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>To</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff' }}>{inv.buyer.name}</div>
                {inv.buyer.company && <div style={{ fontSize: 11, color: '#64748b' }}>{inv.buyer.company}</div>}
                {inv.buyer.gst_number && <div style={{ fontSize: 11, color: '#475569' }}>GST: {inv.buyer.gst_number}</div>}
                <div style={{ fontSize: 11, color: '#475569' }}>{inv.buyer.city} {inv.buyer.pincode}</div>
              </div>
            </div>

            <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#1e293b' }}>
                  {['Description', 'Qty (kg)', 'Rate/kg', 'Amount'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 11, color: '#64748b', fontWeight: 600, textAlign: 'left', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {inv.line_items.map((li: any, i: number) => (
                    <tr key={i} style={{ background: '#060d19', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#f0f6ff' }}>{li.description}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>{li.quantity_kg}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>₹{li.rate_per_kg_inr}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#f0f6ff' }}>₹{li.amount_inr.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#060d19', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
              {[
                { label: 'Subtotal', value: inv.subtotal_inr, color: '#94a3b8' },
                inv.discount_inr > 0 && { label: 'Bulk Discount', value: -inv.discount_inr, color: '#10b981' },
                { label: 'Platform Fee (VertiFarm)', value: inv.platform_fee_inr, color: '#f59e0b' },
                { label: 'Total', value: inv.total_inr, color: '#f0f6ff', bold: true },
              ].filter(Boolean).map((row: any) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: row.bold ? '1px solid rgba(148,163,184,0.1)' : 'none', marginBottom: row.bold ? 6 : 0, paddingTop: row.bold ? 8 : 5 }}>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: row.bold ? 600 : 400 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 400, color: row.color }}>
                    {row.value < 0 ? '-' : ''}{fmtINR(Math.abs(row.value))}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#475569', textAlign: 'center' }}>{inv.platform_commission_note}</div>
            <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 10, border: 'none', background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Close</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Listings Tab ─────────────────────────────────────────────────
function ListingsTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const { data: listings = [], isLoading } = useQuery({ queryKey: ['my-listings'], queryFn: mktApi.getMyListings })
  const createMutation = useMutation({
    mutationFn: mktApi.createListing,
    onSuccess: () => { toast.success('Listing posted!'); qc.invalidateQueries({ queryKey: ['my-listings'] }); setShowAdd(false) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to post listing'),
  })
  const withdrawMutation = useMutation({
    mutationFn: mktApi.deleteListing,
    onSuccess: () => { toast.success('Listing withdrawn'); qc.invalidateQueries({ queryKey: ['my-listings'] }) },
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#64748b' }}>{(listings as any[]).length} listing{(listings as any[]).length !== 1 ? 's' : ''}</div>
        <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'linear-gradient(135deg,#00d4aa,#0891b2)', borderRadius: 10, border: 'none', color: '#060d19', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={14} /> Post Listing
        </button>
      </div>

      {isLoading && <div style={{ color: '#64748b', padding: 20 }}>Loading…</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(listings as any[]).map((l: any) => (
          <div key={l.id} style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '18px 20px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${GRADE_COLOR[l.grade]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Leaf size={20} color={GRADE_COLOR[l.grade]} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f6ff' }}>{l.crop_name}</span>
                {l.variety && <span style={{ fontSize: 12, color: '#64748b' }}>{l.variety}</span>}
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${GRADE_COLOR[l.grade]}18`, color: GRADE_COLOR[l.grade] }}>Grade {l.grade}</span>
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: l.status === 'active' ? '#10b98122' : '#ef444422', color: l.status === 'active' ? '#10b981' : '#ef4444', textTransform: 'capitalize' }}>{l.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#64748b', flexWrap: 'wrap', marginBottom: 6 }}>
                <span><b style={{ color: '#f0f6ff' }}>{fmtINR(l.price_per_kg_inr)}</b>/kg</span>
                <span>Avail: <b style={{ color: '#f0f6ff' }}>{l.available_kg.toFixed(1)} kg</b></span>
                <span>Reserved: {l.reserved_kg.toFixed(1)} kg</span>
                <span>Sold: {l.sold_kg.toFixed(1)} kg</span>
                {l.origin_city && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{l.origin_city}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(l.certifications || []).map((c: string) => (
                  <span key={c} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(16,185,129,0.1)', color: '#10b981', textTransform: 'uppercase' }}>{c}</span>
                ))}
                {l.bulk_discount_pct > 0 && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{l.bulk_discount_pct}% bulk off {'>'}{l.bulk_threshold_kg}kg</span>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}><Eye size={10} /> {l.view_count} views</div>
              <button onClick={() => { if (window.confirm('Withdraw this listing?')) withdrawMutation.mutate(l.id) }}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>
                Withdraw
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <AddListingModal onClose={() => setShowAdd(false)} onSave={d => createMutation.mutate(d)} />}
    </div>
  )
}

// ─── Orders Tab ───────────────────────────────────────────────────
function OrdersTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [invoiceOrderId, setInvoiceOrderId] = useState<string | null>(null)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['incoming-orders', statusFilter],
    queryFn: () => mktApi.getIncoming(statusFilter || undefined),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: any) => mktApi.updateOrderStatus(id, d),
    onSuccess: () => { toast.success('Order updated'); qc.invalidateQueries({ queryKey: ['incoming-orders'] }) },
    onError: () => toast.error('Update failed'),
  })

  const STATUS_FLOW: Record<string, string> = {
    pending: 'confirmed', confirmed: 'packed', packed: 'shipped',
  }
  const NEXT_LABEL: Record<string, string> = {
    pending: 'Confirm', confirmed: 'Mark Packed', packed: 'Mark Shipped',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${statusFilter === s ? '#00d4aa' : 'rgba(148,163,184,0.2)'}`, background: statusFilter === s ? 'rgba(0,212,170,0.1)' : 'transparent', color: statusFilter === s ? '#00d4aa' : '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ color: '#64748b', padding: 20 }}>Loading…</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(orders as any[]).map((o: any) => {
          const sm = ORDER_STATUS_META[o.status]
          const nextStatus = STATUS_FLOW[o.status]
          return (
            <div key={o.id} style={{ background: '#0c1525', border: `1px solid ${sm?.bg?.replace('22', '44') || 'rgba(148,163,184,0.12)'}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f6ff', marginBottom: 2 }}>
                    {o.order_number} · {o.crop_name}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    <b style={{ color: '#94a3b8' }}>{o.buyer_name}</b>
                    {o.buyer_email && ` · ${o.buyer_email}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusBadge status={o.status} />
                  <StatusBadge status={o.payment_status} type="pay" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#64748b', flexWrap: 'wrap', marginBottom: 10 }}>
                <span><b style={{ color: '#f0f6ff' }}>{o.quantity_kg} kg</b></span>
                <span><b style={{ color: '#10b981' }}>{fmtINR(o.total_inr)}</b> total</span>
                <span>Commission: {fmtINR(o.platform_fee_inr)}</span>
                {o.delivery_city && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> {o.delivery_city}</span>}
                {o.requested_delivery_date && <span>Due: {new Date(o.requested_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                {o.tracking_number && <span style={{ color: '#3b82f6' }}>🚚 {o.tracking_number}</span>}
              </div>

              {o.buyer_notes && (
                <div style={{ fontSize: 12, color: '#64748b', background: '#060d19', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                  💬 "{o.buyer_notes}"
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {nextStatus && (
                  <button onClick={() => updateMutation.mutate({ id: o.id, status: nextStatus })}
                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00d4aa,#0891b2)', color: '#060d19', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {NEXT_LABEL[o.status]}
                  </button>
                )}
                <button onClick={() => setInvoiceOrderId(o.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                  <FileText size={12} /> Invoice
                </button>
                {o.status === 'pending' && (
                  <button onClick={() => updateMutation.mutate({ id: o.id, status: 'cancelled' })}
                    style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {invoiceOrderId && <InvoiceModal orderId={invoiceOrderId} onClose={() => setInvoiceOrderId(null)} />}
    </div>
  )
}

// ─── Escrow Tab ───────────────────────────────────────────────────
function EscrowTab() {
  const { data: escrows = [], isLoading } = useQuery({ queryKey: ['escrow'], queryFn: mktApi.getEscrow })
  const held = (escrows as any[]).filter((e: any) => e.status === 'held').reduce((s: number, e: any) => s + e.net_inr, 0)
  const released = (escrows as any[]).filter((e: any) => e.status === 'released').reduce((s: number, e: any) => s + e.net_inr, 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#0c1525', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={12} /> Held in Escrow</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{fmtINR(held)}</div>
        </div>
        <div style={{ background: '#0c1525', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Banknote size={12} /> Released to Farm</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{fmtINR(released)}</div>
        </div>
        <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign size={12} /> Total Escrow Txns</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f0f6ff' }}>{(escrows as any[]).length}</div>
        </div>
      </div>

      <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
              {['Order', 'Gateway', 'Gross', 'Platform Fee', 'Net to Farm', 'Status', 'Held/Released'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading…</td></tr>
            ) : (escrows as any[]).map((e: any, i: number) => (
              <tr key={e.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{e.order_id.slice(-8)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#1e293b', color: '#94a3b8', textTransform: 'capitalize' }}>{e.gateway || '—'}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#f0f6ff', fontWeight: 500 }}>{fmtINR(e.gross_inr)}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#f59e0b' }}>-{fmtINR(e.platform_fee_inr)}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#10b981' }}>{fmtINR(e.net_inr)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: e.status === 'held' ? '#f59e0b22' : e.status === 'released' ? '#10b98122' : '#ef444422',
                    color: e.status === 'held' ? '#f59e0b' : e.status === 'released' ? '#10b981' : '#ef4444',
                    textTransform: 'capitalize' }}>{e.status}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: '#475569' }}>
                  {e.held_at && new Date(e.held_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {e.released_at && ` → ${new Date(e.released_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────
function AnalyticsTab() {
  const { data: stats } = useQuery({ queryKey: ['mkt-analytics'], queryFn: mktApi.getAnalytics })
  if (!stats) return <div style={{ color: '#64748b', padding: 20 }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Revenue (30d)', value: fmtINR(stats.total_revenue_inr), color: '#10b981', icon: TrendingUp },
          { label: 'Net Revenue', value: fmtINR(stats.net_revenue_inr), color: '#00d4aa', icon: Banknote },
          { label: 'Platform Fees', value: fmtINR(stats.platform_fees_inr), color: '#f59e0b', icon: DollarSign },
          { label: 'Total Orders', value: stats.total_orders, color: '#3b82f6', icon: ShoppingCart },
          { label: 'Kg Sold', value: `${stats.total_kg_sold} kg`, color: '#8b5cf6', icon: Package },
          { label: 'Avg Order Value', value: fmtINR(stats.avg_order_value_inr), color: '#f0f6ff', icon: BarChart2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, marginBottom: 8 }}><Icon size={12} />{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Revenue trend */}
        <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 16 }}>Monthly Revenue</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
            {stats.monthly_revenue.map((m: any) => {
              const maxV = Math.max(...stats.monthly_revenue.map((x: any) => x.revenue_inr))
              const h = Math.max(8, (m.revenue_inr / maxV) * 70)
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{fmtINR(m.revenue_inr)}</div>
                  <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg,#00d4aa,#0891b2)', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ fontSize: 9, color: '#475569', whiteSpace: 'nowrap' }}>{m.month.split(' ')[0]}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top crops */}
        <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6ff', marginBottom: 16 }}>Top Crops by Revenue</div>
          {stats.top_crops.map((c: any, i: number) => {
            const maxRev = stats.top_crops[0].revenue_inr
            return (
              <div key={c.crop} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#f0f6ff' }}>{c.crop}</span>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{fmtINR(c.revenue_inr)}</span>
                </div>
                <div style={{ height: 6, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(c.revenue_inr / maxRev) * 100}%`, background: ['#10b981', '#3b82f6', '#8b5cf6'][i % 3], borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Browse Tab (public view) ─────────────────────────────────────
function BrowseTab() {
  const [search, setSearch] = useState('')
  const [grade, setGrade] = useState('')
  const [sort, setSort] = useState('newest')
  const { data: listings = [], isLoading, refetch } = useQuery({
    queryKey: ['browse', search, grade, sort],
    queryFn: () => mktApi.browse({ crop: search || undefined, grade: grade || undefined, sort }),
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search crops…"
            style={{ width: '100%', background: '#0c1525', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 10px 9px 30px', color: '#f0f6ff', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <select value={grade} onChange={e => setGrade(e.target.value)}
          style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 12px', color: '#f0f6ff', fontSize: 13 }}>
          <option value="">All Grades</option>
          {['A', 'B', 'C'].map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 12px', color: '#f0f6ff', fontSize: 13 }}>
          <option value="newest">Newest First</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="qty_desc">Most Available</option>
        </select>
      </div>

      {isLoading && <div style={{ color: '#64748b', padding: 20 }}>Loading listings…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {(listings as any[]).map((l: any) => (
          <div key={l.id} style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${GRADE_COLOR[l.grade]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Leaf size={18} color={GRADE_COLOR[l.grade]} />
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${GRADE_COLOR[l.grade]}18`, color: GRADE_COLOR[l.grade] }}>Grade {l.grade}</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f6ff' }}>{l.crop_name}</div>
              {l.variety && <div style={{ fontSize: 12, color: '#64748b' }}>{l.variety}</div>}
              {l.org_name && <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}><Building2 size={10} />{l.org_name}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#00d4aa' }}>{fmtINR(l.price_per_kg_inr)}<span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>/kg</span></div>
                {l.bulk_discount_pct > 0 && <div style={{ fontSize: 11, color: '#f59e0b' }}>−{l.bulk_discount_pct}% on orders &gt;{l.bulk_threshold_kg}kg</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: '#f0f6ff', fontWeight: 600 }}>{l.available_kg.toFixed(0)} kg</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>available</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(l.certifications || []).slice(0, 3).map((c: string) => (
                <span key={c} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(16,185,129,0.1)', color: '#10b981', textTransform: 'uppercase' }}>{c}</span>
              ))}
              {l.origin_city && <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, background: '#1e293b', color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={8} />{l.origin_city}</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
              <span>Min order: {l.min_order_kg} kg</span>
              {l.shelf_life_days && <span>Shelf life: {l.shelf_life_days}d</span>}
              <span>{l.view_count} views</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [tab, setTab] = useState<'browse' | 'listings' | 'orders' | 'escrow' | 'analytics'>('listings')
  const { data: stats } = useQuery({ queryKey: ['mkt-stats'], queryFn: mktApi.getStats })

  const TABS = [
    { id: 'listings',  label: 'My Listings',     icon: Package },
    { id: 'orders',    label: 'Incoming Orders',  icon: ShoppingCart },
    { id: 'escrow',    label: 'Escrow & Payments', icon: ShieldCheck },
    { id: 'analytics', label: 'Analytics',        icon: BarChart2 },
    { id: 'browse',    label: 'Browse Market',    icon: Search },
  ] as const

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <ShoppingCart size={20} color="#00d4aa" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>B2B Marketplace</h1>
            </div>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              Sell produce directly to restaurants, retailers &amp; distributors. Secure escrow payments.
            </p>
          </div>
          {/* Live market stats */}
          {stats && (
            <div style={{ display: 'flex', gap: 16, background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '10px 18px' }}>
              {[
                { label: 'Active Listings', value: stats.active_listings, color: '#10b981' },
                { label: 'Buyers', value: stats.buyers_registered, color: '#3b82f6' },
                { label: 'GMV (mo)', value: fmtINR(stats.gmv_this_month_inr), color: '#00d4aa' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#060d19', borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: tab === id ? '#0c1525' : 'transparent', color: tab === id ? '#f0f6ff' : '#64748b', fontWeight: tab === id ? 600 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'listings'  && <ListingsTab />}
      {tab === 'orders'    && <OrdersTab />}
      {tab === 'escrow'    && <EscrowTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'browse'    && <BrowseTab />}
    </div>
  )
}
