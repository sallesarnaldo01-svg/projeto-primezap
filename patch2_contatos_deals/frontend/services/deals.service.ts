/**
 * Deals Service - Frontend
 * Primeflow-Hub - Patch 2
 * 
 * Service para gerenciamento de deals (negócios/oportunidades)
 */

import { supabase } from '@/lib/supabase';

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  contactId: string;
  userId?: string;
  expectedCloseDate?: string;
  probability?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  contact?: any;
  user?: any;
}

export interface DealFilters {
  stage?: string;
  userId?: string;
  contactId?: string;
  minValue?: number;
  maxValue?: number;
}

export const dealsService = {
  /**
   * Buscar todos os deals com filtros opcionais
   */
  async getDeals(filters?: DealFilters): Promise<Deal[]> {
    let query = supabase
      .from('deals')
      .select('*, contact(*), user(*)')
      .order('created_at', { ascending: false });
    
    // Filtro de estágio
    if (filters?.stage) {
      query = query.eq('stage', filters.stage);
    }
    
    // Filtro de usuário
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    
    // Filtro de contato
    if (filters?.contactId) {
      query = query.eq('contact_id', filters.contactId);
    }
    
    // Filtro de valor mínimo
    if (filters?.minValue !== undefined) {
      query = query.gte('value', filters.minValue);
    }
    
    // Filtro de valor máximo
    if (filters?.maxValue !== undefined) {
      query = query.lte('value', filters.maxValue);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching deals:', error);
      throw new Error(`Erro ao buscar deals: ${error.message}`);
    }
    
    return data || [];
  },

  /**
   * Buscar deals agrupados por estágio (para Kanban)
   */
  async getDealsByStage(): Promise<Record<string, Deal[]>> {
    const deals = await this.getDeals();
    
    const stages = [
      'lead',
      'contato',
      'qualificacao',
      'proposta',
      'negociacao',
      'ganho',
      'perdido',
    ];
    
    const dealsByStage: Record<string, Deal[]> = {};
    
    stages.forEach(stage => {
      dealsByStage[stage] = deals.filter(d => d.stage === stage);
    });
    
    return dealsByStage;
  },

  /**
   * Buscar um deal por ID
   */
  async getDealById(id: string): Promise<Deal> {
    const { data, error } = await supabase
      .from('deals')
      .select('*, contact(*), user(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching deal:', error);
      throw new Error(`Erro ao buscar deal: ${error.message}`);
    }
    
    return data;
  },

  /**
   * Criar novo deal
   */
  async createDeal(deal: Partial<Deal>): Promise<Deal> {
    const { data, error } = await supabase
      .from('deals')
      .insert({
        title: deal.title,
        value: deal.value || 0,
        stage: deal.stage || 'lead',
        contact_id: deal.contactId,
        user_id: deal.userId,
        expected_close_date: deal.expectedCloseDate,
        probability: deal.probability || 0,
        notes: deal.notes,
      })
      .select('*, contact(*), user(*)')
      .single();
    
    if (error) {
      console.error('Error creating deal:', error);
      throw new Error(`Erro ao criar deal: ${error.message}`);
    }
    
    return data;
  },

  /**
   * Atualizar deal existente
   */
  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    const { data, error } = await supabase
      .from('deals')
      .update({
        title: updates.title,
        value: updates.value,
        stage: updates.stage,
        contact_id: updates.contactId,
        user_id: updates.userId,
        expected_close_date: updates.expectedCloseDate,
        probability: updates.probability,
        notes: updates.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, contact(*), user(*)')
      .single();
    
    if (error) {
      console.error('Error updating deal:', error);
      throw new Error(`Erro ao atualizar deal: ${error.message}`);
    }
    
    return data;
  },

  /**
   * Atualizar estágio do deal (para drag-and-drop)
   */
  async updateDealStage(id: string, newStage: string): Promise<Deal> {
    // Atualizar probabilidade baseado no estágio
    const probabilityMap: Record<string, number> = {
      lead: 10,
      contato: 20,
      qualificacao: 40,
      proposta: 60,
      negociacao: 80,
      ganho: 100,
      perdido: 0,
    };
    
    const { data, error } = await supabase
      .from('deals')
      .update({
        stage: newStage,
        probability: probabilityMap[newStage] || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, contact(*), user(*)')
      .single();
    
    if (error) {
      console.error('Error updating deal stage:', error);
      throw new Error(`Erro ao atualizar estágio: ${error.message}`);
    }
    
    return data;
  },

  /**
   * Deletar deal
   */
  async deleteDeal(id: string): Promise<void> {
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting deal:', error);
      throw new Error(`Erro ao deletar deal: ${error.message}`);
    }
  },

  /**
   * Executar ação de IA em massa
   */
  async bulkAIAction(dealIds: string[], command: string): Promise<{
    success: number;
    failed: number;
    results: any[];
  }> {
    const response = await fetch('/api/deals/bulk-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealIds, command }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao executar ação em massa');
    }
    
    return response.json();
  },

  /**
   * Buscar estatísticas de deals
   */
  async getStats(): Promise<{
    total: number;
    totalValue: number;
    ganhos: number;
    ganhosValue: number;
    perdidos: number;
    taxaConversao: number;
  }> {
    const deals = await this.getDeals();
    
    const ganhos = deals.filter(d => d.stage === 'ganho');
    const perdidos = deals.filter(d => d.stage === 'perdido');
    const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const ganhosValue = ganhos.reduce((sum, d) => sum + (d.value || 0), 0);
    
    return {
      total: deals.length,
      totalValue,
      ganhos: ganhos.length,
      ganhosValue,
      perdidos: perdidos.length,
      taxaConversao: deals.length > 0 
        ? (ganhos.length / deals.length) * 100 
        : 0,
    };
  },

  /**
   * Buscar histórico de mudanças do deal
   */
  async getHistory(dealId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('deal_history')
      .select('*, user(*)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching deal history:', error);
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }
    
    return data || [];
  },

  /**
   * Adicionar nota ao deal
   */
  async addNote(dealId: string, note: string): Promise<void> {
    const deal = await this.getDealById(dealId);
    const currentNotes = deal.notes || '';
    const timestamp = new Date().toLocaleString('pt-BR');
    const updatedNotes = `${currentNotes}\n\n[${timestamp}]\n${note}`;
    
    await this.updateDeal(dealId, { notes: updatedNotes });
  },

  /**
   * Marcar deal como ganho
   */
  async markAsWon(dealId: string): Promise<Deal> {
    return this.updateDealStage(dealId, 'ganho');
  },

  /**
   * Marcar deal como perdido
   */
  async markAsLost(dealId: string, reason?: string): Promise<Deal> {
    const deal = await this.updateDealStage(dealId, 'perdido');
    
    if (reason) {
      await this.addNote(dealId, `Motivo da perda: ${reason}`);
    }
    
    return deal;
  },
};

