/**
 * Model Constants & Presets
 * 
 * This file centralizes all model definitions for easy updates.
 * When providers release new models, update this file only.
 */

import { RoleConfig } from '../types/index.js';

// ============================================================================
// ANTHROPIC CLAUDE MODELS (Updated: October 2026)
// ============================================================================
export const ANTHROPIC_MODELS = {
  // Latest models (2026)
  CLAUDE_FABLE_5_1: 'claude-fable-5-1',
  CLAUDE_OPUS_5_5: 'claude-opus-5-5',
  CLAUDE_SONNET_5_5: 'claude-sonnet-5-5',
  CLAUDE_HAIKU_5_5: 'claude-haiku-5-5',
  
  // Deprecated (DO NOT USE)
  CLAUDE_3_7_SONNET: 'claude-3-7-sonnet-20250219', // Deprecated
  CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-latest', // Deprecated
} as const;

// ============================================================================
// GOOGLE GEMINI MODELS (Updated: September 2026)
// ============================================================================
export const GEMINI_MODELS = {
  // Latest models (2026)
  GEMINI_4_ARGON: 'gemini-4-argon',
  GEMINI_3_8_FLASH: 'gemini-3.8-flash',
  GEMINI_3_8_LIVE: 'gemini-3.8-live',
  GEMINI_3_5_FLASH: 'gemini-3.5-flash',
  GEMINI_3_5_FLASH_LITE: 'gemini-3.5-flash-lite',
  
  // Deprecated (DO NOT USE)
  GEMINI_2_0_FLASH: 'gemini-2.0-flash', // Outdated (April 2025)
  GEMINI_2_0_PRO: 'gemini-2.0-pro-exp-02-05', // Outdated (April 2025)
  GEMINI_2_5_FLASH: 'gemini-2.5-flash', // Deprecated (404 error)
} as const;

// ============================================================================
// OPENAI MODELS (Updated: 2026)
// ============================================================================
export const OPENAI_MODELS = {
  // Latest models (2026)
  GPT_5_6_SOL: 'gpt-5.6-sol',
  GPT_5_6_TERRA: 'gpt-5.6-terra',
  GPT_5_6_LUNA: 'gpt-5.6-luna',
  
  // Deprecated (DO NOT USE)
  GPT_4O: 'gpt-4o', // Deprecated (Feb 2026)
  GPT_4_1: 'gpt-4.1', // Deprecated (Feb 2026)
  O3_MINI: 'o3-mini', // Shutdown (Dec 2026)
  O3: 'o3', // Shutdown (Dec 2026)
} as const;

// ============================================================================
// DEEPSEEK MODELS (Updated: September 2026)
// ============================================================================
export const DEEPSEEK_MODELS = {
  // Latest models (2026)
  DEEPSEEK_V4_1_FLASH: 'deepseek-v4.1-flash',
  DEEPSEEK_V4_PRO: 'deepseek-v4-pro',
  DEEPSEEK_V3_2: 'deepseek-v3.2',
  
  // Deprecated (DO NOT USE)
  DEEPSEEK_V4_FLASH: 'deepseek-v4-flash', // Retired (routed to V4.1-Flash)
  DEEPSEEK_CHAT: 'deepseek-chat', // Outdated (V3 series)
  DEEPSEEK_REASONER: 'deepseek-reasoner', // Outdated (V3 series)
} as const;

// ============================================================================
// OLLAMA (LOCAL) MODELS (Updated: 2026)
// ============================================================================
export const OLLAMA_MODELS = {
  // Latest models (2026)
  QWEN_3_8: 'qwen3.8',
  QWEN_3_6: 'qwen3.6',
  QWEN_3_5: 'qwen3.5',
  LLAMA_3_1: 'llama-3.1',
  GEMMA_4: 'gemma-4',
  DEEPSEEK_R1: 'deepseek-r1',
  
  // Deprecated (DO NOT USE)
  QWEN_2_5_CODER: 'qwen2.5-coder:32b', // Outdated
  DEEPSEEK_R1_14B: 'deepseek-r1:14b', // Old version
} as const;

