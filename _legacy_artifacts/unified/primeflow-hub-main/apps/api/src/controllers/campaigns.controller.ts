// apps/api/src/controllers/campaigns.controller.ts
import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { campaignQueue } from '../queues/campaign.queue';

/**
 * Controller para gerenciar campanhas de disparo programado
 */

// Listar todas as campanhas
export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status } = req.query;

    let query = supabase
      .from('campaigns')
      .select(`
        *,
        integration:integrations(id, platform, name),
        messages:campaign_messages(
          id,
          sequence_order,
          content,
          type,
          delay_after,
          typing_duration,
          recording_duration
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obter uma campanha específica
export const getCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        integration:integrations(*),
        messages:campaign_messages(*),
        recipients:campaign_recipients(
          *,
          contact:contacts(*)
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: error.message });
  }
};

// Criar nova campanha
export const createCampaign = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      name,
      description,
      integration_id,
      scheduled_at,
      delay_between_messages = 5,
      simulate_typing = true,
      simulate_recording = true,
      messages,
      contact_ids,
    } = req.body;

    // Validações
    if (!name || !integration_id) {
      return res.status(400).json({ 
        error: 'name and integration_id are required' 
      });
    }

    if (!messages || messages.length === 0) {
      return res.status(400).json({ 
        error: 'At least one message is required' 
      });
    }

    if (!contact_ids || contact_ids.length === 0) {
      return res.status(400).json({ 
        error: 'At least one contact is required' 
      });
    }

    // Criar campanha
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        integration_id,
        name,
        description,
        status: scheduled_at ? 'scheduled' : 'draft',
        scheduled_at,
        delay_between_messages,
        simulate_typing,
        simulate_recording,
        total_contacts: contact_ids.length,
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // Criar mensagens da campanha
    const campaignMessages = messages.map((msg: any, index: number) => ({
      campaign_id: campaign.id,
      sequence_order: index + 1,
      content: msg.content,
      type: msg.type || 'text',
      media_url: msg.media_url,
      delay_after: msg.delay_after || delay_between_messages,
      typing_duration: msg.typing_duration || calculateTypingDuration(msg.content),
      recording_duration: msg.recording_duration || 3,
    }));

    const { error: messagesError } = await supabase
      .from('campaign_messages')
      .insert(campaignMessages);

    if (messagesError) throw messagesError;

    // Criar destinatários
    const recipients = contact_ids.map((contactId: string) => ({
      campaign_id: campaign.id,
      contact_id: contactId,
      status: 'pending',
    }));

    const { error: recipientsError } = await supabase
      .from('campaign_recipients')
      .insert(recipients);

    if (recipientsError) throw recipientsError;

    res.status(201).json(campaign);
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
};

// Atualizar campanha
export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const updates = req.body;

    // Não permitir atualizar campanhas em execução
    const { data: existing } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (existing?.status === 'running') {
      return res.status(400).json({ 
        error: 'Cannot update running campaign' 
      });
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: error.message });
  }
};

// Iniciar campanha
export const startCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Buscar campanha
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status === 'running') {
      return res.status(400).json({ error: 'Campaign is already running' });
    }

    // Atualizar status
    await supabase
      .from('campaigns')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', id);

    // Adicionar à fila de processamento
    await campaignQueue.add('process-campaign', { campaignId: id });

    res.json({ message: 'Campaign started successfully' });
  } catch (error: any) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: error.message });
  }
};

// Pausar campanha
export const pauseCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: error.message });
  }
};

// Cancelar campanha
export const cancelCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error cancelling campaign:', error);
    res.status(500).json({ error: error.message });
  }
};

// Deletar campanha
export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Não permitir deletar campanhas em execução
    const { data: existing } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (existing?.status === 'running') {
      return res.status(400).json({ 
        error: 'Cannot delete running campaign. Pause it first.' 
      });
    }

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obter estatísticas da campanha
export const getCampaignStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Verificar se a campanha existe
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (campaignError) throw campaignError;

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Buscar estatísticas dos destinatários
    const { data: recipients, error: recipientsError } = await supabase
      .from('campaign_recipients')
      .select('status')
      .eq('campaign_id', id);

    if (recipientsError) throw recipientsError;

    const stats = {
      total: campaign.total_contacts,
      pending: recipients.filter((r) => r.status === 'pending').length,
      processing: recipients.filter((r) => r.status === 'processing').length,
      sent: recipients.filter((r) => r.status === 'sent').length,
      delivered: recipients.filter((r) => r.status === 'delivered').length,
      failed: recipients.filter((r) => r.status === 'failed').length,
      progress: campaign.total_contacts > 0 
        ? Math.round((campaign.sent_count / campaign.total_contacts) * 100)
        : 0,
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Alternar status da campanha (start/pause/cancel)
export const toggleCampaign = async (req: Request, res: Response) => {
  const action = String(req.body?.action ?? '').toLowerCase();

  if (action === 'start' || action === 'resume' || action === 'run') {
    return startCampaign(req, res);
  }

  if (action === 'pause') {
    return pauseCampaign(req, res);
  }

  if (action === 'cancel' || action === 'stop') {
    return cancelCampaign(req, res);
  }

  return res.status(400).json({
    error: 'Invalid action. Use one of: start, resume, pause, cancel.',
  });
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Calcular duração de digitação baseado no tamanho do texto
 * Simula velocidade de digitação humana (~40 palavras por minuto)
 */
function calculateTypingDuration(content: string): number {
  if (!content) return 0;
  
  const words = content.split(' ').length;
  const wordsPerMinute = 40;
  const seconds = Math.ceil((words / wordsPerMinute) * 60);
  
  // Mínimo 1 segundo, máximo 10 segundos
  return Math.max(1, Math.min(10, seconds));
}

export const campaignsController = {
  list: getCampaigns,
  get: getCampaign,
  create: createCampaign,
  update: updateCampaign,
  delete: deleteCampaign,
  toggle: toggleCampaign,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  getCampaignStats,
};
