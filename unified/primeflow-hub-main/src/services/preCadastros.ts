import { api } from './api';

export type PreCadastroStatus = 'NOVA_AVALIACAO' | 'APROVADO' | 'PENDENTE' | 'EM_ANALISE' | 'REJEITADO';

export interface PreCadastro {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  status: PreCadastroStatus;
  statusLabel?: string;

  leadId?: string;
  leadName?: string;

  empreendimento?: string;
  bloco?: string;
  unidade?: string;

  avaliacaoValor?: number;
  aprovadoValor?: number;
  subsidioValor?: number;
  fgtsValor?: number;
  rendaMensal?: number;
  rendaFamiliar?: number;
  prazoMeses?: number;
  prestacaoValor?: number;
  vencimentoAprovacao?: string;

  correspondenteId?: string;
  correspondenteName?: string;

  observacoes?: string;
}

export const statusToLabel = (s: PreCadastroStatus): string => {
  switch (s) {
    case 'NOVA_AVALIACAO': return 'Nova Avaliação';
    case 'APROVADO': return 'Aprovado';
    case 'PENDENTE': return 'Pendente';
    case 'EM_ANALISE': return 'Em Análise';
    case 'REJEITADO': return 'Rejeitado';
  }
};

export async function listPreCadastros(filters?: { leadId?: string; correspondente_id?: string; empreendimento_id?: string }): Promise<PreCadastro[]> {
  try {
    const res = await api.get<PreCadastro[]>('/api/pre-cadastros', filters as any);
    return res.data.map((x) => ({ ...x, statusLabel: statusToLabel(x.status) }));
  } catch {
    // fallback empty
    return [];
  }
}

export async function createPreCadastro(payload: Partial<PreCadastro>): Promise<PreCadastro> {
  const body = { ...payload };
  const res = await api.post<PreCadastro>('/api/pre-cadastros', body);
  return { ...res.data, statusLabel: statusToLabel(res.data.status) };
}

export async function getPreCadastro(id: string): Promise<PreCadastro> {
  const res = await api.get<PreCadastro>(`/api/pre-cadastros/${id}`);
  const d = res.data;
  return { ...d, statusLabel: statusToLabel(d.status) };
}

export function calcDocsProgress(item: PreCadastro, docs?: { status?: string }[]): number {
  // simplistic: percentage of docs with status APPROVED among required
  if (!docs || docs.length === 0) return 0;
  const required = docs.length;
  const ok = docs.filter((d) => d.status === 'APROVADO').length;
  return Math.round((ok / required) * 100);
}