// ============================================================================
// GROQ MODELS (Updated: 2026)
// ============================================================================
export const GROQ_MODELS = {
  // Latest models (2026)
  GPT_OSS_120B: 'openai/gpt-oss-120b',
  GPT_OSS_20B: 'openai/gpt-oss-20b',
  QWEN_3_8_27B: 'qwen/qwen3.8-27b',
  LLAMA_3_1_8B: 'llama-3.1-8b-instant',
  
  // Deprecated (DO NOT USE)
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile', // Deprecated (Aug 2026)
  QWEN_3_6_27B: 'qwen/qwen3.6-27b', // Deprecated (Sept 2026)
} as const;

// ============================================================================
// MODEL PRESETS
// ============================================================================
export const MODEL_PRESETS: Record<string, {
  name: string;
  description: string;
  roles: {
    architect: RoleConfig;
    builder: RoleConfig;
    auditor: RoleConfig;
  };
}> = {
  offline: {
    name: 'Local Offline (100% Ollama)',
    description: 'Arch: Qwen3.8 | Build: Qwen3.5 | Audit: Qwen3.8 (100% Free, 0đ API)',
    roles: {
      architect: {
        provider: 'openai-compatible',
        model: OLLAMA_MODELS.QWEN_3_8,
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'not-needed-for-local',
        reasoningEffort: 'medium',
      },
      builder: {
        provider: 'openai-compatible',
        model: OLLAMA_MODELS.QWEN_3_5,
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'not-needed-for-local',
        reasoningEffort: 'off',
      },
      auditor: {
        provider: 'openai-compatible',
        model: OLLAMA_MODELS.QWEN_3_8,
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'not-needed-for-local',
        reasoningEffort: 'medium',
      },
    },
  },
  claude_pure: {
    name: 'Pure Claude (100% Anthropic)',
    description: 'Arch: Opus 5.5 | Build: Haiku 5.5 | Audit: Opus 5.5',
    roles: {
      architect: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_OPUS_5_5, reasoningEffort: 'medium' },
      builder: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_HAIKU_5_5, reasoningEffort: 'off' },
      auditor: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_OPUS_5_5, reasoningEffort: 'medium' },
    },
  },
  openai_pure: {
    name: 'Pure OpenAI (100% OpenAI)',
    description: 'Arch: GPT-5.6 Sol | Build: GPT-5.6 Terra | Audit: GPT-5.6 Sol',
    roles: {
      architect: { provider: 'openai-compatible', model: OPENAI_MODELS.GPT_5_6_SOL, baseURL: 'https://api.openai.com/v1', reasoningEffort: 'medium' },
      builder: { provider: 'openai-compatible', model: OPENAI_MODELS.GPT_5_6_TERRA, baseURL: 'https://api.openai.com/v1', reasoningEffort: 'off' },
      auditor: { provider: 'openai-compatible', model: OPENAI_MODELS.GPT_5_6_SOL, baseURL: 'https://api.openai.com/v1', reasoningEffort: 'medium' },
    },
  },
  gemini_pure: {
    name: 'Pure Gemini (100% Google)',
    description: 'Arch: Gemini 3.8 Flash | Build: Gemini 3.5 Flash-Lite | Audit: Gemini 3.8 Flash',
    roles: {
      architect: { provider: 'google', model: GEMINI_MODELS.GEMINI_3_8_FLASH, reasoningEffort: 'medium' },
      builder: { provider: 'google', model: GEMINI_MODELS.GEMINI_3_5_FLASH_LITE, reasoningEffort: 'off' },
      auditor: { provider: 'google', model: GEMINI_MODELS.GEMINI_3_8_FLASH, reasoningEffort: 'off' },
    },
  },
  deepseek_pure: {
    name: 'Pure DeepSeek (100% DeepSeek)',
    description: 'Arch: DeepSeek V4-Pro | Build: DeepSeek V4.1-Flash | Audit: V4-Pro',
    roles: {
      architect: { provider: 'openai-compatible', model: DEEPSEEK_MODELS.DEEPSEEK_V4_PRO, baseURL: 'https://api.deepseek.com/v1', reasoningEffort: 'medium' },
      builder: { provider: 'openai-compatible', model: DEEPSEEK_MODELS.DEEPSEEK_V4_1_FLASH, baseURL: 'https://api.deepseek.com/v1', reasoningEffort: 'off' },
      auditor: { provider: 'openai-compatible', model: DEEPSEEK_MODELS.DEEPSEEK_V4_PRO, baseURL: 'https://api.deepseek.com/v1', reasoningEffort: 'medium' },
    },
  },
  hybrid: {
    name: 'Claude + Gemini Hybrid',
    description: 'Arch: Opus 5.5 | Build: Gemini 3.5 Flash-Lite | Audit: Opus 5.5',
    roles: {
      architect: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_OPUS_5_5, reasoningEffort: 'medium' },
      builder: { provider: 'google', model: GEMINI_MODELS.GEMINI_3_5_FLASH_LITE, reasoningEffort: 'off' },
      auditor: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_OPUS_5_5, reasoningEffort: 'medium' },
    },
  },
  fast: {
    name: 'Groq Ultra Speed (Hybrid)',
    description: 'Arch: Opus 5.5 | Build: GPT OSS 20B (Groq) | Audit: Haiku 5.5',
    roles: {
      architect: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_OPUS_5_5, reasoningEffort: 'medium' },
      builder: { provider: 'openai-compatible', model: GROQ_MODELS.GPT_OSS_20B, baseURL: 'https://api.groq.com/openai/v1', reasoningEffort: 'off' },
      auditor: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_HAIKU_5_5, reasoningEffort: 'off' },
    },
  },
  codestral: {
    name: 'Mistral Codestral (Hybrid)',
    description: 'Arch: Opus 5.5 | Build: Codestral (Mistral) | Audit: Opus 5.5',
    roles: {
      architect: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_OPUS_5_5, reasoningEffort: 'medium' },
      builder: { provider: 'openai-compatible', model: 'codestral-latest', baseURL: 'https://api.mistral.ai/v1', reasoningEffort: 'off' },
      auditor: { provider: 'anthropic', model: ANTHROPIC_MODELS.CLAUDE_OPUS_5_5, reasoningEffort: 'medium' },
    },
  },
};

