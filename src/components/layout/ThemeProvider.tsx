import { useTheme } from '@/hooks/useTheme';
import { useEffect } from 'react';
import { applySavedCustomization } from '@/lib/theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useTheme(); // Inicializa o tema
  useEffect(() => {
    // Aplica customizações persistidas (cores completas + favicon)
    applySavedCustomization();
  }, []);
  
  return <>{children}</>;
}
