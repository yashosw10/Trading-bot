import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  threshold: number;
  triggered: boolean;
  message?: string;
  timestamp?: string;
}

interface AlertsStore {
  alerts: PriceAlert[];
  unreadCount: number;
  addAlert: (alert: Omit<PriceAlert, 'id' | 'triggered'>) => void;
  removeAlert: (id: string) => void;
  markTriggered: (id: string, message?: string) => void;
  clearUnread: () => void;
  clearAll: () => void;
}

export const useAlertsStore = create<AlertsStore>()(
  persist(
    (set) => ({
      alerts: [],
      unreadCount: 0,
      addAlert: (alert) => set((state) => ({
        alerts: [{ ...alert, id: Math.random().toString(36).substring(7), triggered: false, timestamp: new Date().toISOString() }, ...state.alerts].slice(0, 50)
      })),
      removeAlert: (id) => set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id)
      })),
      markTriggered: (id, message) => set((state) => ({
        alerts: state.alerts.map((a) => a.id === id ? { ...a, triggered: true, message, timestamp: new Date().toISOString() } : a),
        unreadCount: state.unreadCount + 1
      })),
      clearUnread: () => set({ unreadCount: 0 }),
      clearAll: () => set({ alerts: [], unreadCount: 0 })
    }),
    {
      name: 'notification_log',
    }
  )
);
