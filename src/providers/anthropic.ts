import Anthropic from '@anthropic-ai/sdk';
import { LLMMessage, LLMProvider, LLMResponse } from './base.js';
import { RoleConfig, ReasoningEffort } from '../types/index.js';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;
  private reasoningEffort?: ReasoningEffort;

  constructor(config: RoleConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    if (!config.model) {
      throw new Error('Cấu hình thiếu trường "model" cho Anthropic provider.');
    }
    this.model = config.model;
    this.reasoningEffort = config.reasoningEffort;
  }

  async generate(
    messages: LLMMessage[],
    options?: { json?: boolean; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
    const userMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const isThinking = this.reasoningEffort && this.reasoningEffort !== 'off';
    const budgetMap: Record<string, number> = {
      low: 2048,
      medium: 8192,
      high: 16384,
    };

    const requestPayload: any = {
      model: this.model,
      system: systemMessage,
      messages: userMessages,
    };

    if (isThinking) {
      const budget = budgetMap[this.reasoningEffort!] || 4096;
      requestPayload.max_tokens = Math.max(options?.maxTokens || 4000, budget + 4000);
      requestPayload.thinking = {
        type: 'enabled',
        budget_tokens: budget,
      };
      // Anthropic API mandates temperature=1.0 when extended thinking is enabled
      requestPayload.temperature = 1.0;
    } else {
      requestPayload.max_tokens = options?.maxTokens || 4000;
      requestPayload.temperature = options?.temperature ?? 0.2;
    }

    const response = await this.client.messages.create(requestPayload);

    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
