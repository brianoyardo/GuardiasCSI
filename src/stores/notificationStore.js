import { create } from 'zustand'

/**
 * SentinelOps — Notification Store (Zustand)
 * Manages in-app notifications and alerts
 * 
 * Prepared for: push notifications, n8n webhooks, escalation
 */

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => {
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    })
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [
        { id: Date.now(), timestamp: Date.now(), read: false, ...notification },
        ...state.notifications,
      ].slice(0, 200),
      unreadCount: state.unreadCount + 1,
    }))
  },

  markAsRead: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))

export default useNotificationStore
