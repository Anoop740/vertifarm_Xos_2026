import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import CommandPalette    from '@/components/CommandPalette'
import OnboardingWizard  from '@/components/OnboardingWizard'

// Pages
import LandingPage       from '@/pages/Landing'
import SignupPage        from '@/pages/Signup'
import VerifyEmailPage   from '@/pages/VerifyEmail'
import ForgotPasswordPage from '@/pages/ForgotPassword'
import ResetPasswordPage  from '@/pages/ResetPassword'
import AcceptInvitePage  from '@/pages/AcceptInvite'
import BillingPage       from '@/pages/Billing'
import TeamPage          from '@/pages/Team'
import LoginPage      from '@/pages/Login'
import OverviewPage   from '@/pages/Overview'
import FarmsPage      from '@/pages/Farms'
import ZonesPage      from '@/pages/Zones'
import AlertsPage     from '@/pages/Alerts'
import AIPage         from '@/pages/AI'
import AnalyticsPage  from '@/pages/Analytics'
import DevicesPage    from '@/pages/Devices'
import CropsPage      from '@/pages/Crops'
import IrrigationPage  from '@/pages/Irrigation'
import ClimatePage     from '@/pages/Climate'
import CO2Page         from '@/pages/CO2'
import LightingPage    from '@/pages/Lighting'
import AutomationPage  from '@/pages/Automation'
import EnergyPage      from '@/pages/Energy'
import SOPPage         from '@/pages/SOP'
import InventoryPage   from '@/pages/Inventory'
import SettingsPage   from '@/pages/Settings'
// Individual page imports above (Climate, CO2, Lighting, Automation, Energy, SOP, Inventory)

// Phase 2 pages
import ApiKeysPage       from '@/pages/ApiKeys'
import NotificationsPage from '@/pages/Notifications'
import HarvestsPage      from '@/pages/Harvests'
import IntegrationsPage  from '@/pages/Integrations'
import BuyerPortal       from '@/pages/BuyerPortal'

// Phase 3 pages
import AIAdvancedPage       from '@/pages/AIAdvanced'
import ReportsPage          from '@/pages/Reports'
import DashboardBuilderPage from '@/pages/DashboardBuilder'
import GrowJournalPage     from '@/pages/GrowJournal'

// Phase 4 pages
import ResellersPage    from '@/pages/Resellers'
import CompliancePage   from '@/pages/Compliance'
import FranchisePage    from '@/pages/Franchise'
import MarketplacePage  from '@/pages/Marketplace'
import ModulesPage      from '@/pages/Modules'

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

/* ─── Guards ──────────────────────────────────────────────── */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  const [showOnboarding, setShowOnboarding] = React.useState(false)

  React.useEffect(() => {
    if (isAuthenticated && user) {
      const key = `onboarding_done_${user.id}`
      if (!localStorage.getItem(key)) setShowOnboarding(true)
    }
  }, [isAuthenticated, user])

  const handleOnboardingDone = () => {
    if (user) localStorage.setItem(`onboarding_done_${user.id}`, '1')
    setShowOnboarding(false)
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <>
      <AppLayout>{children}</AppLayout>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingDone}
          onSkip={handleOnboardingDone}
        />
      )}
    </>
  )
}

