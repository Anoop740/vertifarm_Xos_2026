import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api'

export type UserRole = 'viewer' | 'operator' | 'farm_manager' | 'admin' | 'superadmin'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_superuser: boolean
  organization_id: string | null
  avatar_url?: string | null
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  setUser: (user: User) => void
  hasRole: (...roles: UserRole[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user: User) => set({ user, isAuthenticated: true }),

      hasRole: (...roles: UserRole[]) => {
        const { user } = get()
        if (!user) return false
        if (user.is_superuser) return true
        return roles.includes(user.role)
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const data = await authApi.login(email, password)
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          const user = await authApi.me()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, isAuthenticated: false })
      },

      fetchMe: async () => {
        const token = localStorage.getItem('access_token')
        if (!token) {
          set({ user: null, isAuthenticated: false })
          return
        }
        try {
          const user = await authApi.me()
          set({ user, isAuthenticated: true })
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          set({ user: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: 'vertifarm-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
)
