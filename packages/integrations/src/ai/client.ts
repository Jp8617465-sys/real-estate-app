import { z } from 'zod';
import { IntegrationAPIError } from '../errors';
import {
  AIConfigSchema,
  type AIConfigInput,
  type AIConfig,
  type AICompletionRequest,
  type AICompletionResponse,
} from './types';

// ─── Anthropic-specific types ──────────────────────────────────────
const AnthropicResponseSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string(),
  })),
  model: z.string(),
  stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence']).nullable(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
});

/**
 * AI Client for LLM interactions.
 * Currently supports Anthropic Claude API.
 * Designed for extension to other providers.
 */
export class AIClient {
  private config: AIConfig;

  constructor(config: AIConfigInput) {
    this.config = AIConfigSchema.parse(config);
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    switch (this.config.provider) {
      case 'anthropic':
        return this.completeAnthropic(request);
      default:
        throw new AIServiceError(
          `Provider '${this.config.provider}' not yet implemented`,
          500,
          'NOT_IMPLEMENTED'
        );
    }
  }

  private async completeAnthropic(request: AICompletionRequest): Promise<AICompletionResponse> {
    const baseUrl = this.config.baseUrl ?? 'https://api.anthropic.com';
    const maxTokens = request.maxTokens ?? this.config.maxTokens;
    const temperature = request.temperature ?? this.config.temperature;

    const messages = request.messages.map((msg) => ({
      role: msg.role === 'system' ? 'user' as const : msg.role,
      content: msg.content,
    }));

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: maxTokens,
      temperature,
      messages,
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AIServiceError(
        `Anthropic API error: ${errorText}`,
        response.status,
        response.statusText,
      );
    }

    const raw = await response.json();
    const parsed = AnthropicResponseSchema.parse(raw);

    const textContent = parsed.content.find((c) => c.type === 'text');
    const finishReason = parsed.stop_reason === 'max_tokens' ? 'max_tokens' as const : 'stop' as const;

    return {
      content: textContent?.text ?? '',
      finishReason,
      usage: {
        inputTokens: parsed.usage.input_tokens,
        outputTokens: parsed.usage.output_tokens,
      },
      model: parsed.model,
      provider: 'anthropic',
    };
  }

  async analyzeJSON<T>(
    request: AICompletionRequest,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    const response = await this.complete({
      ...request,
      jsonMode: true,
      systemPrompt: [
        request.systemPrompt ?? '',
        'You MUST respond with valid JSON only. No markdown, no code fences, no explanation.',
      ].filter(Boolean).join('\n\n'),
    });

    const cleaned = response.content
      .replace(/^```json?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as unknown;
    return schema.parse(parsed);
  }
}

/**
 * Error thrown by AI service operations.
 */
export class AIServiceError extends IntegrationAPIError {
  constructor(message: string, statusCode: number, statusText: string) {
    super(message, statusCode, statusText);
    this.name = 'AIServiceError';
  }
}
