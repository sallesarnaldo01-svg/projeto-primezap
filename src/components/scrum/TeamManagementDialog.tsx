import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useScrum } from '@/hooks/useScrum';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function TeamManagementDialog({ open, onOpenChange }: Props) {
  const { createTeam } = useScrum();
  const [name, setName] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Time</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Nome do Time</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Squad Alfa" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={async () => {
              if (!name.trim()) return;
              try {
                await createTeam({ name });
                toast.success('Time criado');
                onOpenChange(false);
                setName('');
              } catch (e) {
                toast.error('Falha ao criar time');
              }
            }}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

