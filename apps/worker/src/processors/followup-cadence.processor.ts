import { Job } from 'bullmq';
import axios from 'axios';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

interface FollowUpCadenceJob {
  tenantId: string;
  cadenceId: string;
  leadIds: string[];
  stepIndex: number;
}

export async function processFollowUpCadence(job: Job<FollowUpCadenceJob>) {
  const { tenantId, cadenceId, leadIds, stepIndex } = job.data;

  try {
    logger.info({ cadenceId, leadIds, stepIndex }, 'Processing follow-up cadence');

    const cadence = await prisma.followUpCadence.findFirst({
      where: { id: cadenceId, tenantId }
    });

    if (!cadence) {
      throw new Error('Cadence not found');
    }

    const steps = cadence.steps as any[];
    const currentStep = steps[stepIndex];

    if (!currentStep) {
      logger.info({ cadenceId, stepIndex }, 'No more steps in cadence');
      return { success: true, completed: true };
    }

    // Processar cada lead
    for (const leadId of leadIds) {
      try {
        const contact = await prisma.contacts.findUnique({
          where: { id: leadId }
        });

        if (!contact) {
          logger.warn({ leadId }, 'Contact not found for follow-up cadence');
          continue;
        }

        const integration = await resolveIntegration(contact, currentStep);

        // Registrar evento
        await prisma.conversationEvent.create({
          data: {
            tenantId,
            conversationId: leadId, // Usar leadId como conversationId por enquanto
            eventType: 'ai_action',
            actor: 'system',
            actorName: 'Follow-up Cadence',
            title: 'Follow-up cadence step',
            description: currentStep.message,
            metadata: {
              cadenceId,
              cadenceName: cadence.name,
              stepIndex,
              delay: currentStep.delay,
              channel: currentStep.channel ?? integration?.platform ?? null
            } as any
          }
        });

        if (integration) {
          await sendCadenceMessage({
            integration,
            contact,
            message: currentStep.message,
            channel: (currentStep.channel ?? integration.platform ?? 'whatsapp') as string
          });
          logger.info({ leadId, stepIndex }, 'Follow-up message sent');
        } else {
          logger.warn({ leadId, cadenceId }, 'Skipping follow-up message: no integration configured');
        }
      } catch (error) {
        logger.error({ error, leadId }, 'Failed to process lead in cadence');
      }
    }

    // Agendar próxima etapa se existir
    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex];
      logger.info({
        cadenceId,
        nextStepIndex,
        delay: nextStep.delay
      }, 'Scheduling next cadence step');
      const delayMinutes = Number(
        nextStep.delay_minutes ??
        nextStep.delayMinutes ??
        nextStep.delay ??
        0
      );
      const delayMs = Number.isFinite(delayMinutes)
        ? Math.max(0, delayMinutes) * 60 * 1000
        : 0;

      type QueueLike = {
        add: (
          name: string,
          data: unknown,
          options?: {
            delay?: number;
            attempts?: number;
            backoff?: { type: string; delay: number };
          }
        ) => Promise<unknown>;
      };

      const queueLike = (job as unknown as { queue?: QueueLike }).queue;
      if (!queueLike || typeof queueLike.add !== 'function') {
        logger.warn({ cadenceId }, 'Unable to schedule next cadence step: queue reference unavailable');
      } else {
        await queueLike.add(
          'followup-cadence-step',
          {
            tenantId,
            cadenceId,
            leadIds,
            stepIndex: nextStepIndex
          },
          {
            delay: delayMs,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            }
          }
        );
      }
    }

    return {
      success: true,
      processedLeads: leadIds.length,
      nextStepIndex: nextStepIndex < steps.length ? nextStepIndex : null
    };
  } catch (error) {
    logger.error({ error, cadenceId }, 'Failed to process follow-up cadence');
    throw error;
  }
}

async function resolveIntegration(contact: any, step: any): Promise<any | null> {
  const stepIntegrationId =
    step?.integrationId ?? step?.integration_id ?? step?.connectionId ?? null;

  if (stepIntegrationId) {
    const integration = await prisma.integrations.findFirst({
      where: { id: stepIntegrationId }
    });
    if (integration) {
      return integration;
    }
  }

  if (contact?.integration_id) {
    return prisma.integrations.findFirst({
      where: { id: contact.integration_id as string }
    });
  }

  return null;
}

interface SendCadenceMessageParams {
  integration: any;
  contact: any;
  message: string;
  channel: string;
}

async function sendCadenceMessage({
  integration,
  contact,
  message,
  channel
}: SendCadenceMessageParams): Promise<void> {
  const normalizedChannel = (channel ?? '').toLowerCase();
  const text = message?.toString()?.trim();

  if (!text) {
    logger.warn('Cadence step does not contain a message. Skipping send.');
    return;
  }

  switch (normalizedChannel) {
    case 'facebook':
      await sendFacebookMessage(integration, contact, text);
      break;
    case 'instagram':
      await sendInstagramMessage(integration, contact, text);
      break;
    case 'whatsapp':
    default:
      await sendWhatsAppMessage(integration, contact, text);
      break;
  }
}

async function sendWhatsAppMessage(integration: any, contact: any, body: string) {
  if (!contact?.phone) {
    throw new Error('Contact does not have a phone number for WhatsApp message');
  }

  const apiVersion = integration?.api_version ?? 'v18.0';
  if (!integration?.phone_number_id || !integration?.access_token) {
    throw new Error('WhatsApp integration missing credentials');
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: contact.phone,
    type: 'text',
    text: { body }
  };

  await axios.post(
    `https://graph.facebook.com/${apiVersion}/${integration.phone_number_id}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

async function sendFacebookMessage(integration: any, contact: any, body: string) {
  if (!contact?.facebook_id) {
    throw new Error('Contact does not have a Facebook ID for messenger message');
  }

  if (!integration?.access_token) {
    throw new Error('Facebook integration missing access token');
  }

  const apiVersion = integration?.api_version ?? 'v18.0';

  await axios.post(
    `https://graph.facebook.com/${apiVersion}/me/messages`,
    {
      recipient: { id: contact.facebook_id },
      message: { text: body }
    },
    {
      params: {
        access_token: integration.access_token
      }
    }
  );
}

async function sendInstagramMessage(integration: any, contact: any, body: string) {
  if (!contact?.instagram_id) {
    throw new Error('Contact does not have an Instagram ID for Direct message');
  }

  if (!integration?.access_token) {
    throw new Error('Instagram integration missing access token');
  }

  const apiVersion = integration?.api_version ?? 'v18.0';

  await axios.post(
    `https://graph.facebook.com/${apiVersion}/me/messages`,
    {
      recipient: { id: contact.instagram_id },
      message: { text: body }
    },
    {
      params: {
        access_token: integration.access_token
      }
    }
  );
}
