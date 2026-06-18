import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('No refresh token')
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refresh_token: refresh })
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }).then(r => r.data),
}

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats').then(r => r.data),
}

export const farmsApi = {
  list: () => api.get('/farms').then(r => r.data),
  get: (id: string) => api.get(`/farms/${id}`).then(r => r.data),
  create: (d: any) => api.post('/farms', d).then(r => r.data),
  update: (id: string, d: any) => api.patch(`/farms/${id}`, d).then(r => r.data),
  delete: (id: string) => api.delete(`/farms/${id}`).then(r => r.data),
}

export const zonesApi = {
  list: (farmId?: string) => api.get('/zones', { params: { farm_id: farmId } }).then(r => r.data),
  get: (id: string) => api.get(`/zones/${id}`).then(r => r.data),
  create: (d: any) => api.post('/zones', d).then(r => r.data),
  update: (id: string, d: any) => api.patch(`/zones/${id}`, d).then(r => r.data),
  delete: (id: string) => api.delete(`/zones/${id}`).then(r => r.data),
}

export const sensorsApi = {
  summary: (zoneId: string) => api.get(`/sensors/summary/${zoneId}`).then(r => r.data),
  history: (zoneId: string, type: string, hours = 24) =>
    api.get(`/sensors/history/${zoneId}`, { params: { sensor_type: type, hours } }).then(r => r.data),
  ingest: (d: any) => api.post('/sensors/readings', d).then(r => r.data),
}

export const alertsApi = {
  list: (params?: any) => api.get('/alerts', { params }).then(r => r.data),
  resolve: (id: string) => api.patch(`/alerts/${id}/resolve`).then(r => r.data),
  create: (d: any) => api.post('/alerts', d).then(r => r.data),
}

export const cropsApi = {
  list: (params?: any) => api.get('/crops', { params }).then(r => r.data),
  create: (d: any) => api.post('/crops', d).then(r => r.data),
  update: (id: string, d: any) => api.patch(`/crops/${id}`, d).then(r => r.data),
}

export const recipesApi = {
  list: () => api.get('/recipes').then(r => r.data),
  get: (id: string) => api.get(`/recipes/${id}`).then(r => r.data),
  create: (d: any) => api.post('/recipes', d).then(r => r.data),
  update: (id: string, d: any) => api.patch(`/recipes/${id}`, d).then(r => r.data),
}

export const devicesApi = {
  list: (farmId?: string) => api.get('/devices', { params: { farm_id: farmId } }).then(r => r.data),
  create: (d: any) => api.post('/devices', d).then(r => r.data),
  update: (id: string, d: any) => api.patch(`/devices/${id}`, d).then(r => r.data),
  delete: (id: string) => api.delete(`/devices/${id}`).then(r => r.data),
}

export const aiApi = {
  yieldForecast: (farmId?: string) => api.get('/ai/yield-forecast', { params: { farm_id: farmId } }).then(r => r.data),
  climateOptimize: (farmId?: string) => api.get('/ai/climate-optimize', { params: { farm_id: farmId } }).then(r => r.data),
  diseaseRisk: () => api.get('/ai/disease-risk').then(r => r.data),
  energyOptimize: () => api.get('/ai/energy-optimize').then(r => r.data),
  // FIX-3: Real AI Copilot — calls backend LLM proxy, never exposes API key to browser
  chat: (message: string, history: { role: string; content: string }[] = []) =>
    api.post('/ai/chat', { message, history }).then(r => r.data),
}

export const analyticsApi = {
  yieldTrend: (days = 30) => api.get('/analytics/yield-trend', { params: { days } }).then(r => r.data),
  waterUsage: (days = 7) => api.get('/analytics/water-usage', { params: { days } }).then(r => r.data),
}

export const harvestApi = {
  list: (params?: any) => api.get('/harvests', { params }).then(r => r.data),
  create: (d: any) => api.post('/harvests', d).then(r => r.data),
}

// ── Phase 1: Auth Extended ───────────────────────────────────────
export const signupApi = {
  register: (d: any) => api.post('/auth/signup', d).then(r => r.data),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }).then(r => r.data),
  resendVerify: () => api.post('/auth/resend-verify').then(r => r.data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword: (token: string, new_password: string) => api.post('/auth/reset-password', { token, new_password }).then(r => r.data),
  changePassword: (current_password: string, new_password: string) => api.post('/auth/change-password', { current_password, new_password }).then(r => r.data),
}

