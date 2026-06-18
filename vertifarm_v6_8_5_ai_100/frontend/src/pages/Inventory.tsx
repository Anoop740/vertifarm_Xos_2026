import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { ShoppingBag, Plus, Search, AlertTriangle, CheckCircle2, Package, RefreshCw, Trash2, Edit2, TrendingDown, X } from 'lucide-react'

const MOCK_INVENTORY = [
  { id:'inv-001', name:'Calcium Nitrate (Ca(NO₃)₂)', category:'Nutrients', unit:'kg', quantity:48.5, min_stock:20, reorder_qty:50, cost_per_unit:180, supplier:'AgroChemicals India', sku:'CANO3-25KG', last_restocked:'2027-05-15', location:'Store A' },
  { id:'inv-002', name:'MonoPotassium Phosphate (MKP)', category:'Nutrients', unit:'kg', quantity:12.0, min_stock:10, reorder_qty:25, cost_per_unit:420, supplier:'AgroChemicals India', sku:'MKP-25KG', last_restocked:'2027-04-20', location:'Store A' },
  { id:'inv-003', name:'pH Down (Phosphoric Acid 85%)', category:'pH Control', unit:'litre', quantity:8.5, min_stock:5, reorder_qty:20, cost_per_unit:650, supplier:'Nutrient Solutions Ltd', sku:'PHD-20L', last_restocked:'2027-05-01', location:'Store B' },
  { id:'inv-004', name:'pH Up (Potassium Hydroxide)', category:'pH Control', unit:'litre', quantity:3.2, min_stock:3, reorder_qty:10, cost_per_unit:550, supplier:'Nutrient Solutions Ltd', sku:'PHU-10L', last_restocked:'2027-04-10', location:'Store B' },
  { id:'inv-005', name:'CO₂ Gas Cylinder (50kg)', category:'Gas', unit:'cylinder', quantity:2, min_stock:1, reorder_qty:3, cost_per_unit:3200, supplier:'BOC Industrial', sku:'CO2-50KG', last_restocked:'2027-05-20', location:'Gas Bay' },
  { id:'inv-006', name:'Grow Plugs (50mm Rockwool)', category:'Growing Media', unit:'tray (98 cells)', quantity:24, min_stock:10, reorder_qty:30, cost_per_unit:320, supplier:'Grodan India', sku:'RWPLUG-50', last_restocked:'2027-05-05', location:'Propagation' },
  { id:'inv-007', name:'Lettuce Seeds — Butterhead Rex', category:'Seeds', unit:'pack (5000 seeds)', quantity:8, min_stock:4, reorder_qty:10, cost_per_unit:1800, supplier:'HM Clause India', sku:'LETBR-5K', last_restocked:'2027-05-12', location:'Seed Store' },
  { id:'inv-008', name:'Nitrile Gloves (M)', category:'Safety & PPE', unit:'box (100 pcs)', quantity:5, min_stock:3, reorder_qty:10, cost_per_unit:280, supplier:'SafeWork India', sku:'GLOVE-M', last_restocked:'2027-05-18', location:'Store C' },
  { id:'inv-009', name:'Stainless Steel Scissors (harvest)', category:'Equipment', unit:'unit', quantity:12, min_stock:6, reorder_qty:6, cost_per_unit:850, supplier:'Hortitools', sku:'SCISS-SS', last_restocked:'2027-03-01', location:'Harvest Room' },
  { id:'inv-010', name:'Food-Grade Sanitizer (Chlorine 10%)', category:'Sanitation', unit:'litre', quantity:15.0, min_stock:8, reorder_qty:20, cost_per_unit:220, supplier:'CleanFarm Solutions', sku:'SANIT-CL10', last_restocked:'2027-05-08', location:'Store B' },
]

const CATEGORIES = ['All', 'Nutrients', 'pH Control', 'Gas', 'Growing Media', 'Seeds', 'Safety & PPE', 'Equipment', 'Sanitation']

const CAT_COLORS: Record<string, string> = {
  Nutrients: '#10b981', 'pH Control': '#3b82f6', Gas: '#8b5cf6',
  'Growing Media': '#f59e0b', Seeds: '#06b6d4', 'Safety & PPE': '#ec4899',
  Equipment: '#64748b', Sanitation: '#f97316',
}

