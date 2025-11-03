import { api } from './api';

export interface Empreendimento {
  id: string;
  nome: string;
  endereco?: string;
  descricao?: string;
}

export const empreendimentosService = {
  async list(): Promise<Empreendimento[]> {
    try {
      const res = await api.get<Empreendimento[]>('/api/empreendimentos');
      return res.data;
    } catch {
      return [];
    }
  },
};

