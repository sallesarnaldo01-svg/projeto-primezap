import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarPosition: 'left' | 'right';
  
  // Loading states
  isLoading: boolean;
  loadingMessage?: string;
  
  // Modals
  modals: Record<string, boolean>;
  
  // Actions
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarPosition: (pos: 'left' | 'right') => void;
  setLoading: (loading: boolean, message?: string) => void;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  toggleModal: (modalId: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      sidebarPosition: 'left',
      isLoading: false,
      loadingMessage: undefined,
      modals: {},

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarPosition: (sidebarPosition) => set({ sidebarPosition }),
      
      setLoading: (isLoading, loadingMessage) => 
        set({ isLoading, loadingMessage }),

      openModal: (modalId) => 
        set((state) => ({ 
          modals: { ...state.modals, [modalId]: true } 
        })),

      closeModal: (modalId) => 
        set((state) => ({ 
          modals: { ...state.modals, [modalId]: false } 
        })),

      toggleModal: (modalId) => {
        const { modals } = get();
        set({ 
          modals: { ...modals, [modalId]: !modals[modalId] } 
        });
      },
    }),
    {
      name: 'primezap-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarPosition: s.sidebarPosition,
      }),
    }
  )
);
