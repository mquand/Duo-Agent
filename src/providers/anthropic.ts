import Anthropic from '@anthropic-ai/sdk';
import { LLMMessage, LLMProvider, LLMResponse } from './base.js';
import { RoleConfig, ReasoningEffort } from '../types/index.js';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;
  private reasoningEffort?: ReasoningEffort;
  private hasKey: boolean;

  constructor(config: RoleConfig) {
    const effectiveKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.hasKey = !!effectiveKey && effectiveKey !== 'not-needed-for-local';
    this.client = new Anthropic({
      apiKey: effectiveKey || 'missing-key',
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
    if (!this.hasKey) {
      throw new Error(
        `Missing Anthropic API Key for model '${this.model}'.\n  -> Use /key to enter your Anthropic API Key (sk-ant-api03...)\n  -> Or use /model to switch to Local Offline (Ollama - 100% Free)\n  -> Or add ANTHROPIC_API_KEY into ~/.duo/.env.`
      );
    }

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

    try {
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
    } catch (err: any) {
      const errMsg = (err.message || String(err)).toLowerCase();
      if (
        errMsg.includes('could not resolve authentication method') ||
        errMsg.includes('api key') ||
        errMsg.includes('x-api-key') ||
        err.status === 401
      ) {
        throw new Error(
          `Missing or invalid Anthropic API Key for model '${this.model}'.\n  -> Use /key to enter your Anthropic API Key (sk-ant-api03...)\n  -> Or use /model to switch to Local Offline (Ollama - 100% Free)\n  -> Or add ANTHROPIC_API_KEY into ~/.duo/.env.`
        );
      }
      if (err.status === 429 || errMsg.includes('rate limit') || errMsg.includes('quota') || errMsg.includes('overloaded')) {
        throw new Error(
          `Anthropic API rate limit or credit balance exhausted (429) for '${this.model}'.\n  -> Check billing at console.anthropic.com or switch models via /model.`
        );
      }
      if (err.status === 404 || errMsg.includes('not_found_error')) {
        throw new Error(
          `Anthropic model '${this.model}' not found on server.\n  -> Use /model to switch to a valid model (e.g. claude-3-7-sonnet-20250219, claude-sonnet-5-5).`
        );
      }
      throw err;
    }
  }
}
