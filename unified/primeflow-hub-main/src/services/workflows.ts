import { apiClient } from '@/lib/api-client';

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  graphJson: WorkflowGraph;
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  version: number;
  triggerConfig?: WorkflowConfig;
  rateLimitConfig?: WorkflowConfig;
  tags: string[];
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  tenantId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  triggerData?: WorkflowPayload;
  contextData?: WorkflowPayload;
  result?: WorkflowPayload;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface WorkflowLog {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
  inputData?: WorkflowPayload;
  outputData?: WorkflowPayload;
  errorMessage?: string;
  tokensUsed?: number;
  costBrl?: number;
  durationMs?: number;
  executedAt: string;
}

export type WorkflowGraph = Record<string, unknown>;

export type WorkflowConfig = Record<string, unknown>;

export type WorkflowPayload = Record<string, unknown>;

export const workflowsService = {
  async getWorkflows(status?: string): Promise<Workflow[]> {
    const response = await apiClient.get<Workflow[]>('/workflows', { params: { status } });
    return response.data;
  },

  async getWorkflowById(id: string): Promise<Workflow> {
    const response = await apiClient.get<Workflow>(`/workflows/${id}`);
    return response.data;
  },

  async createWorkflow(data: Partial<Workflow>): Promise<Workflow> {
    const response = await apiClient.post<Workflow>('/workflows', data);
    return response.data;
  },

  async updateWorkflow(id: string, data: Partial<Workflow>): Promise<Workflow> {
    const response = await apiClient.put<Workflow>(`/workflows/${id}`, data);
    return response.data;
  },

  async deleteWorkflow(id: string): Promise<void> {
    await apiClient.delete(`/workflows/${id}`);
  },

  async publishWorkflow(id: string): Promise<Workflow> {
    const response = await apiClient.post<Workflow>(`/workflows/${id}/publish`);
    return response.data;
  },

  async pauseWorkflow(id: string): Promise<Workflow> {
    const response = await apiClient.post<Workflow>(`/workflows/${id}/pause`);
    return response.data;
  },

  async duplicateWorkflow(id: string, name: string): Promise<Workflow> {
    const response = await apiClient.post<Workflow>(`/workflows/${id}/duplicate`, { name });
    return response.data;
  },

  async validateWorkflow(graphJson: WorkflowGraph): Promise<{ valid: boolean; errors: string[] }> {
    const response = await apiClient.post<{ valid: boolean; errors: string[] }>(
      '/workflows/validate',
      { graphJson }
    );
    return response.data;
  },

  async getWorkflowRuns(workflowId: string, limit = 50, offset = 0): Promise<WorkflowRun[]> {
    const response = await apiClient.get<WorkflowRun[]>(`/workflows/${workflowId}/runs`, {
      params: { limit, offset }
    });
    return response.data;
  },

  async getWorkflowRunById(runId: string): Promise<WorkflowRun> {
    const response = await apiClient.get<WorkflowRun>(`/workflows/runs/${runId}`);
    return response.data;
  },

  async getWorkflowLogs(runId: string): Promise<WorkflowLog[]> {
    const response = await apiClient.get<WorkflowLog[]>(`/workflows/runs/${runId}/logs`);
    return response.data;
  }
};
