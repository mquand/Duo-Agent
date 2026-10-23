import OpenAI from 'openai';
import { LLMMessage, LLMProvider, LLMResponse } from './base.js';
import { RoleConfig } from '../types/index.js';

export class OpenAICompatProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: RoleConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || '',
      baseURL: config.baseURL,
    });
    if (!config.model) {
      throw new Error('Cấu hình thiếu trường "model" cho OpenAI-compatible provider.');
    }
    this.model = config.model;
  }

  async generate(
    messages: LLMMessage[],
    options?: { json?: boolean; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: formattedMessages as any,
      max_tokens: options?.maxTokens || 4000,
      temperature: options?.temperature ?? 0.2,
      response_format: options?.json ? { type: 'json_object' } : undefined,
    });

    const text = response.choices[0]?.message?.content || '';

    return {
      text,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    };
  }
}