// ── Phase 1: Billing ─────────────────────────────────────────────
export const billingApi = {
  get: () => api.get('/billing').then(r => r.data),
  invoices: (limit?: number) => api.get('/billing/invoices', { params: { limit } }).then(r => r.data),
  checkout: (plan: string, interval: string) => api.post('/billing/checkout', { plan, interval }).then(r => r.data),
  portal: () => api.post('/billing/portal').then(r => r.data),
}

// ── Phase 1: Team ────────────────────────────────────────────────
export const teamApi = {
  list: () => api.get('/team').then(r => r.data),
  invite: (email: string, role: string) => api.post('/team/invite', { email, role }).then(r => r.data),
  listInvites: () => api.get('/team/invites').then(r => r.data),
  revokeInvite: (id: string) => api.delete(`/team/invites/${id}`).then(r => r.data),
  acceptInvite: (token: string, full_name: string, password: string) => api.post('/team/accept', { token, full_name, password }).then(r => r.data),
  updateMember: (id: string, d: any) => api.patch(`/team/members/${id}`, d).then(r => r.data),
  removeMember: (id: string) => api.delete(`/team/members/${id}`).then(r => r.data),
}

// ── Phase 1: Org ──────────────────────────────────────────────────
export const orgApi = {
  get: () => api.get('/org').then(r => r.data),
  update: (d: any) => api.patch('/org', d).then(r => r.data),
}

// ── Phase 1: API Keys ─────────────────────────────────────────────
export const apiKeyApi = {
  list: () => api.get('/api-keys').then(r => r.data),
  create: (d: any) => api.post('/api-keys', d).then(r => r.data),
  revoke: (id: string) => api.delete(`/api-keys/${id}`).then(r => r.data),
}

// ── Phase 3: Advanced AI ──────────────────────────────────────────
export const phase3AiApi = {
  models: () => api.get('/ai/models').then(r => r.data),
  createModel: (d: any) => api.post('/ai/models', d).then(r => r.data),
  yieldForecast: (params?: any) => api.post('/ai/yield-forecast', params || {}).then(r => r.data),
  anomalies: (params?: any) => api.get('/ai/anomalies', { params }).then(r => r.data),
  resolveAnomaly: (id: string) => api.post(`/ai/anomalies/${id}/resolve`).then(r => r.data),
  nutrientOptimize: (readings: any, params?: any) => api.post('/ai/nutrient-optimize', readings, { params }).then(r => r.data),
  energyOptimize: (farmId?: string) => api.get('/ai/energy-optimize', { params: { farm_id: farmId } }).then(r => r.data),
  harvestSchedule: (farmId?: string) => api.get('/ai/harvest-schedule', { params: { farm_id: farmId } }).then(r => r.data),
  cvScans: (params?: any) => api.get('/ai/cv-scans', { params }).then(r => r.data),
}

// ── Phase 3: Reports ─────────────────────────────────────────────
export const reportsApi = {
  list: () => api.get('/reports').then(r => r.data),
  create: (d: any) => api.post('/reports', d).then(r => r.data),
  update: (id: string, d: any) => api.put(`/reports/${id}`, d).then(r => r.data),
  delete: (id: string) => api.delete(`/reports/${id}`).then(r => r.data),
  generate: (id: string) => api.post(`/reports/${id}/generate`).then(r => r.data),
  yieldPerformance: (params?: any) => api.get('/reports/yield-performance', { params }).then(r => r.data),
  costOfProduction: (params?: any) => api.get('/reports/cost-of-production', { params }).then(r => r.data),
  sustainability: (params?: any) => api.get('/reports/sustainability', { params }).then(r => r.data),
  compliance: (params?: any) => api.get('/reports/compliance', { params }).then(r => r.data),
}

// ── Phase 3: Dashboard Widgets ───────────────────────────────────
export const widgetsApi = {
  available: () => api.get('/dashboard/widgets/available').then(r => r.data),
  list: () => api.get('/dashboard/widgets').then(r => r.data),
  add: (d: any) => api.post('/dashboard/widgets', d).then(r => r.data),
  update: (id: string, d: any) => api.put(`/dashboard/widgets/${id}`, d).then(r => r.data),
  remove: (id: string) => api.delete(`/dashboard/widgets/${id}`).then(r => r.data),
  bulkLayout: (updates: any[]) => api.put('/dashboard/widgets/layout/bulk', updates).then(r => r.data),
}

