import { AuthManager } from '../auth/oauth.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { AppConfig, RoleConfig, ProviderType, ReasoningEffort } from '../types/index.js';
import { MODEL_PRESETS, checkDeprecatedModel } from './models.js';

dotenv.config();

// Also load ~/.duo/.env or ~/.env if they exist
const globalDuoEnv = path.join(os.homedir(), '.duo', '.env');
if (fs.existsSync(globalDuoEnv)) {
  dotenv.config({ path: globalDuoEnv, override: true });
}
const userHomeEnv = path.join(os.homedir(), '.env');
if (fs.existsSync(userHomeEnv)) {
  dotenv.config({ path: userHomeEnv, override: true });
}

export interface DuoPreset {
  name: string;
  description: string;
  roles: {
    architect: RoleConfig;
    builder: RoleConfig;
    auditor: RoleConfig;
  };
}

// Re-export presets from models.ts for backward compatibility
export const PRESETS = MODEL_PRESETS;

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.duo');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const LOCAL_CONFIG_FILE = path.join(process.cwd(), '.duorc');

const DEFAULT_CONFIG: AppConfig = {
  roles: {
    architect: {
      provider: 'anthropic',
      model: 'claude-opus-5-5',
    },
    builder: {
      provider: 'google',
      model: 'gemini-3.8-flash',
    },
    auditor: {
      provider: 'anthropic',
      model: 'claude-opus-5-5',
    },
  },
  telemetry: false,
};

export const ENV_TEMPLATE = `# ==============================================================================
# Duo-Agent Environment Configuration
# Put your API keys below. Duo-Agent automatically reads ~/.duo/.env and .env
# ==============================================================================

# Anthropic Claude (Claude Opus 5.5, Sonnet 5.5, Claude 3.7 Sonnet)
# Get key: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=

# Google Gemini (Gemini 2.0 Flash, Gemini 1.5 Pro)
# Get key: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=

# OpenAI (GPT-4o, o3-mini, o1)
# Get key: https://platform.openai.com/api-keys
OPENAI_API_KEY=

# DeepSeek (DeepSeek R1 Reasoner, DeepSeek V3)
# Get key: https://platform.deepseek.com/api_keys
DEEPSEEK_API_KEY=

# Groq (High-speed Llama 3.3 70B)
# Get key: https://console.groq.com/keys
GROQ_API_KEY=

# Mistral AI (Codestral, Mistral Large 2)
# Get key: https://console.mistral.ai/api-keys/
MISTRAL_API_KEY=

# Local Offline (Ollama)
# No API key needed! Simply run Ollama on your machine:
#   ollama pull deepseek-r1:14b
#   ollama pull qwen2.5-coder:32b
`;