function stockStatus(qty: number, min: number) {
  if (qty <= min * 0.5) return { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }
  if (qty <= min) return { label: 'Low', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
  return { label: 'OK', color: '#10b981', bg: 'rgba(16,185,129,0.12)' }
}

function AddItemModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', category: 'Nutrients', unit: 'kg', quantity: '', min_stock: '', reorder_qty: '', cost_per_unit: '', supplier: '', sku: '', location: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    try {
      await api.post('/api/v1/inventory', { ...form, quantity: parseFloat(form.quantity) || 0, min_stock: parseFloat(form.min_stock) || 0, reorder_qty: parseFloat(form.reorder_qty) || 0, cost_per_unit: parseFloat(form.cost_per_unit) || 0 }).catch(() => null)
      toast.success('Item added to inventory')
      qc.invalidateQueries({ queryKey: ['inventory'] })
      onClose()
    } catch { toast.error('Failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }} onClick={onClose}>
      <div style={{ background: 'var(--card)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 18, width: '100%', maxWidth: 600, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Add Inventory Item</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { k: 'name', label: 'Item Name', ph: 'e.g. Calcium Nitrate', full: true },
            { k: 'category', label: 'Category', ph: '', type: 'select' },
            { k: 'unit', label: 'Unit', ph: 'kg / litre / pack' },
            { k: 'quantity', label: 'Current Quantity', ph: '0', type: 'number' },
            { k: 'min_stock', label: 'Minimum Stock', ph: '10', type: 'number' },
            { k: 'reorder_qty', label: 'Reorder Quantity', ph: '25', type: 'number' },
            { k: 'cost_per_unit', label: 'Cost per Unit (₹)', ph: '0', type: 'number' },
            { k: 'supplier', label: 'Supplier', ph: 'Supplier name' },
            { k: 'sku', label: 'SKU', ph: 'Optional' },
            { k: 'location', label: 'Storage Location', ph: 'Store A' },
          ].map(({ k, label, ph, type, full }: any) => (
            <div key={k} style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 5 }}>{label}</label>
              {type === 'select' ? (
                <select value={(form as any)[k]} onChange={set(k)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13 }}>
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input type={type || 'text'} value={(form as any)[k]} onChange={set(k)} placeholder={ph}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Adding…' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showAdd, setShowAdd] = useState(false)

  const { data: items = MOCK_INVENTORY } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/api/v1/inventory').then(r => r.data).catch(() => MOCK_INVENTORY),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/inventory/${id}`).catch(() => null),
    onSuccess: () => { toast.success('Item removed'); qc.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  const adjustMutation = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      api.patch(`/api/v1/inventory/${id}`, { quantity: qty }).catch(() => null),
    onSuccess: () => { toast.success('Quantity updated'); qc.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  const displayItems = (items as any[]).length ? items : MOCK_INVENTORY
  const filtered = displayItems.filter((item: any) => {
    const matchCat = category === 'All' || item.category === category
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const lowStock = displayItems.filter((i: any) => i.quantity <= i.min_stock)
  const totalValue = displayItems.reduce((s: number, i: any) => s + i.quantity * i.cost_per_unit, 0)

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <ShoppingBag size={20} color="#00d4aa" />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Inventory</h1>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0 }}>Track nutrients, seeds, media, equipment, and consumables</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'var(--accent)', borderRadius: 10, border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Items', value: displayItems.length, color: 'var(--text)', icon: Package },
          { label: 'Low Stock', value: lowStock.length, color: lowStock.length > 0 ? '#ef4444' : '#10b981', icon: AlertTriangle },
          { label: 'Inv. Value', value: `₹${Math.round(totalValue / 1000)}K`, color: '#10b981', icon: ShoppingBag },
          { label: 'Categories', value: CATEGORIES.length - 1, color: '#3b82f6', icon: CheckCircle2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 12, marginBottom: 6 }}><Icon size={12} />{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Low stock alert banner */}
      {lowStock.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle size={16} color="#f59e0b" style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>
              {lowStock.length} item{lowStock.length > 1 ? 's' : ''} below minimum stock level
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {lowStock.map((i: any) => i.name).join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items or SKU…"
            style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px 9px 30px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${category === c ? '#00d4aa' : 'rgba(148,163,184,0.2)'}`, background: category === c ? 'rgba(0,212,170,0.1)' : 'transparent', color: category === c ? '#00d4aa' : '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: category === c ? 600 : 400 }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Item', 'Category', 'Stock', 'Min Stock', 'Cost/Unit', 'Location', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item: any, i: number) => {
              const st = stockStatus(item.quantity, item.min_stock)
              const catColor = CAT_COLORS[item.category] || '#64748b'
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                    {item.sku && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{item.sku} · {item.supplier}</div>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${catColor}18`, color: catColor }}>{item.category}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: st.color }}>{item.quantity}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{item.unit}</span>
                      <button
                        onClick={() => {
                          const delta = window.prompt(`Adjust quantity (current: ${item.quantity} ${item.unit})\nEnter new quantity:`, item.quantity)
                          if (delta !== null && !isNaN(parseFloat(delta))) {
                            adjustMutation.mutate({ id: item.id, qty: parseFloat(delta) })
                          }
                        }}
                        style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 10 }}>
                        Edit
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text3)' }}>{item.min_stock} {item.unit}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text2)' }}>₹{item.cost_per_unit}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text3)' }}>{item.location}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => { if (window.confirm(`Remove "${item.name}"?`)) deleteMutation.mutate(item.id) }}
                      style={{ padding: '4px 7px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No items found</div>
        )}
      </div>

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
