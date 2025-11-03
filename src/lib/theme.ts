export type ThemeConfig = {
  brandName: string;
  tagline: string;
  primaryHex: string; // e.g. #6366f1
  accentHex: string;  // e.g. #8b5cf6
  themeMode: 'light' | 'dark' | 'system';
  // Optional extended fields for backward/forward compatibility
  logoUrl?: string | null;
  faviconUrl?: string | null;
  backgroundColor?: string;
  foregroundColor?: string;
  cardColor?: string;
  borderColor?: string;
  mutedColor?: string;
  successColor?: string;
  errorColor?: string; // maps to --destructive
  warningColor?: string;
};

const THEME_STORAGE_KEY = 'primezap-theme-config';

export function hexToHslTriplet(hex: string): string {
  const sanitized = hex.replace('#', '').trim();
  const bigint = parseInt(sanitized.length === 3
    ? sanitized.split('').map((c) => c + c).join('')
    : sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  return `${hDeg} ${sPct}% ${lPct}%`;
}

export function applyThemeColors(params: { primaryHex: string; accentHex: string; }): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const primaryHsl = hexToHslTriplet(params.primaryHex);
  const accentHsl = hexToHslTriplet(params.accentHex);

  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty('--accent', accentHsl);
  // Keep ring aligned with primary
  root.style.setProperty('--ring', primaryHsl);
}

function setIf(hex: string | undefined | null, cssVar: string) {
  if (!hex) return;
  const hsl = hexToHslTriplet(hex);
  document.documentElement.style.setProperty(cssVar, hsl);
}

export function applyCustomizationToDOM(cfg: Partial<ThemeConfig>): void {
  if (typeof document === 'undefined') return;
  // Core palette
  setIf(cfg.primaryHex ?? (cfg as any).primaryColor, '--primary');
  setIf(cfg.accentHex ?? (cfg as any).accentColor, '--accent');
  // Extended palette
  setIf((cfg as any).backgroundColor, '--background');
  setIf((cfg as any).foregroundColor, '--foreground');
  setIf((cfg as any).cardColor, '--card');
  setIf((cfg as any).borderColor, '--border');
  setIf((cfg as any).mutedColor, '--muted');
  setIf((cfg as any).successColor, '--success');
  setIf((cfg as any).warningColor, '--warning');
  // Map error -> destructive
  setIf((cfg as any).errorColor, '--destructive');

  // Ring follows primary
  const primary = cfg.primaryHex ?? (cfg as any).primaryColor;
  if (primary) {
    document.documentElement.style.setProperty('--ring', hexToHslTriplet(primary));
    // Sidebar primary aligns to global primary
    document.documentElement.style.setProperty('--sidebar-primary', hexToHslTriplet(primary));
    document.documentElement.style.setProperty('--sidebar-ring', hexToHslTriplet(primary));
  }

  // Sidebar mappings (fallback to global palette when specific not provided)
  const sbBg = (cfg as any).sidebarBackground || (cfg as any).backgroundColor;
  const sbFg = (cfg as any).sidebarForeground || (cfg as any).foregroundColor;
  const sbBorder = (cfg as any).sidebarBorder || (cfg as any).borderColor;
  const sbAccent = (cfg as any).sidebarAccent || (cfg as any).cardColor || (cfg as any).backgroundColor;
  setIf(sbBg, '--sidebar-background');
  setIf(sbFg, '--sidebar-foreground');
  setIf(sbBorder, '--sidebar-border');
  setIf(sbAccent, '--sidebar-accent');

  // Apply theme mode if provided
  const mode = cfg.themeMode;
  if (mode === 'light' || mode === 'dark') {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(mode);
  }

  // Apply favicon if provided
  if (cfg.faviconUrl) {
    try {
      let link: HTMLLinkElement | null = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = cfg.faviconUrl;
      // Also update shortcut icon if present
      let shortcut: HTMLLinkElement | null = document.querySelector("link[rel='shortcut icon']");
      if (!shortcut) {
        shortcut = document.createElement('link');
        shortcut.rel = 'shortcut icon';
        document.head.appendChild(shortcut);
      }
      shortcut.href = cfg.faviconUrl;
    } catch (_) { /* ignore */ }
  }

  // Update theme-color meta for mobile browsers using primary
  try {
    const primaryHex = cfg.primaryHex ?? (cfg as any).primaryColor;
    if (primaryHex) {
      let meta: HTMLMetaElement | null = document.querySelector("meta[name='theme-color']");
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = primaryHex;
    }
  } catch (_) { /* ignore */ }
}

export function saveThemeConfig(cfg: ThemeConfig): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(cfg));
  } catch (_) {
    // ignore storage errors (quota/disabled)
  }
}

export function loadThemeConfig(): ThemeConfig | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ThemeConfig;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function applySavedTheme(): void {
  const cfg = loadThemeConfig();
  if (!cfg) return;
  applyThemeColors({ primaryHex: cfg.primaryHex, accentHex: cfg.accentHex });
}

export function emitThemeUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('theme:updated'));
}

export function applySavedCustomization(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('primezap-customization');
    if (!raw) {
      // Fallback: apply basic theme only
      applySavedTheme();
      return;
    }
    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? parsed; // zustand persist formats as { state, version }
    applyCustomizationToDOM(state);
  } catch (_) {
    applySavedTheme();
  }
}
