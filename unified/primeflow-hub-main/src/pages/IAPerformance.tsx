import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { aiUsageService, UsageStats } from '@/services/aiUsage';
import { ModernBarChart } from '@/components/charts/ModernBarChart';
import { ModernPieChart } from '@/components/charts/ModernPieChart';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type SupabaseUsageRow = {
  id?: string;
  model?: string | null;
  total_tokens?: number | null;
  cost?: number | string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
};

type ModelStats = {
  model: string;
  interactions: number;
  totalTokens: number;
  totalCost: number;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { message?: string };
    return maybeError.message ?? fallback;
  }
  return fallback;
};

export default function IAPerformance() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // @ts-expect-error - Supabase types may not include analytics table locally
      const { data: usageData, error } = await supabase
        .from('ai_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (!usageData || usageData.length === 0) {
        setStats({
          totalInteractions: 0,
          totalTokens: 0,
          totalCost: 0,
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          byModel: []
        });
        setLoading(false);
        return;
      }

      const rows: SupabaseUsageRow[] = usageData as SupabaseUsageRow[];

      const byModel = rows.reduce<Record<string, ModelStats>>((acc, usage) => {
        const model = usage.model ?? 'unknown';
        if (!acc[model]) {
          acc[model] = {
            model,
            interactions: 0,
            totalTokens: 0,
            totalCost: 0,
          };
        }

        acc[model].interactions += 1;
        acc[model].totalTokens += toNumber(usage.total_tokens);
        acc[model].totalCost += toNumber(usage.cost);
        return acc;
      }, {});

      const processedStats: UsageStats = {
        totalInteractions: rows.length,
        totalTokens: rows.reduce((sum, usage) => sum + toNumber(usage.total_tokens), 0),
        totalCost: rows.reduce((sum, usage) => sum + toNumber(usage.cost), 0),
        totalPromptTokens: rows.reduce((sum, usage) => sum + toNumber(usage.prompt_tokens), 0),
        totalCompletionTokens: rows.reduce((sum, usage) => sum + toNumber(usage.completion_tokens), 0),
        byModel: Object.values(byModel),
      };

      setStats(processedStats);
    } catch (error) {
      toast.error('Erro ao carregar estatísticas: ' + getErrorMessage(error, 'Erro desconhecido'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-6">Carregando...</div>;
  };

  if (!stats) {
    return <div className="container mx-auto p-6">Sem dados disponíveis</div>;
  }

  const barChartData = stats.byModel.map(m => ({
    name: m.model,
    Interações: m.interactions,
    Tokens: m.totalTokens,
    Custo: parseFloat(m.totalCost.toFixed(2))
  }));

  const pieChartData = stats.byModel.map(m => ({
    name: m.model,
    value: m.interactions
  }));

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Performance de IA</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total de Interações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalInteractions.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total de Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalTokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Custo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">R$ {stats.totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tokens de Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalPromptTokens.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModernBarChart
          data={barChartData}
          bars={[
            { dataKey: 'Interações', name: 'Interações', color: 'hsl(var(--primary))' },
            { dataKey: 'Tokens', name: 'Tokens', color: 'hsl(var(--secondary))' },
          ]}
          title="Uso por Modelo"
          description="Interações e tokens por modelo de IA"
        />

        <ModernPieChart
          data={pieChartData}
          title="Distribuição de Interações"
          description="Porcentagem de interações por modelo"
        />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detalhes por Modelo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.byModel.map((model) => (
                <div
                  key={model.model}
                  className="flex justify-between items-center p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{model.model}</p>
                    <p className="text-sm text-muted-foreground">
                      {model.interactions} interações
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R$ {model.totalCost.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      {model.totalTokens.toLocaleString()} tokens
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
