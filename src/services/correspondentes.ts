import { api } from './api';

export interface Correspondente {
  id: string;
  nome: string;
  cnpj: string;
  contato?: string;
  email?: string;
  status: 'ATIVO' | 'INATIVO';
}

export interface CorrespondenteUser {
  id: string;
  correspondenteId: string;
  nome: string;
  email: string;
  telefone?: string;
}

export async function listCorrespondentes(): Promise<Correspondente[]> {
  try {
    const res = await api.get<Correspondente[]>('/correspondentes');
    return res.data;
  } catch {
    return [];
  }
}

export async function createCorrespondente(payload: Partial<Correspondente>): Promise<Correspondente> {
  const res = await api.post<Correspondente>('/correspondentes', payload);
  return res.data;
}

export async function deleteCorrespondente(payload: { id: string }): Promise<void> {
  await api.delete(`/correspondentes/${payload.id}`);
}

export async function listCorrespondenteUsers(payload: { correspondenteId: string }): Promise<CorrespondenteUser[]> {
  const res = await api.get<CorrespondenteUser[]>(`/correspondentes/${payload.correspondenteId}/users`);
  return res.data;
}

export async function createCorrespondenteUser(payload: Partial<CorrespondenteUser> & { correspondenteId: string }): Promise<CorrespondenteUser> {
  const res = await api.post<CorrespondenteUser>(`/correspondentes/${payload.correspondenteId}/users`, payload);
  return res.data;
}

export async function deleteCorrespondenteUser(payload: { id: string }): Promise<void> {
  await api.delete(`/correspondentes/users/${payload.id}`);
}

export async function assignCorrespondente(payload: { preCadastroId: string; correspondenteId: string; userId?: string }): Promise<void> {
  await api.post(`/pre-cadastros/${payload.preCadastroId}/assign-correspondente`, payload);
}
