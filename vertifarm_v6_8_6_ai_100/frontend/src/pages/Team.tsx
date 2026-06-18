import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teamApi, billingApi } from '@/lib/api'
import { Button, Badge, Modal, Input, Select, StatCard, ConfirmModal, EmptyState } from '@/components/ui'
import { Users, UserPlus, Mail, Shield, Clock, Trash2, Edit2, RefreshCw, CheckCircle2, AlertCircle, Copy, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { relativeTime } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const ROLE_OPTIONS = [
  { value:'org_admin',    label:'Admin — Full access, can manage team and billing' },
  { value:'farm_manager', label:'Farm Manager — Manage farms, zones, and crops' },
  { value:'operator',     label:'Operator — Operate devices and log harvests' },
  { value:'viewer',       label:'Viewer — Read-only access' },
]

const ROLE_BADGE: Record<string,any> = {
  superadmin:'purple', org_admin:'blue', farm_manager:'teal', operator:'green', viewer:'gray'
}

function InviteModal({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('operator')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  const handleInvite = async () => {
    if (!email.trim()) { setError('Email is required'); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email'); return }
    setLoading(true); setError('')
    try {
      const res = await teamApi.invite(email.trim(), role)
      setResult(res)
      qc.invalidateQueries({ queryKey:['team-invites'] })
      toast.success(`Invitation sent to ${email}`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Failed to send invitation')
    } finally { setLoading(false) }
  }

  const handleClose = () => { setEmail(''); setRole('operator'); setError(''); setResult(null); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Invite Team Member" size="md"
      footer={!result ? (
        <><Button variant="ghost" onClick={handleClose}>Cancel</Button><Button variant="primary" onClick={handleInvite} loading={loading}><Mail className="w-3.5 h-3.5"/> Send Invitation</Button></>
      ) : (
        <Button variant="primary" onClick={handleClose}>Done</Button>
      )}>
      {!result ? (
        <div className="space-y-4">
          <Input label="Email Address" type="email" placeholder="colleague@company.com"
            value={email} onChange={e => { setEmail(e.target.value); setError('') }} error={error}/>
          <Select label="Role" options={ROLE_OPTIONS} value={role} onChange={e => setRole(e.target.value)}/>
          <div style={{ padding:'10px 12px', borderRadius:8, background:'var(--bg3)', border:'1px solid var(--border)', fontSize:11, color:'var(--text3)', lineHeight:1.6 }}>
            An invitation email will be sent. The link expires in <strong>72 hours</strong>.
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'16px 0' }}>
          <CheckCircle2 size={40} color="#00e87a" style={{ margin:'0 auto 14px', display:'block' }}/>
          <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:8 }}>Invitation sent!</h3>
          <p style={{ fontSize:12, color:'var(--text3)', marginBottom:20, lineHeight:1.6 }}>
            <strong style={{color:'var(--text)'}}>{result.email}</strong> will receive an email with the invite link.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:9, background:'var(--bg3)', border:'1px solid var(--border)', fontSize:11, fontFamily:'DM Mono,monospace', color:'var(--text3)', wordBreak:'break-all' }}>
            <span style={{ flex:1, textAlign:'left' }}>{result.accept_url}</span>
            <button onClick={() => { navigator.clipboard.writeText(result.accept_url); toast.success('Link copied!') }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', flexShrink:0 }}>
              <Copy size={13}/>
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function MemberRow({ member, isSelf, onRoleChange, onRemove }: any) {
  const [editRole, setEditRole] = useState(false)
  const [newRole, setNewRole] = useState(member.role)
  const [updating, setUpdating] = useState(false)
  const qc = useQueryClient()

  const handleRoleSave = async () => {
    setUpdating(true)
    try {
      await teamApi.updateMember(member.id, { role: newRole })
      qc.invalidateQueries({ queryKey:['team'] })
      toast.success('Role updated')
      setEditRole(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update role')
    } finally { setUpdating(false) }
  }

  return (
    <tr>
      <td>
        <div className="flex items-center gap-3">
          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#00d4aa,#00b892)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#030c14', flexShrink:0 }}>
            {member.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{member.full_name}</span>
              {isSelf && <span className="badge badge-teal" style={{ fontSize:9 }}>You</span>}
              {!member.email_verified && <span title="Email not verified"><AlertCircle size={11} color="#ffb547"/></span>}
            </div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>{member.email}</div>
          </div>
        </div>
      </td>
      <td>
        {editRole && !isSelf ? (
          <div className="flex items-center gap-2">
            <select value={newRole} onChange={e => setNewRole(e.target.value)}
              style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--text)', outline:'none' }}>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.value.replace(/_/g,' ')}</option>)}
            </select>
            <button onClick={handleRoleSave} disabled={updating} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--green)' }}>
              <CheckCircle2 size={14}/>
            </button>
            <button onClick={() => { setEditRole(false); setNewRole(member.role) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}>✕</button>
          </div>
        ) : (
          <Badge variant={ROLE_BADGE[member.role] ?? 'gray'}>{member.role?.replace(/_/g,' ')}</Badge>
        )}
      </td>
      <td>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color: member.is_active ? 'var(--green)' : 'var(--text3)' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background: member.is_active ? 'var(--green-light)' : 'var(--text3)', display:'inline-block' }}/>
          {member.is_active ? 'Active' : 'Deactivated'}
        </div>
      </td>
      <td><span style={{ fontSize:11, color:'var(--text3)' }}>{member.last_login ? relativeTime(member.last_login) : 'Never'}</span></td>
      <td>
        {!isSelf && (
          <div className="flex gap-1">
            <button onClick={() => setEditRole(true)} className="btn-ghost btn-sm p-1.5" title="Change role"><Edit2 className="w-3.5 h-3.5"/></button>
            <button onClick={() => onRemove(member)} className="btn-ghost btn-sm p-1.5" title="Remove member" style={{color:'var(--red-light)'}}><Trash2 className="w-3.5 h-3.5"/></button>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function TeamPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [showInvite, setShowInvite] = useState(false)
  const [removeMember, setRemoveMember] = useState<any>(null)
  const [revokeInvite, setRevokeInvite] = useState<any>(null)
  const [removing, setRemoving] = useState(false)

  const { data: members = [], isLoading } = useQuery({ queryKey:['team'], queryFn: teamApi.list })
  const { data: invites  = [] } = useQuery({ queryKey:['team-invites'], queryFn: teamApi.listInvites })
  const { data: billing  } = useQuery({ queryKey:['billing'], queryFn: billingApi.get })

  const usersLimit = (billing as any)?.usage?.users
  const atLimit = usersLimit && usersLimit.limit !== -1 && usersLimit.used >= usersLimit.limit

  const handleRemove = async () => {
    if (!removeMember) return
    setRemoving(true)
    try {
      await teamApi.removeMember(removeMember.id)
      qc.invalidateQueries({ queryKey:['team'] })
      toast.success(`${removeMember.full_name} removed from team`)
      setRemoveMember(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to remove member')
    } finally { setRemoving(false) }
  }

  const handleRevokeInvite = async () => {
    if (!revokeInvite) return
    try {
      await teamApi.revokeInvite(revokeInvite.id)
      qc.invalidateQueries({ queryKey:['team-invites'] })
      toast.success('Invitation revoked')
      setRevokeInvite(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to revoke')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize:16, fontWeight:800, color:'var(--text)', fontFamily:"'Syne',sans-serif" }}>Team Management</h1>
          <p className="text-xs text-muted mt-0.5">Invite colleagues, manage roles, and control access permissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { qc.invalidateQueries({queryKey:['team']}); qc.invalidateQueries({queryKey:['team-invites']}) }}><RefreshCw className="w-3.5 h-3.5"/></Button>
          {atLimit ? (
            <Button variant="secondary" onClick={() => window.location.href='/billing'} title="Upgrade to invite more members">
              <Shield className="w-3.5 h-3.5"/> Upgrade to Invite
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-3.5 h-3.5"/> Invite Member
            </Button>
          )}
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Team Members" value={(members as any[]).length} icon={Users} accent="blue" sub={usersLimit ? `${usersLimit.used} / ${usersLimit.limit === -1 ? '∞' : usersLimit.limit} seats` : ''}/>
        <StatCard label="Pending Invites" value={(invites as any[]).filter((i:any) => !i.expired).length} icon={Mail} accent="amber"/>
        <StatCard label="Active Members" value={(members as any[]).filter((m:any) => m.is_active).length} icon={CheckCircle2} accent="green"/>
      </div>

      {/* members table */}
      <div className="card overflow-hidden">
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', fontFamily:"'Syne',sans-serif" }}>Members ({(members as any[]).length})</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted">Loading team...</div>
        ) : (members as any[]).length === 0 ? (
          <div className="p-8"><EmptyState icon={Users} title="No team members" message="Invite colleagues to collaborate on your farms."/></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Last Active</th><th>Actions</th></tr></thead>
              <tbody>
                {(members as any[]).map((m: any) => (
                  <MemberRow key={m.id} member={m} isSelf={m.id === user?.id} onRemove={setRemoveMember} onRoleChange={() => {}}/>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* pending invites */}
      {(invites as any[]).length > 0 && (
        <div className="card overflow-hidden">
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', fontFamily:"'Syne',sans-serif" }}>Pending Invitations ({(invites as any[]).length})</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Email</th><th>Role</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {(invites as any[]).map((inv: any) => (
                  <tr key={inv.id}>
                    <td><span style={{ fontSize:12, color:'var(--text)' }}>{inv.email}</span></td>
                    <td><Badge variant={ROLE_BADGE[inv.role] ?? 'gray'}>{inv.role?.replace(/_/g,' ')}</Badge></td>
                    <td><span style={{ fontSize:11, color: inv.expired ? 'var(--red-light)' : 'var(--text3)' }}>{inv.expired ? 'Expired' : new Date(inv.expires_at).toLocaleDateString('en-IN')}</span></td>
                    <td><Badge variant={inv.expired ? 'red' : 'amber'}>{inv.expired ? 'expired' : 'pending'}</Badge></td>
                    <td>
                      <button onClick={() => setRevokeInvite(inv)} className="btn-ghost btn-sm p-1.5" title="Revoke" style={{color:'var(--red-light)'}}>
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* modals */}
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)}/>
      <ConfirmModal open={!!removeMember} onClose={() => setRemoveMember(null)} onConfirm={handleRemove}
        title="Remove team member" danger loading={removing}
        message={`Remove ${removeMember?.full_name} (${removeMember?.email}) from your organization? They will lose access immediately.`}
        confirmLabel="Remove Member"/>
      <ConfirmModal open={!!revokeInvite} onClose={() => setRevokeInvite(null)} onConfirm={handleRevokeInvite}
        title="Revoke invitation" danger
        message={`Revoke the pending invitation to ${revokeInvite?.email}? They will no longer be able to join.`}
        confirmLabel="Revoke"/>
    </div>
  )
}