export class ConfigManager {
  static getConfigPath(): string {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      return LOCAL_CONFIG_FILE;
    }
    return GLOBAL_CONFIG_FILE;
  }

  static async hasExistingConfig(): Promise<boolean> {
    const configPath = this.getConfigPath();
    return await fs.pathExists(configPath);
  }

  static async ensureEnvTemplate(): Promise<void> {
    try {
      await fs.ensureDir(GLOBAL_CONFIG_DIR);
      const exampleFile = path.join(GLOBAL_CONFIG_DIR, '.env.example');
      if (!(await fs.pathExists(exampleFile))) {
        await fs.writeFile(exampleFile, ENV_TEMPLATE, 'utf-8');
      }
      const envFile = path.join(GLOBAL_CONFIG_DIR, '.env');
      if (!(await fs.pathExists(envFile))) {
        await fs.writeFile(envFile, ENV_TEMPLATE, 'utf-8');
      }
    } catch {
      // Ignore write errors
    }
  }

  static async loadConfig(): Promise<AppConfig> {
    await this.ensureEnvTemplate();
    if (fs.existsSync(globalDuoEnv)) {
      dotenv.config({ path: globalDuoEnv, override: true });
    }
    if (fs.existsSync(userHomeEnv)) {
      dotenv.config({ path: userHomeEnv, override: true });
    }
    let config = { ...DEFAULT_CONFIG };

    const configPath = this.getConfigPath();
    if (await fs.pathExists(configPath)) {
      try {
        const fileContent = await fs.readJson(configPath);
        config = {
          roles: {
            ...config.roles,
            ...fileContent.roles,
          },
          theme: fileContent.theme ?? config.theme,
          language: fileContent.language ?? config.language,
          telemetry: fileContent.telemetry ?? config.telemetry,
        };
      } catch (e) {
        // Fallback to default
      }
    }

    // Resolve API keys from env if missing
    this.hydrateFromEnv(config.roles.architect);
    this.hydrateFromEnv(config.roles.builder);
    this.hydrateFromEnv(config.roles.auditor);

    return config;
  }

  static async saveConfig(config: AppConfig, isLocal = false): Promise<void> {
    const targetFile = isLocal ? LOCAL_CONFIG_FILE : GLOBAL_CONFIG_FILE;
    try {
      await fs.ensureDir(path.dirname(targetFile));
      await fs.writeJson(targetFile, config, { spaces: 2 });
    } catch {
      if (!isLocal) {
        // Fallback to saving locally if global home directory is not writable
        await fs.writeJson(LOCAL_CONFIG_FILE, config, { spaces: 2 });
      }
    }
  }

    static hydrateFromEnv(role: RoleConfig): void {
    if (!role) return;

    if (role.provider === 'anthropic') {
      if (!role.apiKey || role.apiKey === 'oauth-authenticated') {
        const creds = AuthManager.getAnthropicCredentials();
        if (creds.apiKey) {
          role.apiKey = creds.apiKey;
          if (creds.baseURL && !role.baseURL) {
            role.baseURL = creds.baseURL;
          }
        }
      }
    } else if (role.provider === 'google') {
      if (!role.apiKey) {
        role.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!role.apiKey && AuthManager.isGoogleAuthenticated()) {
          role.apiKey = 'oauth-authenticated';
        }
      }
    } else if (role.provider === 'openai-compatible') {
      if (!role.apiKey) {
        if (role.baseURL?.includes('deepseek')) {
          role.apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
        } else if (role.baseURL?.includes('groq')) {
          role.apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
        } else if (role.baseURL?.includes('mistral')) {
          role.apiKey = process.env.MISTRAL_API_KEY || process.env.OPENAI_API_KEY;
        } else if (role.baseURL?.includes('x.ai')) {
          role.apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
        } else if (role.baseURL?.includes('openrouter')) {
          role.apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
        } else if (role.baseURL?.includes('localhost') || role.baseURL?.includes('127.0.0.1')) {
          role.apiKey = 'not-needed-for-local';
        } else {
          role.apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
        }
      }
    }
  }

  static getPreset(presetName: string): { architect: RoleConfig; builder: RoleConfig; auditor: RoleConfig } | null {
    const raw = presetName.trim().toLowerCase();
    const norm = raw.replace(/[-_]/g, '');
    let matchKey: string | undefined;

    for (const key of Object.keys(PRESETS)) {
      if (key.toLowerCase() === raw || key.replace(/[-_]/g, '') === norm) {
        matchKey = key;
        break;
      }
    }

    if (!matchKey) {
      if (norm === 'claude' || norm === 'anthropic') matchKey = 'claude_pure';
      else if (norm === 'openai' || norm === 'gpt') matchKey = 'openai_pure';
      else if (norm === 'gemini' || norm === 'google') matchKey = 'gemini_pure';
      else if (norm === 'deepseek') matchKey = 'deepseek_pure';
      else if (norm === 'local' || norm === 'ollama') matchKey = 'offline';
      else if (norm === 'groq') matchKey = 'fast';
      else if (norm === 'mistral') matchKey = 'codestral';
    }

    if (!matchKey || !PRESETS[matchKey]) return null;

    const preset = JSON.parse(JSON.stringify(PRESETS[matchKey].roles)) as {
      architect: RoleConfig;
      builder: RoleConfig;
      auditor: RoleConfig;
    };

    this.hydrateFromEnv(preset.architect);
    this.hydrateFromEnv(preset.builder);
    this.hydrateFromEnv(preset.auditor);

    return preset;
  }

    static resolveRole(modelOrName: string, defaultEffort?: ReasoningEffort): RoleConfig {
    const m = modelOrName.trim();
    const lower = m.toLowerCase();

    let provider: ProviderType = 'openai-compatible';
    let baseURL: string | undefined = undefined;
    let apiKey: string | undefined = undefined;

    // Anthropic / Claude
    if (
      lower.includes('claude') ||
      lower.includes('opus') ||
      lower.includes('sonnet') ||
      lower.includes('haiku') ||
      lower.includes('fable')
    ) {
      provider = 'anthropic';
    }
    // Google Gemini
    else if (lower.includes('gemini') || lower.includes('flash') || lower.includes('gemma')) {
      provider = 'google';
    }
    // DeepSeek
    else if (lower.includes('deepseek')) {
      provider = 'openai-compatible';
      if (
        lower.includes(':14b') ||
        lower.includes(':32b') ||
        lower.includes(':7b') ||
        lower.includes(':8b') ||
        lower.includes(':70b') ||
        lower.includes('ollama')
      ) {
        baseURL = 'http://localhost:11434/v1';
        apiKey = 'not-needed-for-local';
      } else {
        baseURL = 'https://api.deepseek.com/v1';
      }
    }
    // Qwen / Llama (Ollama)
    else if (lower.includes('qwen') || (lower.includes('llama') && (lower.includes(':') || lower.includes('ollama')))) {
      provider = 'openai-compatible';
      baseURL = 'http://localhost:11434/v1';
      apiKey = 'not-needed-for-local';
    }
    // Groq
    else if (lower.includes('gpt-oss') || lower.includes('llama') || lower.includes('groq')) {
      provider = 'openai-compatible';
      baseURL = 'https://api.groq.com/openai/v1';
    }
    // Mistral
    else if (lower.includes('mistral') || lower.includes('codestral')) {
      provider = 'openai-compatible';
      baseURL = 'https://api.mistral.ai/v1';
    }
    // OpenRouter
    else if (lower.includes('/') && !lower.startsWith('http')) {
      provider = 'openai-compatible';
      baseURL = 'https://openrouter.ai/api/v1';
    }
    // OpenAI standard
    else if (
      lower.startsWith('gpt-') ||
      lower.startsWith('o1') ||
      lower.startsWith('o3') ||
      lower.startsWith('o4') ||
      lower.includes('sol') ||
      lower.includes('terra')
    ) {
      provider = 'openai-compatible';
      baseURL = 'https://api.openai.com/v1';
    } else {
      provider = 'openai-compatible';
      baseURL = 'https://api.openai.com/v1';
    }

    const role: RoleConfig = {
      provider,
      model: m,
      baseURL,
      apiKey,
      reasoningEffort: defaultEffort,
    };

    this.hydrateFromEnv(role);
    return role;
  }

  static getMissingKeys(config: AppConfig, isEn = true): string[] {
    const missing: string[] = [];
    if (!config?.roles) {
      return [isEn ? 'Roles configuration missing' : 'Thiếu cấu hình roles'];
    }

    if (config.roles.architect) this.hydrateFromEnv(config.roles.architect);
    if (config.roles.builder) this.hydrateFromEnv(config.roles.builder);
    if (config.roles.auditor) this.hydrateFromEnv(config.roles.auditor);

    const roles = [
      { name: 'Architect', role: config.roles.architect },
      { name: 'Builder', role: config.roles.builder },
      { name: 'Auditor', role: config.roles.auditor },
    ];

    for (const { name, role } of roles) {
      if (!role) {
        missing.push(isEn ? `Role ${name} is unconfigured` : `Role ${name} chưa được cấu hình`);
        continue;
      }
      if (!role.provider) {
        missing.push(`${name}: ${isEn ? "missing 'provider'" : "thiếu 'provider'"}`);
      }
      if (!role.model) {
        missing.push(`${name}: ${isEn ? "missing 'model'" : "thiếu 'model'"}`);
      }
      const isLocal =
        role.provider === 'openai-compatible' &&
        (role.baseURL?.includes('localhost') || role.baseURL?.includes('127.0.0.1'));

      const isGoogleAuth = role.provider === 'google' && AuthManager.isGoogleAuthenticated(role.apiKey);
      const isAnthropicAuth = role.provider === 'anthropic' && AuthManager.isAnthropicAuthenticated(role.apiKey);

      if (!role.apiKey && !isLocal && !isGoogleAuth && !isAnthropicAuth) {
        missing.push(`${name} (${role.provider}): ${isEn ? "missing 'apiKey' or OAuth" : "thiếu 'apiKey' hoặc OAuth"}`);
      }
    }
    return missing;
  }
}
