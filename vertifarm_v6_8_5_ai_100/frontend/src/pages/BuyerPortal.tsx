import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  Leaf, Download, CheckCircle2, XCircle,
  Calendar, Droplets, Award, FlaskConical, QrCode, Loader2
} from 'lucide-react'

const S = {
  page:    { minHeight: '100vh', background: 'linear-gradient(135deg,#03100a 0%,#071a10 50%,#03100a 100%)', padding: '40px 20px', fontFamily: 'Inter,sans-serif' } as React.CSSProperties,
  wrap:    { maxWidth: 680, margin: '0 auto' } as React.CSSProperties,
  logo:    { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' as const } as React.CSSProperties,
  card:    { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 } as React.CSSProperties,
  row:     { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' } as React.CSSProperties,
  label:   { fontSize: 12, color: '#6b8f7e', width: 160, flexShrink: 0 } as React.CSSProperties,
  value:   { fontSize: 13, color: '#e8f4f0', fontWeight: 500, flex: 1 } as React.CSSProperties,
  tag:     { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginRight: 6 } as React.CSSProperties,
  sectionHead: { fontSize: 13, fontWeight: 700, color: '#00d4aa', letterSpacing: '0.08em', textTransform: 'uppercase' as const, padding: '14px 20px 4px', opacity: 0.8 } as React.CSSProperties,
  btn:     { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 } as React.CSSProperties,
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={S.row}>
      {icon && <span style={{ color: '#00d4aa', flexShrink: 0 }}>{icon}</span>}
      <span style={S.label}>{label}</span>
      <span style={S.value}>{value}</span>
    </div>
  )
}

function SearchForm({ onSearch }: { onSearch: (code: string) => void }) {
  const [val, setVal] = useState('')
  // Grab batch from URL ?batch=...
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const b = p.get('batch')
    if (b) { setVal(b); onSearch(b) }
  }, [])

  return (
    <div style={{ ...S.card, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
      <h2 style={{ color: '#e8f4f0', margin: '0 0 8px', fontSize: 22 }}>Crop Traceability Lookup</h2>
      <p style={{ color: '#6b8f7e', fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>
        Enter a batch code or scan the QR code on the packaging to view full traceability information.
      </p>
      <div style={{ display: 'flex', gap: 10, maxWidth: 400, margin: '0 auto' }}>
        <input
          style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 10, padding: '11px 16px', color: '#e8f4f0', fontSize: 14, outline: 'none' }}
          placeholder="e.g. BATCH-2026-001"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && val && onSearch(val.trim())}
        />
        <button
          style={{ ...S.btn, background: 'linear-gradient(135deg,#00d4aa,#00b894)', color: '#003d29', padding: '11px 20px' }}
          onClick={() => val && onSearch(val.trim())}
        >
          <QrCode size={16} /> Look Up
        </button>
      </div>
    </div>
  )
}

