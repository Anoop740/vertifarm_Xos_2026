import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  ShieldCheck, FileText, AlertTriangle, Plus, Trash2, ChevronRight,
  CheckCircle, XCircle, MinusCircle, Upload, BarChart2, Download,
  Clock, RefreshCw, Eye, FolderOpen,
} from 'lucide-react'

// ─── API ─────────────────────────────────────────────────────────
const complianceApi = {
  getSummary: () => api.get('/api/v1/compliance/summary').then(r => r.data),
  getCerts: () => api.get('/api/v1/compliance/certifications').then(r => r.data),
  createCert: (d: any) => api.post('/api/v1/compliance/certifications', d).then(r => r.data),
  updateCert: (id: string, d: any) => api.patch(`/api/v1/compliance/certifications/${id}`, d).then(r => r.data),
  deleteCert: (id: string) => api.delete(`/api/v1/compliance/certifications/${id}`).then(r => r.data),
  getGapAnalysis: (id: string) => api.get(`/api/v1/compliance/certifications/${id}/gap-analysis`).then(r => r.data),
  getAuditReport: (id: string) => api.get(`/api/v1/compliance/certifications/${id}/audit-report`).then(r => r.data),
  getDocs: () => api.get('/api/v1/compliance/documents').then(r => r.data),
  uploadDoc: (d: any) => api.post('/api/v1/compliance/documents', d).then(r => r.data),
  deleteDoc: (id: string) => api.delete(`/api/v1/compliance/documents/${id}`).then(r => r.data),
}

// ─── Helpers ─────────────────────────────────────────────────────
const CERT_LABELS: Record<string, { label: string; color: string }> = {
  organic: { label: 'Organic', color: '#10b981' },
  fssai: { label: 'FSSAI', color: '#3b82f6' },
  globalgap: { label: 'GlobalG.A.P', color: '#8b5cf6' },
  export: { label: 'Export', color: '#f59e0b' },
  iso22000: { label: 'ISO 22000', color: '#06b6d4' },
  haccp: { label: 'HACCP', color: '#ec4899' },
  other: { label: 'Other', color: '#64748b' },
}

const STATUS_STYLES: Record<string, any> = {
  active: { bg: '#10b98122', color: '#10b981', label: 'Active' },
  expired: { bg: '#ef444422', color: '#ef4444', label: 'Expired' },
  pending: { bg: '#f59e0b22', color: '#f59e0b', label: 'Pending' },
  revoked: { bg: '#6b728022', color: '#6b7280', label: 'Revoked' },
}

const GAP_STYLES: Record<string, any> = {
  pass: { icon: CheckCircle, color: '#10b981', label: 'Pass' },
  fail: { icon: XCircle, color: '#ef4444', label: 'Fail' },
  na: { icon: MinusCircle, color: '#475569', label: 'N/A' },
}

function daysLabel(days: number | null) {
  if (days === null || days === undefined) return null
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, color: '#ef4444' }
  if (days <= 30) return { label: `Expires in ${days}d ⚠️`, color: '#f59e0b' }
  return { label: `${days}d remaining`, color: '#10b981' }
}

