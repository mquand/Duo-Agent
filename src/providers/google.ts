import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMMessage, LLMProvider, LLMResponse } from './base.js';
import { RoleConfig, ReasoningEffort } from '../types/index.js';

export class GoogleProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private reasoningEffort?: ReasoningEffort;

  constructor(config: RoleConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey || '');
    if (!config.model) {
      throw new Error('Cấu hình thiếu trường "model" cho Google provider.');
    }
    this.modelName = config.model;
    this.reasoningEffort = config.reasoningEffort;
  }

  async generate(
    messages: LLMMessage[],
    options?: { json?: boolean; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const systemInstruction = messages.find((m) => m.role === 'system')?.content;

    const generationConfig: any = {
      maxOutputTokens: options?.maxTokens || 4000,
      temperature: options?.temperature ?? 0.2,
      responseMimeType: options?.json ? 'application/json' : undefined,
    };

    if (this.reasoningEffort) {
      const budgetMap: Record<string, number> = {
        low: 1024,
        medium: 4096,
        high: 8192,
        off: 0,
      };
      const budget = budgetMap[this.reasoningEffort];
      if (budget !== undefined) {
        generationConfig.thinkingConfig = { thinkingBudget: budget };
      }
    }

    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }], role: 'system' } : undefined,
      generationConfig,
    });

    const nonSystem = messages.filter((m) => m.role !== 'system');
    const prompt = nonSystem.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const usage = response.usageMetadata;
    return {
      text,
      inputTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
    };
  }
}
