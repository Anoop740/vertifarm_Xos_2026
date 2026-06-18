import { create } from 'zustand'

interface UIState {
  selectedFarmId: string | null
  selectedZoneId: string | null
  sidebarOpen: boolean
  activeTab: string
  setFarm: (id: string | null) => void
  setZone: (id: string | null) => void
  setSidebarOpen: (v: boolean) => void
  setActiveTab: (tab: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedFarmId: null,
  selectedZoneId: null,
  sidebarOpen: true,
  activeTab: 'overview',
  setFarm: (id) => set({ selectedFarmId: id }),
  setZone: (id) => set({ selectedZoneId: id }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
