import { z } from 'zod';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
});

export const assistantChatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(12),
  pathname: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v && v.startsWith('/') ? v : undefined)),
});
