import { apiClient } from '@/lib/api-client';

export type AIProviderType = 'LOVABLE' | 'OPENAI' | 'MANUS' | 'GEMINI' | 'CLAUDE';

export interface AIProvider {
  id: string;
  tenantId: string;
  type: AIProviderType;
  name: string;
  apiKey?: string;
  config?: AIProviderConfig;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  agents?: AIAgent[];
}

export interface AIAgent {
  id: string;
  tenantId: string;
  providerId: string;
  name: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  active: boolean;
  config?: AIProviderConfig;
  createdAt: string;
  updatedAt: string;
  provider?: {
    id: string;
    type: AIProviderType;
    name: string;
  };
}

export interface CreateProviderData {
  type: AIProviderType;
  name: string;
  apiKey?: string;
  config?: AIProviderConfig;
}

export interface UpdateProviderData {
  name?: string;
  apiKey?: string;
  config?: AIProviderConfig;
  active?: boolean;
}

export interface CreateAgentData {
  providerId: string;
  name: string;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  config?: AIProviderConfig;
}

export interface UpdateAgentData {
  name?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  config?: AIProviderConfig;
  active?: boolean;
}

export type AIProviderConfig = Record<string, unknown>;

export const aiProvidersService = {
  // Provedores
  async listProviders(): Promise<AIProvider[]> {
    const response = await apiClient.get<AIProvider[]>('/ai/providers');
    return response.data;
  },

  async createProvider(data: CreateProviderData): Promise<AIProvider> {
    const response = await apiClient.post<AIProvider>('/ai/providers', data);
    return response.data;
  },

  async updateProvider(id: string, data: UpdateProviderData): Promise<AIProvider> {
    const response = await apiClient.put<AIProvider>(`/ai/providers/${id}`, data);
    return response.data;
  },

  async deleteProvider(id: string): Promise<void> {
    await apiClient.delete(`/ai/providers/${id}`);
  },

  // Agentes
  async listAgents(): Promise<AIAgent[]> {
    const response = await apiClient.get<AIAgent[]>('/ai/agents');
    return response.data;
  },

  async createAgent(data: CreateAgentData): Promise<AIAgent> {
    const response = await apiClient.post<AIAgent>('/ai/agents', data);
    return response.data;
  },

  async updateAgent(id: string, data: UpdateAgentData): Promise<AIAgent> {
    const response = await apiClient.put<AIAgent>(`/ai/agents/${id}`, data);
    return response.data;
  },

  async deleteAgent(id: string): Promise<void> {
    await apiClient.delete(`/ai/agents/${id}`);
  },

  // Teste
  async testAgent(agentId: string, message: string): Promise<Record<string, unknown>> {
    const response = await apiClient.post<Record<string, unknown>>('/ai/test', { agentId, message });
    return response.data;
  }
};
