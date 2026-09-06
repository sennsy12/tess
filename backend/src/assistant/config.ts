import { z } from 'zod';
import type { AssistantProvider } from './providers/types.js';

const truthy = (v: string | undefined) => v === 'true' || v === '1';

const providerSchema = z.enum(['gemini', 'openai']).default('gemini');

const assistantEnvSchema = z.object({
  ENABLE_ASSISTANT: z.string().optional(),
  ASSISTANT_PROVIDER: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash-lite'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ASSISTANT_MAX_OUTPUT_TOKENS: z
    .string()
    .optional()
    .transform((v) => Math.min(800, Math.max(100, parseInt(v ?? '500', 10) || 500))),
  ASSISTANT_TIMEOUT_MS: z.string().optional(),
  /** @deprecated Use ASSISTANT_MAX_OUTPUT_TOKENS */
  OPENAI_MAX_OUTPUT_TOKENS: z.string().optional(),
});

export interface AssistantConfig {
  enabled: boolean;
  provider: AssistantProvider;
  apiKey: string | undefined;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
}

let cached: AssistantConfig | null = null;

function resolveProvider(raw: string | undefined): AssistantProvider {
  const parsed = providerSchema.safeParse(raw?.toLowerCase());
  return parsed.success ? parsed.data : 'gemini';
}

function resolveCredentials(provider: AssistantProvider, env: z.infer<typeof assistantEnvSchema>) {
  if (provider === 'gemini') {
    const apiKey = env.GEMINI_API_KEY?.trim();
    return { apiKey, model: env.GEMINI_MODEL };
  }
  const apiKey = env.OPENAI_API_KEY?.trim();
  return { apiKey, model: env.OPENAI_MODEL };
}

export function getAssistantConfig(): AssistantConfig {
  if (cached) return cached;

  const parsed = assistantEnvSchema.safeParse(process.env);
  const env = parsed.success ? parsed.data : assistantEnvSchema.parse({});

  const flagOn = truthy(env.ENABLE_ASSISTANT);
  const provider = resolveProvider(env.ASSISTANT_PROVIDER);
  const { apiKey, model } = resolveCredentials(provider, env);

  const tokenRaw = env.ASSISTANT_MAX_OUTPUT_TOKENS ?? env.OPENAI_MAX_OUTPUT_TOKENS;
  const maxOutputTokens = tokenRaw
    ? Math.min(800, Math.max(100, parseInt(String(tokenRaw), 10) || 500))
    : 500;

  const timeoutRaw = Number(env.ASSISTANT_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.floor(timeoutRaw) : 30000;

  cached = {
    enabled: flagOn && Boolean(apiKey),
    provider,
    apiKey,
    model,
    maxOutputTokens,
    timeoutMs,
  };

  return cached;
}

export function resetAssistantConfigCache(): void {
  cached = null;
}
