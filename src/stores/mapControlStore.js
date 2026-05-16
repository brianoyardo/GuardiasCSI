import { create } from 'zustand'

export const useMapControlStore = create((set) => ({
  flyToTarget: null,
  triggerFlyTo: (lat, lng, zoom = 16) => set({ flyToTarget: { lat, lng, zoom } }),
  clearFlyTo: () => set({ flyToTarget: null }),
}))
