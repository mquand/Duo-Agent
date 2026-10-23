import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { AppConfig, RoleConfig } from '../types/index.js';

dotenv.config();

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.duo');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const LOCAL_CONFIG_FILE = path.join(process.cwd(), '.duorc');

const DEFAULT_CONFIG: AppConfig = {
  roles: {
    architect: {
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    },
    builder: {
      provider: 'google',
      model: 'gemini-2.0-flash',
    },
    auditor: {
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    },
  },
  telemetry: false,
};

export class ConfigManager {
  static getConfigPath(): string {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      return LOCAL_CONFIG_FILE;
    }
    return GLOBAL_CONFIG_FILE;
  }

  static async loadConfig(): Promise<AppConfig> {
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

  private static hydrateFromEnv(role: RoleConfig): void {
    if (role.apiKey) return;

    if (role.provider === 'anthropic') {
      role.apiKey = process.env.ANTHROPIC_API_KEY;
    } else if (role.provider === 'google') {
      role.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    } else if (role.provider === 'openai-compatible') {
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

  static getMissingKeys(config: AppConfig): string[] {
    const missing: string[] = [];
    const roles = [
      { name: 'Architect', role: config.roles?.architect },
      { name: 'Builder', role: config.roles?.builder },
      { name: 'Auditor', role: config.roles?.auditor },
    ];

    for (const { name, role } of roles) {
      if (!role) {
        missing.push(`Role ${name} chưa được cấu hình`);
        continue;
      }
      if (!role.provider) {
        missing.push(`${name}: thiếu 'provider'`);
      }
      if (!role.model) {
        missing.push(`${name}: thiếu 'model'`);
      }
      if (!role.apiKey && role.provider !== 'openai-compatible') {
        missing.push(`${name} (${role.provider}): thiếu 'apiKey'`);
      }
    }
    return missing;
  }
}
