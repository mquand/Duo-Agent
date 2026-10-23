import OpenAI from 'openai';
import { LLMMessage, LLMProvider, LLMResponse } from './base.js';
import { RoleConfig, ReasoningEffort } from '../types/index.js';

export class OpenAICompatProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private reasoningEffort?: ReasoningEffort;

  constructor(config: RoleConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || '',
      baseURL: config.baseURL,
    });
    if (!config.model) {
      throw new Error('Cấu hình thiếu trường "model" cho OpenAI-compatible provider.');
    }
    this.model = config.model;
    this.reasoningEffort = config.reasoningEffort;
  }

  async generate(
    messages: LLMMessage[],
    options?: { json?: boolean; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const isReasoningModel =
      this.model.startsWith('o1') ||
      this.model.startsWith('o3') ||
      this.model.includes('astra') ||
      this.model.includes('sol') ||
      this.model.includes('deepseek-r1') ||
      (this.reasoningEffort && this.reasoningEffort !== 'off');

    const payload: any = {
      model: this.model,
      messages: formattedMessages as any,
      response_format: options?.json ? { type: 'json_object' } : undefined,
    };

    const isOpenAI = !this.client.baseURL || this.client.baseURL.includes('openai.com');

    if (isReasoningModel) {
      payload.max_completion_tokens = options?.maxTokens || 16000;
      if (isOpenAI && this.reasoningEffort && ['low', 'medium', 'high'].includes(this.reasoningEffort)) {
        payload.reasoning_effort = this.reasoningEffort;
      }
    } else {
      payload.max_tokens = options?.maxTokens || 4000;
      payload.temperature = options?.temperature ?? 0.2;
    }

    try {
      const response = await this.client.chat.completions.create(payload);
      const text = response.choices[0]?.message?.content || '';

      return {
        text,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      };
    } catch (err: any) {
      const errMsg = (err.message || String(err)).toLowerCase();
      const isConnError =
        err.name === 'APIConnectionError' ||
        errMsg.includes('connection error') ||
        errMsg.includes('econnrefused') ||
        errMsg.includes('fetch failed') ||
        err.code === 'ECONNREFUSED' ||
        err.cause?.code === 'ECONNREFUSED';

      if (isConnError) {
        const baseURL = this.client.baseURL || 'http://localhost:11434/v1';
        const isLocal = baseURL.includes('localhost') || baseURL.includes('127.0.0.1');
        if (isLocal) {
          throw new Error(
            `Cannot connect to local Ollama server at ${baseURL}.\n  -> Ensure Ollama is running ('ollama serve') and model '${this.model}' is installed ('ollama pull ${this.model}').`
          );
        } else {
          throw new Error(
            `Network connection failed while reaching ${baseURL}. Please verify your internet connection or proxy settings.`
          );
        }
      }
      if (err.status === 404 || errMsg.includes('not found')) {
        throw new Error(
          `Model '${this.model}' not found on server.\n  -> If using Ollama, download it via: 'ollama pull ${this.model}'.`
        );
      }
      if (err.status === 401 || errMsg.includes('401') || errMsg.includes('incorrect api key') || errMsg.includes('invalid x-api-key')) {
        throw new Error(
          `Authentication error (401): Invalid API key for model '${this.model}'.\n  -> Update via /model or set in ~/.duo/.env.`
        );
      }
      if (err.status === 429 || errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('quota')) {
        throw new Error(
          `Rate limit or quota exceeded (429) for model '${this.model}'.\n  -> Check your account billing balance or switch models with /model.`
        );
      }
      throw err;
    }
  }
}
