// Sistema de Feature Flags - Primeflow V8

interface FeatureFlags {
  aiPanel: boolean;
  whatsappAutomation: boolean;
  crm: boolean;
  analytics: boolean;
  advancedMonitoring: boolean;
}

const defaultFlags: FeatureFlags = {
  aiPanel: true,
  whatsappAutomation: true,
  crm: true,
  analytics: true,
  advancedMonitoring: true,
};

class FeatureFlagService {
  private flags: FeatureFlags;

  constructor() {
    this.flags = this.loadFlags();
  }

  private loadFlags(): FeatureFlags {
    // Carregar do localStorage
    const stored = localStorage.getItem('featureFlags');
    if (stored) {
      try {
        return { ...defaultFlags, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Error loading feature flags:', e);
      }
    }

    // Carregar do .env
    return {
      aiPanel: import.meta.env.FEATURE_AI_PANEL !== 'false',
      whatsappAutomation: import.meta.env.FEATURE_WHATSAPP_AUTOMATION !== 'false',
      crm: import.meta.env.FEATURE_CRM !== 'false',
      analytics: import.meta.env.FEATURE_ANALYTICS !== 'false',
      advancedMonitoring: import.meta.env.FEATURE_ADVANCED_MONITORING !== 'false',
    };
  }

  isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag] === true;
  }

  enable(flag: keyof FeatureFlags): void {
    this.flags[flag] = true;
    this.save();
  }

  disable(flag: keyof FeatureFlags): void {
    this.flags[flag] = false;
    this.save();
  }

  toggle(flag: keyof FeatureFlags): void {
    this.flags[flag] = !this.flags[flag];
    this.save();
  }

  getAll(): FeatureFlags {
    return { ...this.flags };
  }

  private save(): void {
    localStorage.setItem('featureFlags', JSON.stringify(this.flags));
  }
}

export const featureFlags = new FeatureFlagService();
export type { FeatureFlags };