// ── Notifications ────────────────────────────────────────────────
export const notificationsApi = {
  list: (params?: any) => api.get('/notifications', { params }).then(r => r.data),
  count: () => api.get('/notifications/count').then(r => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () => api.post('/notifications/read-all').then(r => r.data),
  settings: () => api.get('/notifications/settings').then(r => r.data),
  updateSettings: (d: any) => api.patch('/notifications/settings', d).then(r => r.data),
}

// ── Climate ──────────────────────────────────────────────────────
export const climateApi = {
  zones: (farmId?: string) => api.get('/climate/zones', { params: { farm_id: farmId } }).then(r => r.data),
  history: (zoneId: string, hours?: number) => api.get(`/climate/${zoneId}/history`, { params: { hours } }).then(r => r.data),
  setpoints: (zoneId: string, d: any) => api.patch(`/climate/${zoneId}/setpoints`, d).then(r => r.data),
}

// ── Irrigation ───────────────────────────────────────────────────
export const irrigationApi = {
  schedules: (params?: any) => api.get('/irrigation/schedules', { params }).then(r => r.data),
  createSchedule: (d: any) => api.post('/irrigation/schedules', d).then(r => r.data),
  updateSchedule: (id: string, d: any) => api.patch(`/irrigation/schedules/${id}`, d).then(r => r.data),
  deleteSchedule: (id: string) => api.delete(`/irrigation/schedules/${id}`).then(r => r.data),
  trigger: (zoneId: string, d: any) => api.post(`/irrigation/${zoneId}/trigger`, d).then(r => r.data),
}

// ── Inventory ────────────────────────────────────────────────────
export const inventoryApi = {
  list: (params?: any) => api.get('/inventory', { params }).then(r => r.data),
  get: (id: string) => api.get(`/inventory/${id}`).then(r => r.data),
  create: (d: any) => api.post('/inventory', d).then(r => r.data),
  update: (id: string, d: any) => api.patch(`/inventory/${id}`, d).then(r => r.data),
  delete: (id: string) => api.delete(`/inventory/${id}`).then(r => r.data),
  categories: () => api.get('/inventory/categories').then(r => r.data),
}

// ── SOP ──────────────────────────────────────────────────────────
export const sopApi = {
  list: (params?: any) => api.get('/sop', { params }).then(r => r.data),
  get: (id: string) => api.get(`/sop/${id}`).then(r => r.data),
  create: (d: any) => api.post('/sop', d).then(r => r.data),
  update: (id: string, d: any) => api.patch(`/sop/${id}`, d).then(r => r.data),
  delete: (id: string) => api.delete(`/sop/${id}`).then(r => r.data),
}

// ── Energy ───────────────────────────────────────────────────────
export const energyApi = {
  summary: (params?: any) => api.get('/energy/summary', { params }).then(r => r.data),
  trend: (days?: number) => api.get('/energy/trend', { params: { days } }).then(r => r.data),
  breakdown: (params?: any) => api.get('/energy/breakdown', { params }).then(r => r.data),
}

// ── Compliance ───────────────────────────────────────────────────
export const complianceApi = {
  list: (params?: any) => api.get('/compliance', { params }).then(r => r.data),
  get: (id: string) => api.get(`/compliance/${id}`).then(r => r.data),
  create: (d: any) => api.post('/compliance', d).then(r => r.data),
  update: (id: string, d: any) => api.patch(`/compliance/${id}`, d).then(r => r.data),
}

// ── Marketplace ──────────────────────────────────────────────────
export const marketplaceApi = {
  listings: (params?: any) => api.get('/marketplace/listings', { params }).then(r => r.data),
  myListings: () => api.get('/marketplace/my-listings').then(r => r.data),
  createListing: (d: any) => api.post('/marketplace/listings', d).then(r => r.data),
  updateListing: (id: string, d: any) => api.patch(`/marketplace/listings/${id}`, d).then(r => r.data),
  orders: (params?: any) => api.get('/marketplace/orders', { params }).then(r => r.data),
  createOrder: (d: any) => api.post('/marketplace/orders', d).then(r => r.data),
}
