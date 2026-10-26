import { GoogleGenAI } from '@google/genai';
import { LLMMessage, LLMProvider, LLMResponse } from './base.js';
import { RoleConfig, ReasoningEffort } from '../types/index.js';
import { AuthManager } from '../auth/oauth.js';

export class GoogleProvider implements LLMProvider {
  private client: GoogleGenAI;
  private modelName: string;
  private reasoningEffort?: ReasoningEffort;
  private isAuthenticated: boolean;
  private authType: 'api_key' | 'oauth_g2auth' | 'none';

  constructor(config: RoleConfig) {
    const key = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const oauthToken = AuthManager.getGoogleOAuthToken();

    if (key && key !== 'not-needed-for-local' && key !== 'oauth-authenticated') {
      this.client = new GoogleGenAI({ apiKey: key });
      this.isAuthenticated = true;
      this.authType = 'api_key';
    } else if (oauthToken) {
      // Authenticate via OAuth access token / g2auth
      this.client = new GoogleGenAI({
        apiKey: '',
        httpOptions: {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
        },
      });
      this.isAuthenticated = true;
      this.authType = 'oauth_g2auth';
    } else {
      this.client = new GoogleGenAI({ apiKey: 'dummy-key' });
      this.isAuthenticated = false;
      this.authType = 'none';
    }

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
    if (!this.isAuthenticated) {
      throw new Error(
        `Missing Google Gemini authentication for model '${this.modelName}'.\n` +
        `  -> Use /key to enter your Google Gemini API Key (AIzaSy...)\n` +
        `  -> Or authenticate via Google OAuth / g2auth (set G2AUTH_TOKEN / GOOGLE_OAUTH_TOKEN or ~/.duo/oauth.json)\n` +
        `  -> Or use /model to switch to Local Offline (Ollama - Free).\n`
      );
    }

    const systemInstruction = messages.find((m) => m.role === 'system')?.content;

    const budgetMap: Record<string, number> = {
      low: 1024,
      medium: 4096,
      high: 8192,
      off: 0,
    };
    const budget = this.reasoningEffort ? budgetMap[this.reasoningEffort] : undefined;

    const baseOutputTokens = options?.maxTokens || 8192;
    const generationConfig: any = {
      maxOutputTokens: budget && budget > 0 ? baseOutputTokens + budget : baseOutputTokens,
      temperature: options?.temperature ?? 0.2,
      responseMimeTypes: options?.json ? ['application/json'] : undefined,
    };

    if (budget !== undefined && budget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget: budget };
    }

    const nonSystem = messages.filter((m) => m.role !== 'system');
    const prompt = nonSystem.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

    try {
      const config: any = {
        ...generationConfig,
      };

      const result = await this.client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config,
      });

      const text = result.text || '';
      const usage = result.usageMetadata;
      return {
        text,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount,
      };
    } catch (err: any) {
      const errMsg = (err.message || String(err)).toLowerCase();
      if (
        errMsg.includes('api_key_invalid') ||
        errMsg.includes('api key') ||
        errMsg.includes('401') ||
        errMsg.includes('403') ||
        errMsg.includes('unauthenticated')
      ) {
        throw new Error(
          `Invalid or expired Google authentication for model '${this.modelName}'.\n` +
          `  -> Use /key to update your Gemini API key (AIzaSy...)\n` +
          `  -> Or refresh your g2auth / Google OAuth token.\n`
        );
      }
      if (err.status === 404 || errMsg.includes('not_found') || errMsg.includes('no longer available')) {
        throw new Error(
          `Google Gemini model '${this.modelName}' not found or deprecated.\n` +
          `  -> Use /model to switch to a valid model (e.g. gemini-3.8-flash, gemini-3.5-flash-lite).\n` +
          `  -> Check available models at https://ai.google.dev/gemini-api/docs/models.\n`
        );
      }
      if (err.status === 429 || errMsg.includes('quota') || errMsg.includes('resource_exhausted')) {
        throw new Error(
          `Google Gemini API quota exceeded or rate limited (429) for '${this.modelName}'.\n` +
          `  -> Check billing/quotas at aistudio.google.com or switch models via /model.\n`
        );
      }
      throw err;
    }
  }
}
