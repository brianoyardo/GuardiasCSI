import { create } from 'zustand'

/**
 * layoutStore.js
 * Centralized store for the AppShell layout state.
 * Syncs the state of the Sidebar across AdminLayout, Navbar, and map components.
 */

export const useLayoutStore = create((set) => ({
  // Desktop
  isSidebarCollapsed: false,
  
  // Mobile
  isMobileSidebarOpen: false,

  // Actions
  toggleSidebar: () => set((state) => ({ 
    isSidebarCollapsed: !state.isSidebarCollapsed 
  })),
  
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

  toggleMobileSidebar: () => set((state) => ({ 
    isMobileSidebarOpen: !state.isMobileSidebarOpen 
  })),

  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
}))
