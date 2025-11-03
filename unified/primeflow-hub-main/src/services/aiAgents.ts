import { apiClient } from '@/lib/api-client';

export type AIAgentStatus = 'active' | 'inactive' | 'draft';

export interface AIAgent {
  id: string;
  name: string;
  description?: string | null;
  provider: string;
  model: string;
  temperature: number;
  topP: number;
  systemPrompt: string;
  instructions?: string | null;
  tags?: string[];
  status: AIAgentStatus;
  updatedAt?: string;
  createdAt?: string;
}

export interface CreateAIAgentPayload {
  name: string;
  description?: string;
  provider: string;
  model: string;
  temperature?: number;
  topP?: number;
  systemPrompt: string;
  instructions?: string;
  tags?: string[];
}

export interface UpdateAIAgentPayload extends Partial<CreateAIAgentPayload> {
  status?: AIAgentStatus;
}

type MaybeWrapped<T> = T | { data: T };

const unwrap = <T>(payload: MaybeWrapped<T>): T => {
  if (payload && typeof payload === 'object' && 'data' in (payload as any)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export const aiAgentsService = {
  async list(): Promise<AIAgent[]> {
    const response = await apiClient.get<MaybeWrapped<AIAgent[]>>('/ai/agents');
    return unwrap(response.data ?? response);
  },

  async get(id: string): Promise<AIAgent> {
    const response = await apiClient.get<MaybeWrapped<AIAgent>>(`/ai/agents/${id}`);
    return unwrap(response.data ?? response);
  },

  async create(payload: CreateAIAgentPayload): Promise<AIAgent> {
    const response = await apiClient.post<MaybeWrapped<AIAgent>>('/ai/agents', payload);
    return unwrap(response.data ?? response);
  },

  async update(id: string, payload: UpdateAIAgentPayload): Promise<AIAgent> {
    const response = await apiClient.put<MaybeWrapped<AIAgent>>(`/ai/agents/${id}`, payload);
    return unwrap(response.data ?? response);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/ai/agents/${id}`);
  },
};
