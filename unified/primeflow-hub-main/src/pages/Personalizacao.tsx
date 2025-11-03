import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTheme } from '@/hooks/useTheme';

type BrandConfig = {
  primary: string; // HSL string, e.g. "262 83% 58%"
  accent: string;
  secondary: string;
};

const STORAGE_KEY = 'primezap-brand';

function applyBrand(vars: BrandConfig) {
  const root = document.documentElement;
  root.style.setProperty('--primary', vars.primary);
  root.style.setProperty('--accent', vars.accent);
  root.style.setProperty('--secondary', vars.secondary);
  // ring follows primary
  root.style.setProperty('--ring', vars.primary);
}

export default function Personalizacao() {
  const { theme, setTheme } = useTheme();
  const [brand, setBrand] = useState<BrandConfig>({
    primary: '262 83% 58%',
    accent: '199 89% 48%',
    secondary: '142 76% 42%',
  });

  useEffect(() => {
    // load saved brand
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as BrandConfig;
        setBrand(saved);
        applyBrand(saved);
      }
    } catch {}
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
    applyBrand(brand);
  };

  const handleReset = () => {
    const defaults: BrandConfig = { primary: '262 83% 58%', accent: '199 89% 48%', secondary: '142 76% 42%' };
    setBrand(defaults);
    localStorage.removeItem(STORAGE_KEY);
    applyBrand(defaults);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Personalização</h1>
        <p className="text-muted-foreground mt-1">Ajuste tema e cores da sua marca</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tema</CardTitle>
          <CardDescription>Escolha entre Claro, Escuro ou seguir o Sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme} onValueChange={(v) => setTheme(v as any)} className="flex gap-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="light" id="theme-light" />
              <Label htmlFor="theme-light">Claro</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dark" id="theme-dark" />
              <Label htmlFor="theme-dark">Escuro</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="system" id="theme-system" />
              <Label htmlFor="theme-system">Sistema</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cores da Marca</CardTitle>
          <CardDescription>Informe valores HSL (ex: 262 83% 58%)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="brand-primary">Primária</Label>
              <Input id="brand-primary" value={brand.primary} onChange={(e) => setBrand({ ...brand, primary: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-accent">Acento</Label>
              <Input id="brand-accent" value={brand.accent} onChange={(e) => setBrand({ ...brand, accent: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-secondary">Secundária</Label>
              <Input id="brand-secondary" value={brand.secondary} onChange={(e) => setBrand({ ...brand, secondary: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave}>Salvar</Button>
            <Button variant="outline" onClick={handleReset}>Restaurar padrão</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

