import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CustomizationState = {
  brandName: string;
  tagline: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;

  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  borderColor: string;
  mutedColor: string;
  successColor: string;
  errorColor: string;
  warningColor: string;
  darkMode: boolean;

  // Sidebar-specific palette (optional overrides)
  sidebarBackground?: string;
  sidebarForeground?: string;
  sidebarBorder?: string;
  sidebarAccent?: string;

  setBrandName: (v: string) => void;
  setTagline: (v: string) => void;
  setLogoUrl: (v?: string | null) => void;
  setFaviconUrl: (v?: string | null) => void;
  setPrimaryColor: (v: string) => void;
  setAccentColor: (v: string) => void;
  setBackgroundColor: (v: string) => void;
  setForegroundColor: (v: string) => void;
  setCardColor: (v: string) => void;
  setBorderColor: (v: string) => void;
  setMutedColor: (v: string) => void;
  setSuccessColor: (v: string) => void;
  setErrorColor: (v: string) => void;
  setWarningColor: (v: string) => void;
  setDarkMode: (v: boolean) => void;
  reset: () => void;
  // Sidebar color setters
  setSidebarBackground: (v: string) => void;
  setSidebarForeground: (v: string) => void;
  setSidebarBorder: (v: string) => void;
  setSidebarAccent: (v: string) => void;
};

const defaults = {
  brandName: 'PrimeZapAI',
  tagline: 'CRM & Omnichannel',
  logoUrl: null as string | null,
  faviconUrl: null as string | null,

  primaryColor: '#6366f1',
  accentColor: '#8b5cf6',
  backgroundColor: '#0b0b0b',
  foregroundColor: '#ffffff',
  cardColor: '#111111',
  borderColor: '#222222',
  mutedColor: '#6b7280',
  successColor: '#22c55e',
  errorColor: '#ef4444',
  warningColor: '#f59e0b',
  darkMode: true,

  // Sidebar defaults inherit from global palette (can be left undefined)
  sidebarBackground: undefined as string | undefined,
  sidebarForeground: undefined as string | undefined,
  sidebarBorder: undefined as string | undefined,
  sidebarAccent: undefined as string | undefined,
};

export const useCustomization = create<CustomizationState>()(
  persist(
    (set, get) => ({
      ...defaults,
      setBrandName: (brandName) => set({ brandName }),
      setTagline: (tagline) => set({ tagline }),
      setLogoUrl: (logoUrl) => set({ logoUrl: logoUrl ?? null }),
      setFaviconUrl: (faviconUrl) => set({ faviconUrl: faviconUrl ?? null }),
      setPrimaryColor: (primaryColor) => set({ primaryColor }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
      setForegroundColor: (foregroundColor) => set({ foregroundColor }),
      setCardColor: (cardColor) => set({ cardColor }),
      setBorderColor: (borderColor) => set({ borderColor }),
      setMutedColor: (mutedColor) => set({ mutedColor }),
      setSuccessColor: (successColor) => set({ successColor }),
      setErrorColor: (errorColor) => set({ errorColor }),
      setWarningColor: (warningColor) => set({ warningColor }),
      setDarkMode: (darkMode) => set({ darkMode }),
      reset: () => set({ ...defaults }),
      setSidebarBackground: (sidebarBackground) => set({ sidebarBackground }),
      setSidebarForeground: (sidebarForeground) => set({ sidebarForeground }),
      setSidebarBorder: (sidebarBorder) => set({ sidebarBorder }),
      setSidebarAccent: (sidebarAccent) => set({ sidebarAccent }),
    }),
    {
      name: 'primezap-customization',
      partialize: (state) => state,
    }
  )
);
