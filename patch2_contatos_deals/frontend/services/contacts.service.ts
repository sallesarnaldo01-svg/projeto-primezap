/**
 * Contacts Service - Frontend
 * Primeflow-Hub - Patch 2
 * 
 * Service para gerenciamento de contatos
 */

import { supabase } from '@/lib/supabase';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  origem?: string;
  leadStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactFilters {
  search?: string;
  tags?: string[];
  origem?: string;
  leadStatus?: string;
}

export const contactsService = {
  /**
   * Buscar todos os contatos com filtros opcionais
   */
  async getContacts(filters?: ContactFilters): Promise<Contact[]> {
    let query = supabase
      .from('contacts')
      .select('*, tags(*), conversations(count)')
      .order('created_at', { ascending: false });
    
    // Filtro de busca (nome ou telefone)
    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      );
    }
    
    // Filtro de tags
    if (filters?.tags?.length) {
      query = query.contains('tags', filters.tags);
    }
    
    // Filtro de origem
    if (filters?.origem) {
      query = query.eq('origem', filters.origem);
    }
    
    // Filtro de status de lead
    if (filters?.leadStatus) {
      query = query.eq('lead_status', filters.leadStatus);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching contacts:', error);
      throw new Error(`Erro ao buscar contatos: ${error.message}`);
    }
    
    return data || [];
  },

  /**
   * Buscar um contato por ID
   */
  async getContactById(id: string): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, tags(*), conversations(*)')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching contact:', error);
      throw new Error(`Erro ao buscar contato: ${error.message}`);
    }
    
    return data;
  },

  /**
   * Criar novo contato
   */
  async createContact(contact: Partial<Contact>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        tags: contact.tags || [],
        origem: contact.origem || 'manual',
        lead_status: contact.leadStatus || 'novo',
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating contact:', error);
      throw new Error(`Erro ao criar contato: ${error.message}`);
    }
    
    return data;
  },

  /**
   * Atualizar contato existente
   */
  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .update({
        name: updates.name,
        phone: updates.phone,
        email: updates.email,
        tags: updates.tags,
        origem: updates.origem,
        lead_status: updates.leadStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating contact:', error);
      throw new Error(`Erro ao atualizar contato: ${error.message}`);
    }
    
    return data;
  },

  /**
   * Deletar contato
   */
  async deleteContact(id: string): Promise<void> {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting contact:', error);
      throw new Error(`Erro ao deletar contato: ${error.message}`);
    }
  },

  /**
   * Importar contatos de arquivo CSV
   */
  async importCSV(file: File): Promise<{ imported: number; errors: number }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/contacts/import', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao importar CSV');
    }
    
    return response.json();
  },

  /**
   * Exportar contatos para CSV
   */
  async exportCSV(filters?: ContactFilters): Promise<void> {
    const contacts = await this.getContacts(filters);
    
    // Converter para CSV
    const headers = ['Nome', 'Telefone', 'Email', 'Tags', 'Origem', 'Status'];
    const rows = contacts.map(c => [
      c.name,
      c.phone,
      c.email || '',
      c.tags.join(', '),
      c.origem || '',
      c.leadStatus || '',
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Buscar timeline de atividades do contato
   */
  async getTimeline(contactId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('contact_activities')
      .select('*, user(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching timeline:', error);
      throw new Error(`Erro ao buscar timeline: ${error.message}`);
    }
    
    return data || [];
  },

  /**
   * Adicionar tag ao contato
   */
  async addTag(contactId: string, tag: string): Promise<Contact> {
    const contact = await this.getContactById(contactId);
    const updatedTags = [...new Set([...contact.tags, tag])];
    
    return this.updateContact(contactId, { tags: updatedTags });
  },

  /**
   * Remover tag do contato
   */
  async removeTag(contactId: string, tag: string): Promise<Contact> {
    const contact = await this.getContactById(contactId);
    const updatedTags = contact.tags.filter(t => t !== tag);
    
    return this.updateContact(contactId, { tags: updatedTags });
  },

  /**
   * Buscar estatísticas de contatos
   */
  async getStats(): Promise<{
    total: number;
    leads: number;
    qualificados: number;
    convertidos: number;
  }> {
    const [total, leads, qualificados, convertidos] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }),
      supabase.from('contacts').select('id', { count: 'exact', head: true }).contains('tags', ['lead']),
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('lead_status', 'qualificado'),
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('lead_status', 'convertido'),
    ]);
    
    return {
      total: total.count || 0,
      leads: leads.count || 0,
      qualificados: qualificados.count || 0,
      convertidos: convertidos.count || 0,
    };
  },
};

