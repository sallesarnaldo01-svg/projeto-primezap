import { z } from 'zod';
export declare const createFlowSchema: z.ZodObject<{
    name: z.ZodString;
    queueId: z.ZodOptional<z.ZodString>;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    queueId?: string | undefined;
    variables?: Record<string, any> | undefined;
}, {
    name: string;
    queueId?: string | undefined;
    variables?: Record<string, any> | undefined;
}>;
export declare const updateFlowSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["DRAFT", "PUBLISHED", "ARCHIVED"]>>;
    active: z.ZodOptional<z.ZodBoolean>;
    queueId: z.ZodOptional<z.ZodString>;
    variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
    name?: string | undefined;
    queueId?: string | undefined;
    variables?: Record<string, any> | undefined;
    active?: boolean | undefined;
}, {
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
    name?: string | undefined;
    queueId?: string | undefined;
    variables?: Record<string, any> | undefined;
    active?: boolean | undefined;
}>;
export declare const createNodeSchema: z.ZodObject<{
    type: z.ZodEnum<["START", "CONTENT", "MENU", "RANDOMIZER", "DELAY", "TICKET", "TYPEBOT", "OPENAI", "CONDITION", "HTTP", "SCHEDULE", "ASSIGN_QUEUE", "SUBFLOW"]>;
    label: z.ZodOptional<z.ZodString>;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    config: z.ZodAny;
}, "strip", z.ZodTypeAny, {
    type: "START" | "CONTENT" | "MENU" | "RANDOMIZER" | "DELAY" | "TICKET" | "TYPEBOT" | "OPENAI" | "CONDITION" | "HTTP" | "SCHEDULE" | "ASSIGN_QUEUE" | "SUBFLOW";
    x: number;
    y: number;
    label?: string | undefined;
    config?: any;
}, {
    type: "START" | "CONTENT" | "MENU" | "RANDOMIZER" | "DELAY" | "TICKET" | "TYPEBOT" | "OPENAI" | "CONDITION" | "HTTP" | "SCHEDULE" | "ASSIGN_QUEUE" | "SUBFLOW";
    label?: string | undefined;
    x?: number | undefined;
    y?: number | undefined;
    config?: any;
}>;
export declare const createEdgeSchema: z.ZodObject<{
    sourceId: z.ZodString;
    targetId: z.ZodString;
    condition: z.ZodOptional<z.ZodAny>;
    label: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sourceId: string;
    targetId: string;
    label?: string | undefined;
    condition?: any;
}, {
    sourceId: string;
    targetId: string;
    label?: string | undefined;
    condition?: any;
}>;
export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type CreateEdgeInput = z.infer<typeof createEdgeSchema>;
//# sourceMappingURL=flow.d.ts.map