// ============================================================================
// DEPRECATED MODEL WARNINGS
// ============================================================================
export const DEPRECATED_MODELS: Record<string, string> = {
  [ANTHROPIC_MODELS.CLAUDE_3_7_SONNET]: 'Deprecated (February 2025). Use claude-opus-5-5 or claude-sonnet-5-5 instead.',
  [ANTHROPIC_MODELS.CLAUDE_3_5_HAIKU]: 'Deprecated (October 2024). Use claude-haiku-5-5 instead.',
  [GEMINI_MODELS.GEMINI_2_0_FLASH]: 'Outdated (April 2025). Use gemini-3.8-flash instead.',
  [GEMINI_MODELS.GEMINI_2_0_PRO]: 'Outdated (April 2025). Use gemini-3.8-flash instead.',
  [GEMINI_MODELS.GEMINI_2_5_FLASH]: 'Deprecated (404 error). Use gemini-3.8-flash instead.',
  [OPENAI_MODELS.GPT_4O]: 'Deprecated (February 2026). Use gpt-5.6-sol instead.',
  [OPENAI_MODELS.GPT_4_1]: 'Deprecated (February 2026). Use gpt-5.6-sol instead.',
  [OPENAI_MODELS.O3_MINI]: 'Shutdown (December 2026). Use gpt-5.6-terra instead.',
  [OPENAI_MODELS.O3]: 'Shutdown (December 2026). Use gpt-5.6-sol instead.',
  [DEEPSEEK_MODELS.DEEPSEEK_V4_FLASH]: 'Retired (September 2026). Use deepseek-v4.1-flash instead.',
  [DEEPSEEK_MODELS.DEEPSEEK_CHAT]: 'Outdated (V3 series). Use deepseek-v4.1-flash instead.',
  [DEEPSEEK_MODELS.DEEPSEEK_REASONER]: 'Outdated (V3 series). Use deepseek-v4-pro instead.',
  [OLLAMA_MODELS.QWEN_2_5_CODER]: 'Outdated. Use qwen3.5 or qwen3.8 instead.',
  [OLLAMA_MODELS.DEEPSEEK_R1_14B]: 'Old version. Use qwen3.8 or deepseek-v4.1-flash instead.',
  [GROQ_MODELS.LLAMA_3_3_70B]: 'Deprecated (August 2026). Use openai/gpt-oss-20b instead.',
  [GROQ_MODELS.QWEN_3_6_27B]: 'Deprecated (September 2026). Use qwen/qwen3.8-27b instead.',
};

/**
 * Check if a model is deprecated and return warning message
 */
export function checkDeprecatedModel(model: string): string | null {
  const warning = DEPRECATED_MODELS[model];
  return warning || null;
}
