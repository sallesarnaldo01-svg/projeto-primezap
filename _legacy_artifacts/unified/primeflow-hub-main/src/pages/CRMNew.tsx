import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dealsService, type Deal } from '@/services/deals';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from '@/components/KanbanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Board = Record<string, Deal[]>; // key = stage name

export default function CRMNew() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: board, isLoading, refetch } = useQuery({
    queryKey: ['deals', 'by-stage'],
    queryFn: dealsService.getDealsByStage,
  });

  const { data: stats } = useQuery({
    queryKey: ['deals', 'stats'],
    queryFn: dealsService.getStats,
  });

  const moveStage = useMutation({
    mutationFn: ({ dealId, stage }: { dealId: string; stage: string }) => dealsService.moveStage({ dealId, stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals', 'by-stage'] });
      qc.invalidateQueries({ queryKey: ['deals', 'stats'] });
    },
  });

  const stages = useMemo(() => Object.keys(board || {}), [board]);

  const filteredBoard: Board = useMemo(() => {
    if (!board) return {} as Board;
    if (!search.trim()) return board;
    const s = search.toLowerCase();
    const out: Board = {} as Board;
    for (const key of Object.keys(board)) {
      out[key] = (board[key] || []).filter((d) =>
        d.title.toLowerCase().includes(s) || d.contact?.name?.toLowerCase().includes(s)
      );
    }
    return out;
  }, [board, search]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) return;
    const dealId = String(active.id);
    const targetStage = String(over.id);
    moveStage.mutate({ dealId, stage: targetStage });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM (Novo)</h1>
          <p className="text-muted-foreground mt-1">Kanban com arrastar & soltar, integrado ao backend</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Buscar deals/contatos" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>Atualizar</Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="outline">Total: {stats?.total ?? 0}</Badge>
        <Badge variant="outline">Receita: R$ {(stats?.totalValue ?? 0).toLocaleString('pt-BR')}</Badge>
        <Badge variant="outline">Ganhos: {stats?.ganhos ?? 0}</Badge>
        <Badge variant="outline">Conversão: {((stats?.taxaConversao ?? 0)).toFixed(1)}%</Badge>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando deals…</div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {stages.map((stageName) => (
              <Card key={stageName}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate" title={stageName}>{stageName}</span>
                    <Badge variant="secondary">{filteredBoard[stageName]?.length ?? 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SortableContext id={stageName} items={(filteredBoard[stageName] || []).map((d) => d.id)} strategy={rectSortingStrategy}>
                    <div className="space-y-2 min-h-[40px]" id={stageName}>
                      {(filteredBoard[stageName] || []).map((deal) => (
                        <KanbanCard
                          key={deal.id}
                          card={{
                            id: deal.id,
                            title: deal.title,
                            description: deal.contact?.name || '—',
                            priority: 'medium',
                            tags: deal.stage?.name ? [deal.stage.name] : [],
                            checklist: { total: 0, completed: 0 },
                            attachments: 0,
                            comments: 0,
                            dueDate: deal.expectedCloseDate || new Date().toISOString(),
                            assignee: deal.owner?.name,
                          }}
                          onClick={() => { /* open deal details modal (future) */ }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
