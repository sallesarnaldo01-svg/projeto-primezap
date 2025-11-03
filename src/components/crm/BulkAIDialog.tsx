import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { dealsService } from '@/services/deals';

interface BulkAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDeals: string[];
  onCompleted: () => void;
}

export function BulkAIDialog({ open, onOpenChange, selectedDeals = [], onCompleted }: BulkAIDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error('Digite um prompt para a IA executar');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const ids = Array.isArray(selectedDeals) ? selectedDeals : [];
      if (ids.length === 0) {
        toast.error('Selecione pelo menos um deal');
        return;
      }

      // Dispara processamento no backend/worker
      const res = await dealsService.bulkAIAction(ids, prompt);

      // Feedback incremental simples enquanto o worker processa
      for (let i = 0; i <= 100; i += 20) {
        await new Promise((r) => setTimeout(r, 200));
        setProgress(i);
      }

      toast.success(`Ação em massa enfileirada: ${res.queued}/${res.total} deals.`);
      onCompleted();
      onOpenChange(false);
      setPrompt('');
    } catch (error) {
      toast.error('Erro ao executar ação em massa com IA');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ação em Massa com IA
          </DialogTitle>
          <DialogDescription>
            Execute ações automatizadas com IA em {(Array.isArray(selectedDeals) ? selectedDeals.length : 0)} deals selecionados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A IA analisará cada lead individualmente considerando seu histórico, dados e contexto para executar a ação solicitada.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt para IA</Label>
            <Textarea
              id="prompt"
              placeholder="Exemplo: Qualifique os leads e envie mensagem personalizada de follow-up para cada um baseado em seu histórico"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              disabled={isProcessing}
            />
            <p className="text-sm text-muted-foreground">
              Seja específico sobre o que a IA deve fazer. Exemplos:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Atualizar status baseado no último contato</li>
              <li>Enviar mensagem personalizada de reativação</li>
              <li>Qualificar leads e adicionar tags apropriadas</li>
              <li>Agendar follow-up automático em X dias</li>
            </ul>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <Label>Processando...</Label>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                {progress}% - Analisando leads e executando ações
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing || !prompt.trim()}>
            <Sparkles className="mr-2 h-4 w-4" />
            {isProcessing ? 'Processando...' : 'Executar Ação em Massa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
