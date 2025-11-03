import { z } from 'zod';
export var paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
});
export var idParamSchema = z.object({
    id: z.string().cuid()
});
