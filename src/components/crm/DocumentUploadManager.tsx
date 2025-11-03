// Imported from primeflow-hub-main3 (adapted paths if needed)
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadDocumento, listDocumentos, approveDocumento, rejectDocumento, type DocumentoItem } from '@/services/documentos';
import { toast } from 'sonner';

export default function DocumentUploadManager({ preCadastroId }: { preCadastroId: string }) {
  const [docs, setDocs] = useState<DocumentoItem[]>([]);
  const [tipo, setTipo] = useState<string>('');
  const [pessoa, setPessoa] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        setDocs(await listDocumentos({ preCadastroId }));
      } catch {}
    })();
  }, [preCadastroId]);

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-2">
        <div>
          <Label>Tipo</Label>
          <Input placeholder="RG, CPF, Renda…" value={tipo} onChange={(e) => setTipo(e.target.value)} />
        </div>
        <div>
          <Label>Pessoa</Label>
          <Input placeholder="Titular, Cônjuge…" value={pessoa} onChange={(e) => setPessoa(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <input id="docFile" type="file" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              await uploadDocumento({ preCadastroId, file });
              setDocs(await listDocumentos({ preCadastroId }));
              toast.success('Documento enviado.');
            } catch {
              toast.error('Falha ao enviar.');
            } finally {
              e.currentTarget.value = '';
            }
          }}/>
          <Button onClick={() => document.getElementById('docFile')?.click()}>Enviar</Button>
        </div>
      </div>

      <div className="space-y-2">
        {docs.map((d) => (
          <div className="flex items-center justify-between p-2 border rounded-md" key={d.id}>
            <div className="text-sm">
              <div className="font-medium">{d.tipoLabel ?? d.tipo} • {d.pessoa ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{d.statusLabel}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(d.url, '_blank')}>Ver</Button>
              <Button variant="secondary" size="sm" onClick={async () => { await approveDocumento({ id: d.id }); setDocs(await listDocumentos({ preCadastroId })); }}>Aprovar</Button>
              <Button variant="destructive" size="sm" onClick={async () => { await rejectDocumento({ id: d.id }); setDocs(await listDocumentos({ preCadastroId })); }}>Rejeitar</Button>
            </div>
          </div>
        ))}
        {docs.length === 0 && <div className="text-sm text-muted-foreground">Nenhum documento enviado.</div>}
      </div>
    </div>
  );
}

