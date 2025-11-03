import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dealsService, type Deal } from '@/services/deals';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CommissionRule = {
  name: string;
  rate: number; // 0.05 = 5%
};

const RULES: CommissionRule[] = [
  { name: 'Padrão (5%)', rate: 0.05 },
  { name: 'Imobiliário (6%)', rate: 0.06 },
  { name: 'Parceria (10%)', rate: 0.10 },
];

export default function Comissoes() {
  const [ruleIndex, setRuleIndex] = useState(0);
  const rule = RULES[ruleIndex];

  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals', 'all'],
    queryFn: () => dealsService.getDeals(),
  });

  const closedDeals = useMemo(() => {
    return (deals || []).filter((d) => (d.probability ?? 0) >= 100);
  }, [deals]);

  const totalsByOwner = useMemo(() => {
    const map = new Map<string, { owner: string; value: number; commission: number; count: number }>();
    for (const d of closedDeals) {
      const owner = d.owner?.name || '—';
      const current = map.get(owner) || { owner, value: 0, commission: 0, count: 0 };
      current.value += d.value || 0;
      current.commission += (d.value || 0) * rule.rate;
      current.count += 1;
      map.set(owner, current);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [closedDeals, rule.rate]);

  const grandTotals = useMemo(() => {
    const value = totalsByOwner.reduce((s, o) => s + o.value, 0);
    const commission = totalsByOwner.reduce((s, o) => s + o.commission, 0);
    const count = totalsByOwner.reduce((s, o) => s + o.count, 0);
    return { value, commission, count };
  }, [totalsByOwner]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comissões</h1>
          <p className="text-muted-foreground mt-1">Cálculo a partir de deals fechados (probabilidade 100%)</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(ruleIndex)} onValueChange={(v) => setRuleIndex(Number(v))}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Regra de comissão" />
            </SelectTrigger>
            <SelectContent>
              {RULES.map((r, i) => (
                <SelectItem key={i} value={String(i)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
          <CardDescription>Taxa aplicada: {(rule.rate * 100).toFixed(1)}%</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left">
                  <tr>
                    <th className="py-2">Responsável</th>
                    <th className="py-2">Qtd de Deals</th>
                    <th className="py-2">Valor Fechado</th>
                    <th className="py-2">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {totalsByOwner.map((row) => (
                    <tr key={row.owner} className="border-b last:border-none">
                      <td className="py-2">{row.owner}</td>
                      <td className="py-2">{row.count}</td>
                      <td className="py-2">{row.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="py-2 font-medium">{row.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  ))}
                  {totalsByOwner.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum deal fechado encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
                {totalsByOwner.length > 0 && (
                  <tfoot>
                    <tr>
                      <td className="py-2 font-semibold">Total</td>
                      <td className="py-2 font-semibold">{grandTotals.count}</td>
                      <td className="py-2 font-semibold">{grandTotals.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="py-2 font-semibold">{grandTotals.commission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