export default function BuyerPortal() {
  const [batchCode, setBatchCode] = useState<string | null>(null)
  const [data, setData]           = useState<any>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const search = async (code: string) => {
    setBatchCode(code)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await api.get(`/api/v1/public/trace/${code}`)
      setData(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Batch not found. Please check the code and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Logo */}
        <div style={S.logo}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#00d4aa,#0066ff)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🌱</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#e8f4f0' }}>VertiFarm OS</span>
          <span style={{ fontSize: 12, color: '#6b8f7e', marginLeft: 4, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 20, padding: '2px 10px' }}>Buyer Portal</span>
        </div>

        <SearchForm onSearch={search} />

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader2 size={32} style={{ color: '#00d4aa', animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: '#6b8f7e' }}>Loading traceability data…</p>
          </div>
        )}

        {error && (
          <div style={{ ...S.card, padding: 28, textAlign: 'center', borderColor: 'rgba(255,77,109,0.2)' }}>
            <XCircle size={32} style={{ color: '#ff4d6d', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: '#ff4d6d', margin: 0, fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Hero */}
            <div style={{ background: 'linear-gradient(135deg,rgba(0,212,170,0.12),rgba(0,102,255,0.08))', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(0,212,170,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>🥬</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h2 style={{ margin: 0, color: '#e8f4f0', fontSize: 22 }}>{data.crop_name ?? 'Produce Batch'}</h2>
                  <span style={{ ...S.tag, background: 'rgba(0,212,170,0.15)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }}>
                    <CheckCircle2 size={11} style={{ marginRight: 4 }} /> Verified
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#6b8f7e', marginBottom: 12 }}>
                  Batch: <strong style={{ color: '#c0d8ce', fontFamily: 'monospace' }}>{data.batch_code}</strong>
                  {' · '}Farm: <strong style={{ color: '#c0d8ce' }}>{data.farm_name}</strong>
                </div>
                {(data.certifications || []).map((c: string) => (
                  <span key={c} style={{ ...S.tag, background: 'rgba(0,212,170,0.1)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.2)' }}>{c}</span>
                ))}
              </div>
            </div>

            {/* Farm info */}
            <div style={S.card}>
              <div style={S.sectionHead}>Farm Information</div>
              <InfoRow icon={<Leaf size={15} />}    label="Farm"         value={data.farm_name} />
              <InfoRow icon={<Leaf size={15} />}    label="Zone / Section" value={data.zone || '—'} />
              <InfoRow icon={<Droplets size={15} />} label="Grow Method"  value={data.grow_method || '—'} />
              <InfoRow icon={<Droplets size={15} />} label="Water Source" value={data.water_source || '—'} />
            </div>

            {/* Timeline */}
            <div style={S.card}>
              <div style={S.sectionHead}>Crop Timeline</div>
              <InfoRow icon={<Calendar size={15} />} label="Sow Date"
                value={data.sow_date ? new Date(data.sow_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
              <InfoRow icon={<Calendar size={15} />} label="Harvest Date"
                value={data.harvest_date ? new Date(data.harvest_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
              <InfoRow
                icon={<FlaskConical size={15} />}
                label="Nutrients Used"
                value={
                  data.nutrients_used?.length
                    ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {data.nutrients_used.map((n: string) => (
                          <span key={n} style={{ ...S.tag, background: 'rgba(124,111,255,0.1)', color: '#7c6fff', border: '1px solid rgba(124,111,255,0.2)' }}>{n}</span>
                        ))}
                      </div>
                    : '—'
                }
              />
            </div>

            {/* Certifications */}
            {data.certifications?.length > 0 && (
              <div style={S.card}>
                <div style={S.sectionHead}>Certifications</div>
                <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {data.certifications.map((c: string) => (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)' }}>
                      <Award size={15} style={{ color: '#00d4aa' }} />
                      <span style={{ color: '#e8f4f0', fontWeight: 600, fontSize: 13 }}>{c}</span>
                      <CheckCircle2 size={13} style={{ color: '#00d4aa' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lab test results */}
            {data.test_results && Object.keys(data.test_results).length > 0 && (
              <div style={S.card}>
                <div style={S.sectionHead}>Lab Test Results</div>
                {Object.entries(data.test_results).map(([k, v]) => (
                  <InfoRow key={k} icon={<FlaskConical size={15} />} label={k} value={String(v)} />
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <a
                href={data.pdf_url}
                target="_blank"
                style={{ ...S.btn, background: 'linear-gradient(135deg,#00d4aa,#00b894)', color: '#003d29', textDecoration: 'none', flex: '1 1 200px', justifyContent: 'center' }}
              >
                <Download size={16} /> Download Traceability Certificate (PDF)
              </a>
              <a
                href={data.qr_url}
                target="_blank"
                style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: '#a0c4b4', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none', justifyContent: 'center' }}
              >
                <QrCode size={16} /> View QR Code
              </a>
            </div>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#4a6a5a', marginTop: 28 }}>
              Powered by VertiFarm OS · Farm-to-Table Traceability Platform
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
