import { RoleConfig } from '../types/index.js';
import { LLMProvider } from './base.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { OpenAICompatProvider } from './openai-compat.js';

export class ProviderFactory {
  static create(config: RoleConfig): LLMProvider {
    switch (config.provider) {
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'google':
        return new GoogleProvider(config);
      case 'openai-compatible':
        return new OpenAICompatProvider(config);
      default:
        throw new Error(`Nhà cung cấp không được hỗ trợ: ${(config as any).provider}`);
    }
  }
}