// ─── Gap Analysis Modal ───────────────────────────────────────────
function GapModal({ certId, certName, onClose }: { certId: string; certName: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['gap', certId], queryFn: () => complianceApi.getGapAnalysis(certId) })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f6ff' }}>Gap Analysis — {certName}</div>
            {data && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{data.compliance_pct}% compliant · {data.passed} pass / {data.failed} fail / {data.not_applicable} N/A</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading…</div>
        ) : data && (
          <>
            {/* Progress bar */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
              <div style={{ height: 8, background: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${data.compliance_pct}%`, background: data.compliance_pct >= 80 ? '#10b981' : data.compliance_pct >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 8, transition: 'width 0.5s' }} />
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '12px 24px 24px' }}>
              {data.requirements.map((r: any, i: number) => {
                const st = GAP_STYLES[r.status]
                const Icon = st.icon
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
                    <Icon size={16} color={st.color} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#f0f6ff' }}>{r.requirement}</div>
                      {r.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{r.notes}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: st.color, padding: '2px 8px', borderRadius: 4, background: `${st.color}22` }}>{st.label}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Add Cert Modal ───────────────────────────────────────────────
function AddCertModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({ cert_type: 'fssai', name: '', issuing_body: '', cert_number: '', issued_at: '', expires_at: '' })
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16, width: '100%', maxWidth: 520, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f6ff', marginBottom: 20 }}>Add Certification</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Type</label>
          <select value={form.cert_type} onChange={set('cert_type')} style={{ width: '100%', background: '#060d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 12px', color: '#f0f6ff', fontSize: 14 }}>
            {Object.entries(CERT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        {[
          { k: 'name', label: 'Certificate Name', ph: 'e.g. FSSAI Basic Licence 2027' },
          { k: 'issuing_body', label: 'Issuing Body', ph: 'e.g. FSSAI, APEDA, Control Union' },
          { k: 'cert_number', label: 'Certificate Number', ph: 'Optional' },
          { k: 'issued_at', label: 'Issue Date', type: 'date' },
          { k: 'expires_at', label: 'Expiry Date', type: 'date' },
        ].map(({ k, label, ph, type }) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>{label}</label>
            <input type={type || 'text'} placeholder={ph} value={(form as any)[k]} onChange={set(k)}
              style={{ width: '100%', background: '#060d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '9px 12px', color: '#f0f6ff', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={() => onSave({ ...form, issued_at: form.issued_at || undefined, expires_at: form.expires_at || undefined })}
            disabled={!form.name || !form.issuing_body}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#00d4aa', color: '#060d19', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            Add Certification
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function CompliancePage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'certs' | 'documents'>('certs')
  const [gapModal, setGapModal] = useState<{ id: string; name: string } | null>(null)
  const [addModal, setAddModal] = useState(false)

  const { data: summary } = useQuery({ queryKey: ['compliance-summary'], queryFn: complianceApi.getSummary })
  const { data: certs = [], isLoading } = useQuery({ queryKey: ['certifications'], queryFn: complianceApi.getCerts })
  const { data: docs = [] } = useQuery({ queryKey: ['compliance-docs'], queryFn: complianceApi.getDocs, enabled: tab === 'documents' })

  const createMutation = useMutation({
    mutationFn: complianceApi.createCert,
    onSuccess: () => { toast.success('Certification added'); qc.invalidateQueries({ queryKey: ['certifications'] }); setAddModal(false) },
    onError: () => toast.error('Failed to add certification'),
  })
  const deleteMutation = useMutation({
    mutationFn: complianceApi.deleteCert,
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['certifications'] }) },
  })

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <ShieldCheck size={20} color="#00d4aa" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f0f6ff', margin: 0 }}>Compliance & Certifications</h1>
        </div>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Manage organic, FSSAI, GlobalG.A.P, and export certifications. Auto-populate audit reports from farm data.</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Active', value: summary.active, color: '#10b981', icon: ShieldCheck },
            { label: 'Expiring (30d)', value: summary.expiring_30_days, color: '#f59e0b', icon: AlertTriangle },
            { label: 'Expired', value: summary.expired, color: '#ef4444', icon: XCircle },
            { label: 'Documents', value: summary.total_documents, color: '#3b82f6', icon: FolderOpen },
            { label: 'Overall Compliance', value: `${summary.overall_compliance_pct}%`, color: '#00d4aa', icon: BarChart2 },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, marginBottom: 8 }}>
                <Icon size={12} /> {label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 4, background: '#060d19', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {(['certs', 'documents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: tab === t ? '#0c1525' : 'transparent', color: tab === t ? '#f0f6ff' : '#64748b', fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: 'pointer' }}>
              {t === 'certs' ? 'Certifications' : 'Document Vault'}
            </button>
          ))}
        </div>
        {tab === 'certs' && (
          <button onClick={() => setAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#00d4aa', borderRadius: 8, border: 'none', color: '#060d19', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={14} /> Add Certification
          </button>
        )}
      </div>

      {/* Certifications list */}
      {tab === 'certs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoading && <div style={{ color: '#64748b', padding: 20 }}>Loading…</div>}
          {(certs as any[]).map((cert: any) => {
            const certMeta = CERT_LABELS[cert.cert_type] || CERT_LABELS.other
            const statusStyle = STATUS_STYLES[cert.status] || STATUS_STYLES.pending
            const expiry = daysLabel(cert.days_until_expiry)
            return (
              <div key={cert.id} style={{ background: '#0c1525', border: `1px solid ${cert.days_until_expiry !== null && cert.days_until_expiry <= 30 ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.12)'}`, borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${certMeta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={18} color={certMeta.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f6ff' }}>{cert.name}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${certMeta.color}22`, color: certMeta.color }}>{certMeta.label}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                    {cert.issuing_body} {cert.cert_number && `· #${cert.cert_number}`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {cert.issued_at && <span style={{ fontSize: 12, color: '#475569' }}>Issued: {new Date(cert.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    {cert.expires_at && expiry && <span style={{ fontSize: 12, color: expiry.color, fontWeight: 500 }}>{expiry.label}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setGapModal({ id: cert.id, name: cert.name })} title="Gap Analysis"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
                    <BarChart2 size={12} /> Gap Analysis
                  </button>
                  <button onClick={() => deleteMutation.mutate(cert.id)} title="Delete"
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Document Vault */}
      {tab === 'documents' && (
        <div>
          <div style={{ background: '#0c1525', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                  {['Document', 'Type', 'Size', 'Expiry', 'Tags', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(docs as any[]).map((doc: any, i: number) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={14} color="#64748b" />
                        <span style={{ fontSize: 13, color: '#f0f6ff', fontWeight: 500 }}>{doc.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: '#1e293b', color: '#94a3b8', textTransform: 'capitalize' }}>{doc.doc_type.replace('_', ' ')}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>
                      {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(0)} KB` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: doc.expiry_date && new Date(doc.expiry_date) < new Date(Date.now() + 30 * 86400000) ? '#f59e0b' : '#64748b' }}>
                      {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(doc.tags || []).map((t: string) => (
                          <span key={t} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, background: 'rgba(0,212,170,0.1)', color: '#00d4aa' }}>{t}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <button style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}><Eye size={12} /></button>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {gapModal && <GapModal certId={gapModal.id} certName={gapModal.name} onClose={() => setGapModal(null)} />}
      {addModal && <AddCertModal onClose={() => setAddModal(false)} onSave={d => createMutation.mutate(d)} />}
    </div>
  )
}
