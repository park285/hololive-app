import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
    isSidebarOpen: boolean; // Mobile Overlay State
    isSidebarCollapsed: boolean; // Desktop Collapsed State
    setSidebarOpen: (open: boolean) => void;
    toggleSidebarOpen: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    toggleSidebarCollapsed: () => void;
}

export const useSidebarStore = create<SidebarState>()(
    persist(
        (set) => ({
            isSidebarOpen: false,
            isSidebarCollapsed: false,
            setSidebarOpen: (open) => set({ isSidebarOpen: open }),
            toggleSidebarOpen: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
            toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
        }),
        {
            name: 'sidebar-storage',
            partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed }), // Only persist collapsed state
        }
    )
);
