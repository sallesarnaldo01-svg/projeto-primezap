import { env } from '../../config/env.js';
import { MessageProvider } from '../message.provider.js';
import { venomProvider } from './venom.provider.js';
import { baileysProvider } from './baileys.provider.js';

type ProviderKey = 'venom' | 'baileys';

const providers: Record<ProviderKey, MessageProvider> = {
  venom: venomProvider,
  baileys: baileysProvider
};

export function getWhatsAppProvider(providerKey: string = env.WHATSAPP_PROVIDER): MessageProvider {
  const key = providerKey as ProviderKey;
  const provider = providers[key];

  if (!provider) {
    throw new Error(`Unsupported WhatsApp provider "${providerKey}"`);
  }

  return provider;
}

export function listWhatsAppProviders(): ProviderKey[] {
  return Object.keys(providers) as ProviderKey[];
}
