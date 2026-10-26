import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
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

  /**
   * Execute request via local claude CLI as a robust fallback
   */
  private async executeViaClaudeCli(prompt: string, modelName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['--tools', '', '-p', '-'];
      if (modelName) {
        args.push('--model', modelName);
      }
      const child = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        stdout += d.toString('utf-8');
      });
      child.stderr.on('data', (d) => {
        stderr += d.toString('utf-8');
      });

      child.on('close', (code) => {
        if (code === 0 && stdout.trim().length > 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr.trim() || `claude CLI exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
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
    } else {
      requestPayload.max_tokens = options?.maxTokens || 4000;
      const isModernModel =
        this.model.includes('5-5') ||
        this.model.includes('-5') ||
        this.model.includes('opus') ||
        this.model.includes('sonnet');
      if (options?.temperature !== undefined && !isModernModel) {
        requestPayload.temperature = options.temperature;
      }
    }

    try {
      let response: any;
      try {
        response = await this.client.messages.create(requestPayload);
      } catch (innerErr: any) {
        const innerMsg = (innerErr?.message || String(innerErr)).toLowerCase();
        if (requestPayload.temperature !== undefined && innerMsg.includes('temperature')) {
          delete requestPayload.temperature;
          response = await this.client.messages.create(requestPayload);
        } else {
          throw innerErr;
        }
      }

      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          text += block.text;
        }
      }

      return {
        text,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      };
    } catch (err: any) {
      const errMsg = (err.message || String(err)).toLowerCase();

      // If rate limited (429) or overloaded, automatically fallback to local claude CLI
      if (err.status === 429 || errMsg.includes('rate limit') || errMsg.includes('429') || errMsg.includes('overloaded')) {
        try {
          const fullPrompt = [
            systemMessage ? `[Instructions]\n${systemMessage}\n` : '',
            userMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n'),
          ]
            .filter(Boolean)
            .join('\n');

          const cliOutput = await this.executeViaClaudeCli(fullPrompt, this.model);
          if (cliOutput && cliOutput.length > 0) {
            return {
              text: cliOutput,
              inputTokens: Math.round(fullPrompt.length / 4),
              outputTokens: Math.round(cliOutput.length / 4),
            };
          }
        } catch {
          // If fallback fails, proceed to standard error handling below
        }
      }

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
