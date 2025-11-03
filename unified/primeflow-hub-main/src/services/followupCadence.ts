import { apiClient } from '@/lib/api-client';

export interface FollowUpCadence {
  id: string;
  name: string;
  trigger: FollowUpCadenceTrigger;
  steps: FollowUpCadenceStep[];
  active: boolean;
  createdAt: string;
}

export type FollowUpCadenceTrigger = Record<string, unknown>;

export interface FollowUpCadenceStep {
  id?: string;
  type: string;
  delayMinutes?: number;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FollowUpCadenceInput {
  name: string;
  trigger: FollowUpCadenceTrigger;
  steps: FollowUpCadenceStep[];
  active?: boolean;
}

export const followUpCadenceService = {
  async list(): Promise<FollowUpCadence[]> {
    const { data } = await apiClient.get<FollowUpCadence[]>('/ai/cadences');
    return data;
  },
  async create(cadence: FollowUpCadenceInput): Promise<FollowUpCadence> {
    const { data } = await apiClient.post<FollowUpCadence>('/ai/cadences', cadence);
    return data;
  },
  async update(id: string, cadence: Partial<FollowUpCadenceInput>): Promise<FollowUpCadence> {
    const { data } = await apiClient.put<FollowUpCadence>(`/ai/cadences/${id}`, cadence);
    return data;
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/ai/cadences/${id}`);
  }
};
