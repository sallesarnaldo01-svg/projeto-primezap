import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface LeadAction {
  id: string;
  title: string;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO';
}

export default function LeadActionsKanban({ leadId }: { leadId: string }) {
  const [actions, setActions] = useState<LeadAction[]>([]);

  const load = async () => {
    try {
      const { api } = await import('@/services/api');
      const res = await api.get<LeadAction[]>('/api/lead-actions', { leadId });
      setActions(res.data as any);
    } catch {}
  };

  useEffect(() => { load(); }, [leadId]);

  const createAction = async () => {
    const title = prompt('Título da ação');
    if (!title) return;
    const { api } = await import('@/services/api');
    await api.post('/api/lead-actions', { leadId, title });
    load();
  };

  const updateStatus = async (id: string, status: LeadAction['status']) => {
    const { api } = await import('@/services/api');
    await api.patch(`/api/lead-actions/${id}`, { status });
    load();
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO'].map((col) => (
        <Card key={col} className="p-3">
          <div className="font-medium mb-2">{col.replace('_', ' ')}</div>
          <div className="space-y-2">
            {actions.filter((a) => a.status === col).map((a) => (
              <div className="p-2 border rounded-md" key={a.id}>{a.title}</div>
            ))}
            {actions.filter((a) => a.status === col).length === 0 && (
              <div className="text-xs text-muted-foreground">Sem ações</div>
            )}
          </div>
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={createAction}>Adicionar</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
