import { create } from 'zustand'

interface CalDAVSyncState {
  /** Global sync status that any component can read (e.g. Sidebar for animation) */
  status: 'idle' | 'syncing'
  setStatus: (status: 'idle' | 'syncing') => void
}

/**
 * Non-persisted store for CalDAV sync status.
 * Used so the Sidebar (and other components) can show sync animation
 * regardless of which useCalDAV() instance triggered the sync.
 */
export const useCalDAVSyncStore = create<CalDAVSyncState>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}))
