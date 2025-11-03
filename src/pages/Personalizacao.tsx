import { useState, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Palette, Upload, Save, RotateCcw, Eye, Image as ImageIcon } from 'lucide-react';
import { useCustomization } from '@/stores/customization';
import { applyCustomizationToDOM, saveThemeConfig, emitThemeUpdated } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/ui';

export default function Personalizacao() {
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const { setTheme } = useTheme();
  
  const {
    brandName,
    tagline,
    logoUrl,
    faviconUrl,
    primaryColor,
    accentColor,
    backgroundColor,
    foregroundColor,
    cardColor,
    borderColor,
    mutedColor,
    successColor,
    errorColor,
    warningColor,
    darkMode,
    sidebarBackground,
    sidebarForeground,
    sidebarBorder,
    sidebarAccent,
    setBrandName,
    setTagline,
    setLogoUrl,
    setFaviconUrl,
    setPrimaryColor,
    setAccentColor,
    setBackgroundColor,
    setForegroundColor,
    setCardColor,
    setBorderColor,
    setMutedColor,
    setSuccessColor,
    setErrorColor,
    setWarningColor,
    setDarkMode,
    setSidebarBackground,
    setSidebarForeground,
    setSidebarBorder,
    setSidebarAccent,
    reset,
  } = useCustomization();
  
  const { sidebarCollapsed, setSidebarCollapsed, sidebarPosition, setSidebarPosition } = useUIStore();
  const [compactMode, setCompactMode] = useState<boolean>(sidebarCollapsed);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O arquivo deve ter no máximo 2MB.',
          variant: 'destructive'
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
        toast({
          title: 'Logo atualizado!',
          description: 'Seu logo foi carregado com sucesso.'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaviconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O favicon deve ter no máximo 1MB.',
          variant: 'destructive'
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFaviconUrl(reader.result as string);
        toast({
          title: 'Favicon atualizado!',
          description: 'Seu favicon foi carregado com sucesso.'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    // Aplicar no DOM (todas as cores e favicon)
    applyCustomizationToDOM({
      brandName,
      tagline,
      primaryHex: primaryColor,
      accentHex: accentColor,
      backgroundColor,
      foregroundColor,
      cardColor,
      borderColor,
      mutedColor,
      successColor,
      errorColor,
      warningColor,
      sidebarBackground,
      sidebarForeground,
      sidebarBorder,
      sidebarAccent,
      faviconUrl: faviconUrl || undefined,
      logoUrl: logoUrl || undefined,
      themeMode: darkMode ? 'dark' : 'light',
    });

    // Persistência retro‑compatível (Sidebar/Login carregam daqui)
    saveThemeConfig({
      brandName,
      tagline,
      primaryHex: primaryColor,
      accentHex: accentColor,
      themeMode: darkMode ? 'dark' : 'light',
      logoUrl: logoUrl || undefined,
      faviconUrl: faviconUrl || undefined,
      backgroundColor,
      foregroundColor,
      cardColor,
      borderColor,
      mutedColor,
      successColor,
      errorColor,
      warningColor,
    });

    // Modo de tema (classe no <html>)
    setTheme(darkMode ? 'dark' : 'light');

    // Aplicar preferências de layout
    setSidebarCollapsed(compactMode);
    setSidebarPosition(sidebarPosition);

    // Notificar listeners (Sidebar etc.)
    emitThemeUpdated();

    toast({
      title: 'Configurações salvas!',
      description: 'Suas personalizações foram aplicadas com sucesso.'
    });
  };

  const handleReset = () => {
    reset();
    setSidebarPosition('left');
    setCompactMode(false);
    setSidebarCollapsed(false);
    // Voltar para defaults visuais imediatamente
    applyCustomizationToDOM({
      brandName: 'PrimeZapAI',
      tagline: 'CRM & Omnichannel',
      primaryHex: '#6366f1',
      accentHex: '#8b5cf6',
      backgroundColor: '#0b0b0b',
      foregroundColor: '#ffffff',
      cardColor: '#111111',
      borderColor: '#222222',
      mutedColor: '#6b7280',
      successColor: '#22c55e',
      errorColor: '#ef4444',
      warningColor: '#f59e0b',
      themeMode: 'dark',
    });
    setTheme('dark');
    emitThemeUpdated();
    toast({
      title: 'Configurações restauradas',
      description: 'Todas as personalizações foram resetadas para o padrão.'
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Personalização</h1>
            <p className="text-muted-foreground">
              Customize a marca, cores e layout da plataforma
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar Padrão
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </Button>
          </div>
        </div>

        <Tabs defaultValue="brand" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="brand">Marca</TabsTrigger>
            <TabsTrigger value="colors">Cores</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="advanced">Avançado</TabsTrigger>
          </TabsList>

          {/* Aba Marca */}
          <TabsContent value="brand" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Identidade da Marca</CardTitle>
                <CardDescription>
                  Personalize o nome, logotipo e slogan da sua empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="brand-name">Nome da Empresa</Label>
                    <Input
                      id="brand-name"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="PrimeZapAI"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tagline">Slogan / Subtítulo</Label>
                    <Input
                      id="tagline"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="CRM & Omnichannel"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Logotipo</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-muted">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Fazer Upload do Logo
                      </Button>
                      {logoUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLogoUrl('')}
                        >
                          Remover Logo
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Formatos aceitos: PNG, JPG, SVG (máx. 2MB)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-muted">
                      {faviconUrl ? (
                        <img src={faviconUrl} alt="Favicon" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        ref={faviconInputRef}
                        type="file"
                        accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                        className="hidden"
                        onChange={handleFaviconUpload}
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => faviconInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Fazer Upload do Favicon
                      </Button>
                      {faviconUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFaviconUrl('')}
                        >
                          Remover Favicon
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Ícone quadrado 32x32 ou 64x64 pixels
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="welcome-message">Mensagem de Boas-vindas</Label>
                  <Textarea
                    id="welcome-message"
                    placeholder="Digite a mensagem que aparecerá no login..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informações de Contato</CardTitle>
                <CardDescription>
                  Dados exibidos no rodapé e em emails automáticos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email de Contato</Label>
                    <Input placeholder="contato@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input placeholder="+55 11 99999-9999" />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input placeholder="https://empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input placeholder="Rua, Número - Cidade" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Cores */}
          <TabsContent value="colors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Esquema de Cores</CardTitle>
                <CardDescription>
                  Personalize as cores da interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Primária', value: primaryColor, setter: setPrimaryColor },
                    { label: 'Destaque', value: accentColor, setter: setAccentColor },
                    { label: 'Fundo', value: backgroundColor, setter: setBackgroundColor },
                    { label: 'Texto', value: foregroundColor, setter: setForegroundColor },
                    { label: 'Card', value: cardColor, setter: setCardColor },
                    { label: 'Borda', value: borderColor, setter: setBorderColor },
                    { label: 'Muted', value: mutedColor, setter: setMutedColor },
                    { label: 'Sucesso', value: successColor, setter: setSuccessColor },
                    { label: 'Erro', value: errorColor, setter: setErrorColor },
                    { label: 'Aviso', value: warningColor, setter: setWarningColor },
                  ].map(({ label, value, setter }) => (
                    <div className="space-y-2" key={label}>
                      <Label>{label}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          placeholder="#6366f1"
                        />
                        <Button
                          variant="outline"
                          onClick={() => setter('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'))}
                        >
                          <Palette className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <Label>Temas Predefinidos</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { name: 'Azul', primary: '#6366f1', accent: '#8b5cf6' },
                      { name: 'Verde', primary: '#10b981', accent: '#059669' },
                      { name: 'Roxo', primary: '#8b5cf6', accent: '#a78bfa' },
                      { name: 'Laranja', primary: '#f97316', accent: '#fb923c' },
                    ].map((theme) => (
                      <Button
                        key={theme.name}
                        variant="outline"
                        className="h-16 flex flex-col gap-1"
                        onClick={() => {
                          setPrimaryColor(theme.primary);
                          setAccentColor(theme.accent);
                        }}
                      >
                        <div className="flex gap-1">
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: theme.primary }}
                          />
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: theme.accent }}
                          />
                        </div>
                        <span className="text-xs">{theme.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Modo Escuro por Padrão</Label>
                    <p className="text-xs text-muted-foreground">
                      Ativa o tema escuro ao fazer login
                    </p>
                  </div>
                  <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cores do Sidebar</CardTitle>
                <CardDescription>Overrides específicos do menu lateral (deixe em branco para herdar)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Fundo Sidebar', value: sidebarBackground ?? '', setter: setSidebarBackground, placeholder: '#0b0b0b' },
                    { label: 'Texto Sidebar', value: sidebarForeground ?? '', setter: setSidebarForeground, placeholder: '#ffffff' },
                    { label: 'Borda Sidebar', value: sidebarBorder ?? '', setter: setSidebarBorder, placeholder: '#222222' },
                    { label: 'Acento Sidebar', value: sidebarAccent ?? '', setter: setSidebarAccent, placeholder: '#111111' },
                  ].map(({ label, value, setter, placeholder }) => (
                    <div className="space-y-2" key={label}>
                      <Label>{label}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          placeholder={`${placeholder} (opcional)`}
                        />
                        <Button
                          variant="outline"
                          onClick={() => setter('#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0'))}
                        >
                          <Palette className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pré-visualização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-6 border rounded-lg space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Eye className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{brandName}</h3>
                      <p className="text-sm text-muted-foreground">{tagline}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button style={{ backgroundColor: primaryColor }}>
                      Botão Primário
                    </Button>
                    <Button variant="outline" style={{ borderColor: accentColor, color: accentColor }}>
                      Botão Secundário
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => applyCustomizationToDOM({
                        brandName,
                        tagline,
                        primaryHex: primaryColor,
                        accentHex: accentColor,
                        backgroundColor,
                        foregroundColor,
                        cardColor,
                        borderColor,
                        mutedColor,
                        successColor,
                        errorColor,
                        warningColor,
                        sidebarBackground,
                        sidebarForeground,
                        sidebarBorder,
                        sidebarAccent,
                        faviconUrl: faviconUrl || undefined,
                        logoUrl: logoUrl || undefined,
                        themeMode: darkMode ? 'dark' : 'light',
                      })}
                    >
                      <Eye className="mr-2 h-4 w-4" /> Pré-visualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Layout */}
          <TabsContent value="layout" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Layout</CardTitle>
                <CardDescription>
                  Ajuste a disposição e comportamento da interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Posição do Menu Lateral</Label>
                  <Select value={sidebarPosition} onValueChange={setSidebarPosition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Esquerda</SelectItem>
                      <SelectItem value="right">Direita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Modo Compacto</Label>
                    <p className="text-xs text-muted-foreground">
                      Reduz espaçamentos para exibir mais conteúdo
                    </p>
                  </div>
                  <Switch checked={compactMode} onCheckedChange={setCompactMode} />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Menu Lateral Recolhido por Padrão</Label>
                    <p className="text-xs text-muted-foreground">
                      Inicia com o menu lateral minimizado
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Animações Reduzidas</Label>
                    <p className="text-xs text-muted-foreground">
                      Diminui animações para melhor performance
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Avançado */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>CSS Personalizado</CardTitle>
                <CardDescription>
                  Adicione CSS customizado para personalizações avançadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={'/* Seu CSS personalizado aqui */\n.custom-class {\n  color: #333;\n}'}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  ⚠️ Use com cuidado. CSS incorreto pode quebrar o layout da aplicação.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Script Personalizado</CardTitle>
                <CardDescription>
                  Adicione scripts personalizados (Google Analytics, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={'<!-- Seu código HTML/JS aqui -->\n<script>\n  // Analytics, chatbots, etc.\n</script>'}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Scripts serão adicionados ao <head> da página
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
