import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useScrum } from '@/hooks/useScrum';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function CeremonyDialog({ open, onOpenChange }: Props) {
  const { startCeremony } = useScrum();
  const [type, setType] = useState<'daily' | 'review' | 'retro' | 'planning'>('daily');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Iniciar Cerimônia</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="retro">Retrospective</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={async () => {
              try {
                await startCeremony(type);
                toast.success('Cerimônia iniciada');
                onOpenChange(false);
              } catch (e) {
                toast.error('Falha ao iniciar cerimônia');
              }
            }}
          >
            Iniciar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

