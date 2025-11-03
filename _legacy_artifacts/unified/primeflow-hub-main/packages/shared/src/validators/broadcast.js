import { z } from 'zod';
export var createBroadcastSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    filters: z.object({
        tags: z.array(z.string()).optional(),
        sources: z.array(z.enum(['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'])).optional()
    }),
    script: z.array(z.object({
        type: z.string(),
        config: z.any()
    })),
    config: z.object({
        intervalSec: z.number().min(0).max(300),
        pauseEveryN: z.number().optional(),
        pauseForSec: z.number().optional(),
        connectionId: z.string().optional(),
        provider: z.string().optional(),
        channel: z.enum(['whatsapp', 'facebook', 'instagram']).optional(),
        delay: z.number().optional(),
        jitter: z.number().optional(),
        signature: z.object({
            enabled: z.boolean(),
            customName: z.string().optional()
        }).optional(),
        termsAcceptedAt: z.date().optional()
    })
});
