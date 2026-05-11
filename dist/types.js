import { z } from 'zod';
export const ContentBlockSchema = z.object({
    type: z.string(),
    text: z.string().optional(),
    source: z.object({ type: z.string(), path: z.string().optional() }).optional(),
    content: z.string().optional(),
}).passthrough();
export const UsageSchema = z.object({
    total_tokens: z.number().optional(),
    thinking_tokens: z.number().optional(),
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
}).passthrough();
export const SessionMessageSchema = z.object({
    role: z.string().optional(),
    type: z.string().optional(),
    content: z.union([z.string(), z.array(ContentBlockSchema)]).optional(),
    tokens: z.number().optional(),
    thinking_tokens: z.number().optional(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    model: z.string().optional(),
    usage: UsageSchema.optional(),
}).passthrough();
