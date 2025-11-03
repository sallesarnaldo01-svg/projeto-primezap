import { z } from 'zod';
export declare const createBroadcastSchema: z.ZodObject<{
    name: z.ZodString;
    filters: z.ZodObject<{
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sources: z.ZodOptional<z.ZodArray<z.ZodEnum<["WHATSAPP", "FACEBOOK", "INSTAGRAM"]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        tags?: string[] | undefined;
        sources?: ("WHATSAPP" | "FACEBOOK" | "INSTAGRAM")[] | undefined;
    }, {
        tags?: string[] | undefined;
        sources?: ("WHATSAPP" | "FACEBOOK" | "INSTAGRAM")[] | undefined;
    }>;
    script: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        config: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        type: string;
        config?: any;
    }, {
        type: string;
        config?: any;
    }>, "many">;
    config: z.ZodObject<{
        intervalSec: z.ZodNumber;
        pauseEveryN: z.ZodOptional<z.ZodNumber>;
        pauseForSec: z.ZodOptional<z.ZodNumber>;
        connectionId: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodString>;
        channel: z.ZodOptional<z.ZodEnum<["whatsapp", "facebook", "instagram"]>>;
        delay: z.ZodOptional<z.ZodNumber>;
        jitter: z.ZodOptional<z.ZodNumber>;
        signature: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            customName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            customName?: string | undefined;
        }, {
            enabled: boolean;
            customName?: string | undefined;
        }>>;
        termsAcceptedAt: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        intervalSec: number;
        delay?: number | undefined;
        pauseEveryN?: number | undefined;
        pauseForSec?: number | undefined;
        connectionId?: string | undefined;
        provider?: string | undefined;
        channel?: "whatsapp" | "facebook" | "instagram" | undefined;
        jitter?: number | undefined;
        signature?: {
            enabled: boolean;
            customName?: string | undefined;
        } | undefined;
        termsAcceptedAt?: Date | undefined;
    }, {
        intervalSec: number;
        delay?: number | undefined;
        pauseEveryN?: number | undefined;
        pauseForSec?: number | undefined;
        connectionId?: string | undefined;
        provider?: string | undefined;
        channel?: "whatsapp" | "facebook" | "instagram" | undefined;
        jitter?: number | undefined;
        signature?: {
            enabled: boolean;
            customName?: string | undefined;
        } | undefined;
        termsAcceptedAt?: Date | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    config: {
        intervalSec: number;
        delay?: number | undefined;
        pauseEveryN?: number | undefined;
        pauseForSec?: number | undefined;
        connectionId?: string | undefined;
        provider?: string | undefined;
        channel?: "whatsapp" | "facebook" | "instagram" | undefined;
        jitter?: number | undefined;
        signature?: {
            enabled: boolean;
            customName?: string | undefined;
        } | undefined;
        termsAcceptedAt?: Date | undefined;
    };
    filters: {
        tags?: string[] | undefined;
        sources?: ("WHATSAPP" | "FACEBOOK" | "INSTAGRAM")[] | undefined;
    };
    script: {
        type: string;
        config?: any;
    }[];
}, {
    name: string;
    config: {
        intervalSec: number;
        delay?: number | undefined;
        pauseEveryN?: number | undefined;
        pauseForSec?: number | undefined;
        connectionId?: string | undefined;
        provider?: string | undefined;
        channel?: "whatsapp" | "facebook" | "instagram" | undefined;
        jitter?: number | undefined;
        signature?: {
            enabled: boolean;
            customName?: string | undefined;
        } | undefined;
        termsAcceptedAt?: Date | undefined;
    };
    filters: {
        tags?: string[] | undefined;
        sources?: ("WHATSAPP" | "FACEBOOK" | "INSTAGRAM")[] | undefined;
    };
    script: {
        type: string;
        config?: any;
    }[];
}>;
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
//# sourceMappingURL=broadcast.d.ts.map