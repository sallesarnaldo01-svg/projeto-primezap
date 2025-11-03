import { api } from './api';
import supabase from '@/lib/supabaseClient';

export type DocumentoStatus = 'PENDENTE' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'REJEITADO';
export type DocumentoEtapa = 'LEAD' | 'DEAL' | 'PRE_CADASTRO';

export interface DocumentoTipo {
  id: string;
  nome: string;
  etapa: DocumentoEtapa;
  etapaLabel?: string;
  obrigatorio: boolean;
}

export interface DocumentoItem {
  id: string;
  preCadastroId?: string;
  leadId?: string;
  dealId?: string;
  tipo: string;
  tipoLabel?: string;
  pessoa?: string;
  status: DocumentoStatus;
  statusLabel?: string;
  url: string;
  uploadedAt: string;
}

const etapaToLabel = (e: DocumentoEtapa) => ({ LEAD: 'Lead', DEAL: 'Deal', PRE_CADASTRO: 'Pré‑Cadastro' }[e]);
const statusToLabel = (s: DocumentoStatus) => ({ PENDENTE: 'Pendente', AGUARDANDO_APROVACAO: 'Aguardando aprovação', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado' }[s]);

export async function listTipos(): Promise<DocumentoTipo[]> {
  try {
    const res = await api.get<DocumentoTipo[]>('/documentos/tipos');
    return res.data.map((x) => ({ ...x, etapaLabel: etapaToLabel(x.etapa) }));
  } catch {
    return [];
  }
}

export async function createTipo(payload: Partial<DocumentoTipo>): Promise<DocumentoTipo> {
  const res = await api.post<DocumentoTipo>('/documentos/tipos', payload);
  return { ...res.data, etapaLabel: etapaToLabel(res.data.etapa) };
}

export async function deleteTipo(payload: { id: string }): Promise<void> {
  await api.delete(`/documentos/tipos/${payload.id}`);
}

export async function listDocumentos(payload: { preCadastroId?: string; leadId?: string; dealId?: string }): Promise<DocumentoItem[]> {
  const res = await api.get<DocumentoItem[]>('/documentos', payload);
  return res.data.map((x) => ({ ...x, statusLabel: statusToLabel(x.status) }));
}

export async function uploadDocumento(payload: { preCadastroId?: string; leadId?: string; dealId?: string; file: File }): Promise<void> {
  // Prefer backend signed URL if available
  try {
    const { data } = await api.post<{ uploadUrl: string; path: string }>(
      '/documentos/upload-url',
      { preCadastroId: payload.preCadastroId, leadId: payload.leadId, dealId: payload.dealId, filename: payload.file.name },
    );
    await fetch(data.uploadUrl, { method: 'PUT', body: payload.file });
    await api.post('/documentos/commit', { path: data.path });
    return;
  } catch {
    // Fallback to Supabase Storage (requires proper bucket/policies)
    const bucket = 'documents';
    const folder = payload.preCadastroId ? `pre-cadastros/${payload.preCadastroId}` : payload.leadId ? `leads/${payload.leadId}` : `deals/${payload.dealId}`;
    const path = `${folder}/${Date.now()}-${payload.file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, payload.file, { upsert: true });
    if (error) throw error;
    await api.post('/documentos/commit', { path: `${bucket}/${path}`, preCadastroId: payload.preCadastroId, leadId: payload.leadId, dealId: payload.dealId });
  }
}

export async function approveDocumento(payload: { id: string }): Promise<void> {
  await api.post(`/documentos/${payload.id}/approve`);
}

export async function rejectDocumento(payload: { id: string }): Promise<void> {
  await api.post(`/documentos/${payload.id}/reject`);
}

export async function downloadZip(payload: { preCadastroId?: string; leadId?: string; dealId?: string }): Promise<void> {
  const endpoint = '/api/documentos/download-zip';
  const res = await fetch(endpoint + `?` + new URLSearchParams(payload as any), { credentials: 'include' });
  if (!res.ok) throw new Error('Falha ao gerar ZIP');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'documentos.zip';
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPdf(payload: { preCadastroId?: string; leadId?: string; dealId?: string }): Promise<void> {
  const endpoint = '/api/documentos/download-pdf';
  const res = await fetch(endpoint + `?` + new URLSearchParams(payload as any), { credentials: 'include' });
  if (!res.ok) throw new Error('Falha ao gerar PDF');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'documentos.pdf';
  a.click();
  URL.revokeObjectURL(url);
}
