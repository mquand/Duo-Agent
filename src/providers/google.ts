import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMMessage, LLMProvider, LLMResponse } from './base.js';
import { RoleConfig } from '../types/index.js';

export class GoogleProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(config: RoleConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey || '');
    if (!config.model) {
      throw new Error('Cấu hình thiếu trường "model" cho Google provider.');
    }
    this.modelName = config.model;
  }

  async generate(
    messages: LLMMessage[],
    options?: { json?: boolean; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const systemInstruction = messages.find((m) => m.role === 'system')?.content;
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }], role: 'system' } : undefined,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 4000,
        temperature: options?.temperature ?? 0.2,
        responseMimeType: options?.json ? 'application/json' : undefined,
      },
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
