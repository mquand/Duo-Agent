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
      const errMsg = err.message || String(err);
      if (err.code === 'ECONNREFUSED' || errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
        throw new Error(
          `Cannot connect to local LLM server at ${this.client.baseURL || 'http://localhost:11434'}. Please ensure Ollama is running ('ollama serve').`
        );
      }
      if (err.status === 404 || errMsg.includes('not found')) {
        throw new Error(`Model '${this.model}' was not found. If using Ollama, run: 'ollama pull ${this.model}'`);
      }
      if (err.status === 401 || errMsg.includes('401') || errMsg.includes('Incorrect API key')) {
        throw new Error(`Authentication error (401): Invalid API key for model '${this.model}'. Use /model to update.`);
      }
      throw err;
    }
  }
}