/** Unauthenticated-only: if already logged in, bounce to dashboard */
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/* ─── Routes ──────────────────────────────────────────────── */
function AppRoutes() {
  const { fetchMe } = useAuthStore()

  useEffect(() => {
    if (localStorage.getItem('access_token')) fetchMe()
  }, [])

  return (
    <Routes>
      {/* ── Public marketing / landing ── */}
      <Route path="/"
        element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>}
      />

      {/* ── Auth ── */}
      <Route path="/login"
        element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>}
      />

      {/* ── Phase 1 public routes ── */}
      <Route path="/signup"          element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
      <Route path="/verify-email"    element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />
      <Route path="/accept-invite"   element={<AcceptInvitePage />} />

      {/* ── App (protected) — dashboard is the home once logged in ── */}
      <Route path="/dashboard"  element={<ProtectedRoute><OverviewPage    /></ProtectedRoute>} />
      <Route path="/farms"      element={<ProtectedRoute><FarmsPage        /></ProtectedRoute>} />
      <Route path="/zones"      element={<ProtectedRoute><ZonesPage       /></ProtectedRoute>} />
      <Route path="/crops"      element={<ProtectedRoute><CropsPage        /></ProtectedRoute>} />
      <Route path="/alerts"     element={<ProtectedRoute><AlertsPage       /></ProtectedRoute>} />
      <Route path="/climate"    element={<ProtectedRoute><ClimatePage      /></ProtectedRoute>} />
      <Route path="/irrigation" element={<ProtectedRoute><IrrigationPage   /></ProtectedRoute>} />
      <Route path="/lighting"   element={<ProtectedRoute><LightingPage     /></ProtectedRoute>} />
      <Route path="/co2"        element={<ProtectedRoute><CO2Page          /></ProtectedRoute>} />
      <Route path="/automation" element={<ProtectedRoute><AutomationPage   /></ProtectedRoute>} />
      <Route path="/ai"         element={<ProtectedRoute><AIPage           /></ProtectedRoute>} />
      <Route path="/devices"    element={<ProtectedRoute><DevicesPage      /></ProtectedRoute>} />
      <Route path="/energy"     element={<ProtectedRoute><EnergyPage       /></ProtectedRoute>} />
      <Route path="/analytics"  element={<ProtectedRoute><AnalyticsPage    /></ProtectedRoute>} />
      <Route path="/inventory"  element={<ProtectedRoute><InventoryPage    /></ProtectedRoute>} />
      <Route path="/sop"        element={<ProtectedRoute><SOPPage          /></ProtectedRoute>} />
      <Route path="/settings"   element={<ProtectedRoute><SettingsPage     /></ProtectedRoute>} />
      <Route path="/billing"    element={<ProtectedRoute><BillingPage     /></ProtectedRoute>} />
      <Route path="/team"       element={<ProtectedRoute><TeamPage         /></ProtectedRoute>} />

      {/* ── Phase 2 ── */}
      <Route path="/settings/api-keys"      element={<ProtectedRoute><ApiKeysPage       /></ProtectedRoute>} />
      <Route path="/notifications"          element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/settings/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/harvests"               element={<ProtectedRoute><HarvestsPage      /></ProtectedRoute>} />
      <Route path="/grow-journal"            element={<ProtectedRoute><GrowJournalPage   /></ProtectedRoute>} />
      <Route path="/integrations"           element={<ProtectedRoute><IntegrationsPage  /></ProtectedRoute>} />

      {/* ── Public buyer / traceability portal ── */}
      <Route path="/buyer"  element={<BuyerPortal />} />
      <Route path="/t/:batchCode" element={<BuyerPortal />} />

      {/* ── Phase 3 ── */}
      <Route path="/ai/advanced"        element={<ProtectedRoute><AIAdvancedPage       /></ProtectedRoute>} />
      <Route path="/reports"            element={<ProtectedRoute><ReportsPage          /></ProtectedRoute>} />
      <Route path="/dashboard/builder"  element={<ProtectedRoute><DashboardBuilderPage /></ProtectedRoute>} />

      {/* ── Phase 4 ── */}
      <Route path="/resellers"           element={<ProtectedRoute><ResellersPage   /></ProtectedRoute>} />
      <Route path="/compliance"          element={<ProtectedRoute><CompliancePage  /></ProtectedRoute>} />
      <Route path="/franchise"           element={<ProtectedRoute><FranchisePage   /></ProtectedRoute>} />
      <Route path="/marketplace"          element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
      <Route path="/modules"             element={<ProtectedRoute><ModulesPage     /></ProtectedRoute>} />

      {/* ── Fallbacks ── */}
      {/* Old "/" for authenticated users → /dashboard */}
      <Route path="*" element={<SmartFallback />} />
    </Routes>
  )
}

function SmartFallback() {
  const { isAuthenticated } = useAuthStore()
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />
}

/* ─── Root ────────────────────────────────────────────────── */
export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0c1525',
              color: '#f0f6ff',
              border: '1px solid rgba(0,212,170,0.2)',
              fontSize: '13px',
              fontFamily: "'DM Sans', -apple-system, sans-serif",
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
              borderRadius: '10px',
            },
            success: { iconTheme: { primary: '#00d4aa', secondary: '#030c14' } },
            error:   { iconTheme: { primary: '#ff4d6d', secondary: '#030c14' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
