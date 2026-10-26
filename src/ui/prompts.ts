import { confirm, select, input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { Plan, AppConfig, RoleConfig, ProviderType } from '../types/index.js';
import { THEMES } from './theme.js';

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[/~]/i,
  /drop\s+database/i,
  /drop\s+table/i,
  /ecto\.reset/i,
  /ecto\.drop/i,
  /git\s+reset\s+--hard/i,
  /git\s+push\s+.*--force/i,
  />\s*\/dev\/sd/i,
];

function maskKey(key?: string): string {
  if (!key) return chalk.dim('(not set / from env)');
  if (key === 'not-needed-for-local') return chalk.cyan('(local - no key needed)');
  if (key.length <= 8) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

interface ModelOption {
  name: string;
  provider: ProviderType;
  model: string;
  baseURL?: string;
}

const POPULAR_ARCHITECT_MODELS: ModelOption[] = [
  // Anthropic
  { name: 'Claude 3.7 Sonnet (Anthropic - Hybrid Reasoning)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
  { name: 'Claude Sonnet 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Claude Opus 5.5 (Anthropic flagship)', provider: 'anthropic', model: 'claude-opus-5-5' },
  { name: 'Claude 3.5 Sonnet (Anthropic)', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },

  // OpenAI
  { name: 'OpenAI o3-mini (High-speed reasoning)', provider: 'openai-compatible', model: 'o3-mini' },
  { name: 'OpenAI o1 (Deep reasoning)', provider: 'openai-compatible', model: 'o1' },
  { name: 'GPT-4o (OpenAI flagship)', provider: 'openai-compatible', model: 'gpt-4o' },
  { name: 'GPT-6 Astra (OpenAI flagship)', provider: 'openai-compatible', model: 'gpt-6-astra' },
  { name: 'GPT-6.1 Sol (OpenAI)', provider: 'openai-compatible', model: 'gpt-6.1-sol' },

  // Google
  { name: 'Gemini 2.0 Pro Experimental (Google)', provider: 'google', model: 'gemini-2.0-pro-exp-02-05' },
  { name: 'Gemini 2.0 Flash (Google)', provider: 'google', model: 'gemini-2.0-flash' },
  { name: 'Gemini 1.5 Pro (Google)', provider: 'google', model: 'gemini-1.5-pro' },

  // DeepSeek Official
  { name: 'DeepSeek R1 Reasoner (DeepSeek API)', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },
  { name: 'DeepSeek V3 Chat (DeepSeek API)', provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },

  // OpenRouter Unified API
  { name: 'OpenRouter: Claude 3.7 Sonnet', provider: 'openai-compatible', model: 'anthropic/claude-3.7-sonnet', baseURL: 'https://openrouter.ai/api/v1' },
  { name: 'OpenRouter: DeepSeek R1', provider: 'openai-compatible', model: 'deepseek/deepseek-r1', baseURL: 'https://openrouter.ai/api/v1' },

  // Groq & Mistral
  { name: 'Groq: Llama 3.3 70B Versatile', provider: 'openai-compatible', model: 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' },
  { name: 'Mistral Large 2', provider: 'openai-compatible', model: 'mistral-large-latest', baseURL: 'https://api.mistral.ai/v1' },

  // Local Ollama
  { name: 'Ollama: DeepSeek-R1 14B (Local)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: DeepSeek-R1 32B (Local)', provider: 'openai-compatible', model: 'deepseek-r1:32b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: Qwen 2.5 Coder 32B (Local)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
];

const POPULAR_BUILDER_MODELS: ModelOption[] = [
  // Google
  { name: 'Gemini 2.0 Flash (Google - ultra-fast coding)', provider: 'google', model: 'gemini-2.0-flash' },
  { name: 'Gemini 1.5 Flash (Google)', provider: 'google', model: 'gemini-1.5-flash' },

  // Anthropic
  { name: 'Claude Haiku 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-haiku-5-5' },
  { name: 'Claude 3.5 Haiku (Anthropic fast/cheap)', provider: 'anthropic', model: 'claude-3-5-haiku-latest' },
  { name: 'Claude Sonnet 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-sonnet-5-5' },

  // OpenAI
  { name: 'GPT-4o-mini (OpenAI fast/cheap)', provider: 'openai-compatible', model: 'gpt-4o-mini' },
  { name: 'GPT-4o (OpenAI)', provider: 'openai-compatible', model: 'gpt-4o' },
  { name: 'OpenAI o3-mini (Coding reasoning)', provider: 'openai-compatible', model: 'o3-mini' },
  { name: 'GPT-6 Luna (OpenAI fast/cheap)', provider: 'openai-compatible', model: 'gpt-6-luna' },

  // Mistral & DeepSeek
  { name: 'Mistral Codestral (Specialized code)', provider: 'openai-compatible', model: 'codestral-latest', baseURL: 'https://api.mistral.ai/v1' },
  { name: 'DeepSeek V3 Chat (DeepSeek API)', provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
  { name: 'DeepSeek R1 Reasoner (DeepSeek API)', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },

  // Groq & OpenRouter
  { name: 'Groq: Llama 3.3 70B (Ultra-fast)', provider: 'openai-compatible', model: 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' },
  { name: 'OpenRouter: Qwen 2.5 Coder 32B', provider: 'openai-compatible', model: 'qwen/qwen-2.5-coder-32b-instruct', baseURL: 'https://openrouter.ai/api/v1' },

  // Local Ollama
  { name: 'Ollama: Qwen 2.5 Coder 32B (Local)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: Qwen 2.5 Coder 14B (Local)', provider: 'openai-compatible', model: 'qwen2.5-coder:14b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: DeepSeek-R1 14B (Local)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
];

const POPULAR_AUDITOR_MODELS: ModelOption[] = [
  // Anthropic
  { name: 'Claude Sonnet 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Claude Opus 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-opus-5-5' },
  { name: 'Claude 3.7 Sonnet (Anthropic)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },

  // OpenAI
  { name: 'GPT-4o (OpenAI flagship)', provider: 'openai-compatible', model: 'gpt-4o' },
  { name: 'OpenAI o3-mini (Deep verification)', provider: 'openai-compatible', model: 'o3-mini' },
  { name: 'GPT-6.1 Sol (OpenAI)', provider: 'openai-compatible', model: 'gpt-6.1-sol' },

  // Google
  { name: 'Gemini 2.0 Pro Experimental (Google)', provider: 'google', model: 'gemini-2.0-pro-exp-02-05' },
  { name: 'Gemini 2.0 Flash (Google)', provider: 'google', model: 'gemini-2.0-flash' },

  // DeepSeek Official
  { name: 'DeepSeek R1 Reasoner (DeepSeek API)', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },

  // Mistral & Local
  { name: 'Mistral Large 2', provider: 'openai-compatible', model: 'mistral-large-latest', baseURL: 'https://api.mistral.ai/v1' },
  { name: 'Ollama: DeepSeek-R1 14B (Local)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
];

export class SecurityPrompts {
  static isDangerous(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }

  static async promptCommandApproval(command: string, autoAccept: boolean = false): Promise<boolean> {
    const isDanger = this.isDangerous(command);

    if (isDanger) {
      console.log(chalk.red.bold('\n[WARNING] Potentially destructive command:'));
      console.log(chalk.red(`  ${command}\n`));
      return await confirm({
        message: 'Execute this command?',
        default: false,
      });
    }

    if (autoAccept) return true;

    return await confirm({
      message: `Execute: ${chalk.cyan(command)}?`,
      default: true,
    });
  }

  static async promptPlanApproval(plan: Plan): Promise<'execute' | 'abort'> {
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.white.bold('Architect Plan'));
    console.log(chalk.gray(`Goal:    `) + chalk.white(plan.goal));
    console.log(chalk.gray(`Summary: `) + chalk.gray(plan.summary));
    console.log(chalk.gray('─'.repeat(60)));

    for (const step of plan.dag) {
      const depInfo = step.depends_on.length > 0 ? chalk.gray(` (depends on ${step.depends_on.join(', ')})`) : chalk.gray(' (parallel)');
      console.log(chalk.cyan(`\n[${step.id}] `) + chalk.white(step.title) + depInfo);
      console.log(chalk.gray(`  Files: `) + chalk.gray(step.target_files.join(', ')));
      console.log(chalk.gray(`  Task:  `) + chalk.gray(step.instructions));
      if (step.verification_cmd) {
        console.log(chalk.gray(`  Test:  `) + chalk.gray(step.verification_cmd));
      }
    }
    console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));

    const answer = await select({
      message: 'Plan action:',
      choices: [
        { name: 'Execute plan', value: 'execute' },
        { name: 'Abort', value: 'abort' },
      ],
    });

    return answer as 'execute' | 'abort';
  }

  private static async selectOrCustomModel(
    roleTitle: string,
    options: ModelOption[]
  ): Promise<RoleConfig> {
    const choices = [
      {
        name: `${chalk.bold.cyan('✏️  Enter Custom Model / Endpoint')} ${chalk.gray('(Any model: Ollama, OpenRouter, vLLM, DeepSeek...)')}`,
        value: 'custom',
      },
      ...options.map((opt, idx) => ({
        name: opt.name,
        value: String(idx),
      })),
    ];

    const selectedIdx = await select({
      message: `Select model for ${roleTitle}:`,
      choices,
    });

    if (selectedIdx === 'custom') {
      const customType = await select({
        message: `Provider/Endpoint platform for ${roleTitle}:`,
        choices: [
          {
            name: `${chalk.bold.yellow('🏠 Local Ollama')}              ${chalk.gray('Run any local model offline (e.g. qwen2.5-coder:32b, deepseek-r1:14b)')}`,
            value: 'ollama',
          },
          {
            name: `${chalk.bold.hex('#FF8800')('🌐 OpenRouter')}                ${chalk.gray('300+ models with unified API (e.g. anthropic/claude-3.7-sonnet)')}`,
            value: 'openrouter',
          },
          {
            name: `${chalk.bold.blue('🧠 DeepSeek Official')}            ${chalk.gray('Official API (deepseek-reasoner, deepseek-chat)')}`,
            value: 'deepseek',
          },
          {
            name: `${chalk.bold.cyan('🤖 Anthropic Claude')}             ${chalk.gray('Official Claude Opus, Sonnet, Haiku')}`,
            value: 'anthropic',
          },
          {
            name: `${chalk.bold.red('💎 Google Gemini')}                ${chalk.gray('Official Gemini 2.0 Flash, 2.0 Pro')}`,
            value: 'google',
          },
          {
            name: `${chalk.bold.green('🟢 OpenAI Official')}              ${chalk.gray('Official o3-mini, o1, GPT-4o')}`,
            value: 'openai',
          },
          {
            name: `${chalk.bold.magenta('⚡ Groq Cloud')}                   ${chalk.gray('Ultra-fast inference (llama-3.3-70b-versatile)')}`,
            value: 'groq',
          },
          {
            name: `${chalk.bold.white('🖥️  Local vLLM / LM Studio')}       ${chalk.gray('Local OpenAI-compatible server at custom port')}`,
            value: 'local_server',
          },
          {
            name: `${chalk.bold.gray('⚙️  Custom OpenAI-Compatible')}     ${chalk.gray('Any custom Base URL & model name')}`,
            value: 'custom_url',
          },
        ],
      });

      if (customType === 'ollama') {
        const modelName = await input({
          message: `Ollama model name (e.g. qwen2.5-coder:32b, deepseek-r1:14b):`,
          default: roleTitle === 'Builder' ? 'qwen2.5-coder:32b' : 'deepseek-r1:14b',
        });
        return {
          provider: 'openai-compatible',
          model: modelName.trim(),
          baseURL: 'http://localhost:11434/v1',
          apiKey: 'not-needed-for-local',
        };
      }

      if (customType === 'openrouter') {
        const modelName = await input({
          message: `OpenRouter model identifier (e.g. anthropic/claude-3.7-sonnet, deepseek/deepseek-r1):`,
          default: roleTitle === 'Builder' ? 'qwen/qwen-2.5-coder-32b-instruct' : 'anthropic/claude-3.7-sonnet',
        });
        return {
          provider: 'openai-compatible',
          model: modelName.trim(),
          baseURL: 'https://openrouter.ai/api/v1',
        };
      }

      if (customType === 'deepseek') {
        const modelName = await select({
          message: `DeepSeek model:`,
          choices: [
            { name: 'deepseek-reasoner (DeepSeek-R1 reasoning model)', value: 'deepseek-reasoner' },
            { name: 'deepseek-chat (DeepSeek-V3 chat & coding model)', value: 'deepseek-chat' },
          ],
        });
        return {
          provider: 'openai-compatible',
          model: modelName,
          baseURL: 'https://api.deepseek.com/v1',
        };
      }

      if (customType === 'groq') {
        const modelName = await input({
          message: `Groq model identifier:`,
          default: 'llama-3.3-70b-versatile',
        });
        return {
          provider: 'openai-compatible',
          model: modelName.trim(),
          baseURL: 'https://api.groq.com/openai/v1',
        };
      }

      if (customType === 'anthropic') {
        const modelName = await input({
          message: `Anthropic model name:`,
          default: roleTitle === 'Builder' ? 'claude-haiku-5-5' : 'claude-sonnet-5-5',
        });
        return {
          provider: 'anthropic',
          model: modelName.trim(),
        };
      }

      if (customType === 'google') {
        const modelName = await input({
          message: `Google Gemini model name:`,
          default: 'gemini-2.0-flash',
        });
        return {
          provider: 'google',
          model: modelName.trim(),
        };
      }

      if (customType === 'openai') {
        const modelName = await input({
          message: `OpenAI model name:`,
          default: roleTitle === 'Architect' ? 'o3-mini' : 'gpt-4o-mini',
        });
        return {
          provider: 'openai-compatible',
          model: modelName.trim(),
          baseURL: 'https://api.openai.com/v1',
        };
      }

      if (customType === 'local_server') {
        const baseURL = await input({
          message: `Local server Base URL:`,
          default: 'http://localhost:1234/v1',
        });
        const modelName = await input({
          message: `Model name on local server:`,
          default: 'local-model',
        });
        return {
          provider: 'openai-compatible',
          model: modelName.trim(),
          baseURL: baseURL.trim(),
          apiKey: 'not-needed-for-local',
        };
      }

      // custom_url
      const baseURL = await input({
        message: `Custom OpenAI-compatible Base URL:`,
        default: 'https://api.openai.com/v1',
      });
      const modelName = await input({
        message: `Model name:`,
      });
      return {
        provider: 'openai-compatible',
        model: modelName.trim(),
        baseURL: baseURL.trim(),
      };
    }

    const picked = options[parseInt(selectedIdx, 10)];
    return {
      provider: picked.provider,
      model: picked.model,
      baseURL: picked.baseURL,
    };
  }

  static async promptOnboarding(): Promise<AppConfig> {
    console.log(chalk.white.bold('\nDuo Setup\n'));

    const configMode = await select({
      message: 'Configuration mode:',
      choices: [
        {
          name: `${chalk.bold.yellow('⭐ Recommended Presets')}      ${chalk.gray('(Curated setups: Pure Claude, Pure OpenAI, Pure Gemini, Hybrid, Offline...)')}`,
          value: 'recommended',
        },
        {
          name: `${chalk.bold.green('🎯 Single Model for All Roles')} ${chalk.gray('(Use ONE model & ONE API key for Architect, Builder, and Auditor)')}`,
          value: 'single',
        },
        {
          name: `${chalk.bold.cyan('🛠️  Custom Role-by-Role')}       ${chalk.gray('(Individually configure Architect, Builder, and Auditor)')}`,
          value: 'custom',
        },
      ],
    });

    let architectConfig: RoleConfig;
    let builderConfig: RoleConfig;
    let auditorConfig: RoleConfig;

    if (configMode === 'single') {
      console.log(chalk.cyan('\nConfigure Single Model (Applies to Architect, Builder & Auditor):'));
      const single = await this.selectOrCustomModel('All Roles', POPULAR_ARCHITECT_MODELS);
      architectConfig = { ...single };
      builderConfig = { ...single };
      auditorConfig = { ...single };
    } else if (configMode === 'recommended') {
      const presetChoice = await select({
        message: 'Select Recommended Preset:',
        choices: [
          {
            name: `${chalk.bold.hex('#9333EA')('🟣 Pure Claude (100% Anthropic)')}  ${chalk.gray('Arch: Sonnet 5.5 | Build: Haiku 3.5 | Audit: Sonnet (Only 1 Anthropic key!)')}`,
            value: 'claude_pure',
          },
          {
            name: `${chalk.bold.green('🟢 Pure OpenAI (100% OpenAI)')}     ${chalk.gray('Arch: o3-mini | Build: GPT-4o-mini | Audit: GPT-4o (Only 1 OpenAI key!)')}`,
            value: 'openai_pure',
          },
          {
            name: `${chalk.bold.blue('🔵 Pure Gemini (100% Google)')}     ${chalk.gray('Arch: Gemini 2.0 Pro | Build: Flash | Audit: Flash (Only 1 Google key!)')}`,
            value: 'gemini_pure',
          },
          {
            name: `${chalk.bold.magenta('🧠 Pure DeepSeek (100% DeepSeek)')} ${chalk.gray('Arch: DeepSeek R1 | Build: DeepSeek V3 | Audit: R1 (Only 1 DeepSeek key!)')}`,
            value: 'deepseek_pure',
          },
          {
            name: `${chalk.bold.yellow('🏠 Local Offline (100% Ollama)')}   ${chalk.gray('Arch: DeepSeek-R1 14B | Build: Qwen2.5 32B | Audit: R1 (100% Free, 0đ API)')}`,
            value: 'offline',
          },
          {
            name: `${chalk.bold.cyan('⭐ Claude 5.5 Flagship (Hybrid)')} ${chalk.gray('Arch: Opus 5.5 | Build: Gemini Flash | Audit: Sonnet 5.5 (Multi-provider)')}`,
            value: 'flagship',
          },
          {
            name: `${chalk.bold.white('⚡ Balanced Duo (Hybrid)')}        ${chalk.gray('Arch: Sonnet 5.5 | Build: Gemini Flash | Audit: Sonnet 5.5 (Multi-provider)')}`,
            value: 'balanced',
          },
          {
            name: `${chalk.bold.hex('#FF8800')('🚀 Groq Ultra Speed (Hybrid)')}   ${chalk.gray('Arch: Sonnet 5.5 | Build: Llama 3.3 70B (Groq) | Audit: Haiku')}`,
            value: 'fast',
          },
          {
            name: `${chalk.bold.gray('💻 Codestral Specialized (Hybrid)')} ${chalk.gray('Arch: Sonnet 5.5 | Build: Codestral (Mistral) | Audit: Sonnet')}`,
            value: 'codestral',
          },
        ],
      });

      if (presetChoice === 'claude_pure') {
        architectConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
        builderConfig = { provider: 'anthropic', model: 'claude-3-5-haiku-latest' };
        auditorConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
      } else if (presetChoice === 'openai_pure') {
        architectConfig = { provider: 'openai-compatible', model: 'o3-mini' };
        builderConfig = { provider: 'openai-compatible', model: 'gpt-4o-mini' };
        auditorConfig = { provider: 'openai-compatible', model: 'gpt-4o' };
      } else if (presetChoice === 'gemini_pure') {
        architectConfig = { provider: 'google', model: 'gemini-2.0-pro-exp-02-05' };
        builderConfig = { provider: 'google', model: 'gemini-2.0-flash' };
        auditorConfig = { provider: 'google', model: 'gemini-2.0-flash' };
      } else if (presetChoice === 'deepseek_pure') {
        architectConfig = {
          provider: 'openai-compatible',
          model: 'deepseek-reasoner',
          baseURL: 'https://api.deepseek.com/v1',
        };
        builderConfig = {
          provider: 'openai-compatible',
          model: 'deepseek-chat',
          baseURL: 'https://api.deepseek.com/v1',
        };
        auditorConfig = {
          provider: 'openai-compatible',
          model: 'deepseek-reasoner',
          baseURL: 'https://api.deepseek.com/v1',
        };
      } else if (presetChoice === 'flagship') {
        architectConfig = { provider: 'anthropic', model: 'claude-opus-5-5' };
        builderConfig = { provider: 'google', model: 'gemini-2.0-flash' };
        auditorConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
      } else if (presetChoice === 'balanced') {
        architectConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
        builderConfig = { provider: 'google', model: 'gemini-2.0-flash' };
        auditorConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
      } else if (presetChoice === 'codestral') {
        architectConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
        builderConfig = {
          provider: 'openai-compatible',
          model: 'codestral-latest',
          baseURL: 'https://api.mistral.ai/v1',
        };
        auditorConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
      } else if (presetChoice === 'fast') {
        architectConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
        builderConfig = {
          provider: 'openai-compatible',
          model: 'llama-3.3-70b-versatile',
          baseURL: 'https://api.groq.com/openai/v1',
        };
        auditorConfig = { provider: 'anthropic', model: 'claude-haiku-5-5' };
      } else {
        // offline
        console.log(chalk.green('\n+ Configured for Local Offline (Ollama) - No API keys required!\n'));
        return {
          roles: {
            architect: {
              provider: 'openai-compatible',
              model: 'deepseek-r1:14b',
              baseURL: 'http://localhost:11434/v1',
              apiKey: 'not-needed-for-local',
            },
            builder: {
              provider: 'openai-compatible',
              model: 'qwen2.5-coder:32b',
              baseURL: 'http://localhost:11434/v1',
              apiKey: 'not-needed-for-local',
            },
            auditor: {
              provider: 'openai-compatible',
              model: 'deepseek-r1:14b',
              baseURL: 'http://localhost:11434/v1',
              apiKey: 'not-needed-for-local',
            },
          },
        };
      }
    } else {
      console.log(chalk.cyan('\nCustom Configuration:'));
      architectConfig = await this.selectOrCustomModel('Architect', POPULAR_ARCHITECT_MODELS);
      builderConfig = await this.selectOrCustomModel('Builder', POPULAR_BUILDER_MODELS);
      auditorConfig = await this.selectOrCustomModel('Auditor', POPULAR_AUDITOR_MODELS);
    }

    // Ask for API keys if needed
    console.log(chalk.gray('\nAPI Keys Configuration:'));

    // Anthropic keys
    const anthropicRoles = [architectConfig, builderConfig, auditorConfig].filter((r) => r.provider === 'anthropic');
    if (anthropicRoles.length > 0) {
      const hasEnv = !!process.env.ANTHROPIC_API_KEY;
      if (hasEnv) {
        for (const r of anthropicRoles) r.apiKey = process.env.ANTHROPIC_API_KEY;
        console.log(chalk.green(`+ Found $ANTHROPIC_API_KEY in environment (${maskKey(process.env.ANTHROPIC_API_KEY!)})`));
      } else {
        const key = await password({
          message: `Anthropic API Key ${chalk.dim('[Paste sk-ant-... or press Enter to set later]')}:`,
          mask: '*',
        });
        if (key.trim()) {
          for (const r of anthropicRoles) r.apiKey = key.trim();
          console.log(chalk.green(`+ Anthropic Key received (${maskKey(key.trim())})`));
        } else {
          console.log(chalk.yellow('⚠️ Notice: Claude models require an Anthropic API key to run.'));
        }
      }
    }

    // Google Gemini keys
    const googleRoles = [architectConfig, builderConfig, auditorConfig].filter((r) => r.provider === 'google');
    if (googleRoles.length > 0) {
      const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (envKey) {
        for (const r of googleRoles) r.apiKey = envKey;
        console.log(chalk.green(`+ Found $GEMINI_API_KEY in environment (${maskKey(envKey)})`));
      } else {
        const key = await password({
          message: `Google Gemini API Key ${chalk.dim('[Paste AIzaSy... or press Enter to set later]')}:`,
          mask: '*',
        });
        if (key.trim()) {
          for (const r of googleRoles) r.apiKey = key.trim();
          console.log(chalk.green(`+ Google Gemini Key received (${maskKey(key.trim())})`));
        } else {
          console.log(chalk.yellow('⚠️ Notice: Gemini models require a Google API key to run.'));
        }
      }
    }

    // OpenAI-compatible keys
    const openAIRoles = [architectConfig, builderConfig, auditorConfig].filter((r) => r.provider === 'openai-compatible');
    if (openAIRoles.length > 0) {
      const allLocal = openAIRoles.every((r) =>
        r.baseURL?.includes('localhost') || r.baseURL?.includes('127.0.0.1')
      );

      if (allLocal) {
        for (const r of openAIRoles) r.apiKey = 'not-needed-for-local';
        console.log(chalk.green('+ Local LLM endpoint detected (Ollama) - No API key needed.'));
      } else {
        const isOpenRouter = openAIRoles.some((r) => r.baseURL?.includes('openrouter'));
        const isDeepSeek = openAIRoles.some((r) => r.baseURL?.includes('deepseek'));
        const isGroq = openAIRoles.some((r) => r.baseURL?.includes('groq'));
        const isMistral = openAIRoles.some((r) => r.baseURL?.includes('mistral'));

        let keyName = 'OpenAI';
        let envVar = process.env.OPENAI_API_KEY;
        if (isOpenRouter) {
          keyName = 'OpenRouter';
          envVar = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
        } else if (isDeepSeek) {
          keyName = 'DeepSeek';
          envVar = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
        } else if (isGroq) {
          keyName = 'Groq';
          envVar = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
        } else if (isMistral) {
          keyName = 'Mistral';
          envVar = process.env.MISTRAL_API_KEY || process.env.OPENAI_API_KEY;
        }

        if (envVar) {
          for (const r of openAIRoles) {
            if (!r.baseURL?.includes('localhost') && !r.baseURL?.includes('127.0.0.1')) {
              r.apiKey = envVar;
            } else {
              r.apiKey = 'not-needed-for-local';
            }
          }
          console.log(chalk.green(`+ Found $${keyName.toUpperCase()}_API_KEY in environment (${maskKey(envVar)})`));
        } else {
          const key = await password({
            message: `${keyName} API Key ${chalk.dim('[Paste sk-... or press Enter to set later]')}:`,
            mask: '*',
          });
          if (key.trim()) {
            for (const r of openAIRoles) {
              if (!r.baseURL?.includes('localhost') && !r.baseURL?.includes('127.0.0.1')) {
                r.apiKey = key.trim();
              } else {
                r.apiKey = 'not-needed-for-local';
              }
            }
            console.log(chalk.green(`+ ${keyName} API Key received (${maskKey(key.trim())})`));
          }
        }
      }
    }

    return {
      roles: {
        architect: architectConfig,
        builder: builderConfig,
        auditor: auditorConfig,
      },
    };
  }

  static async promptChangeModel(config: AppConfig): Promise<AppConfig> {
    const modeChoice = await select({
      message: 'Model configuration mode:',
      choices: [
        {
          name: `${chalk.bold.yellow('⭐ Recommended Presets')}      ${chalk.gray('(Switch all roles to a curated preset: Pure Claude, OpenAI, Offline...)')}`,
          value: 'preset',
        },
        {
          name: `${chalk.bold.green('🎯 Single Model for All Roles')} ${chalk.gray('(Apply ONE model & API key to Architect, Builder, and Auditor)')}`,
          value: 'single',
        },
        {
          name: `${chalk.bold.cyan('🛠️  Custom Role Setup')}          ${chalk.gray('(Customize Architect, Builder, or Auditor individually)')}`,
          value: 'role',
        },
      ],
    });

    if (modeChoice === 'preset') {
      const newConfig = await this.promptOnboarding();
      return {
        ...config,
        roles: newConfig.roles,
      };
    }

    if (modeChoice === 'single') {
      console.log(chalk.cyan('\nConfigure Single Model (Applies to Architect, Builder & Auditor):'));
      const singleRoleConfig = await this.selectOrCustomModel('All Roles', POPULAR_ARCHITECT_MODELS);

      const isLocal =
        singleRoleConfig.provider === 'openai-compatible' &&
        (singleRoleConfig.baseURL?.includes('localhost') || singleRoleConfig.baseURL?.includes('127.0.0.1'));

      if (isLocal) {
        singleRoleConfig.apiKey = 'not-needed-for-local';
        console.log(chalk.green(`+ Local model selected - No API key required.`));
      } else {
        const currentKey = config.roles.architect?.apiKey;
        const keyHint = currentKey
          ? chalk.dim(`[Enter to keep current (${maskKey(currentKey)}), or type "none" to remove]`)
          : chalk.dim('[Paste key, Enter if set in env, or type "none" for no key]');

        const inputKey = await input({
          message: `API Key for ${singleRoleConfig.model} ${keyHint}:`,
        });
        const trimmed = inputKey.trim();
        const lower = trimmed.toLowerCase();
        if (['none', 'clear', 'remove', 'delete', 'no', 'unset'].includes(lower)) {
          delete singleRoleConfig.apiKey;
          console.log(chalk.yellow(`+ Removed API Key (key cleared).`));
        } else if (trimmed) {
          singleRoleConfig.apiKey = trimmed;
          console.log(chalk.green(`+ API Key updated (${maskKey(trimmed)})`));
        } else {
          singleRoleConfig.apiKey = config.roles.architect?.apiKey;
        }
      }

      const effortChoice = await select({
        message: `Reasoning effort / Thinking budget:`,
        default: config.roles.architect?.reasoningEffort || 'medium',
        choices: [
          { name: 'Medium (Balanced speed & depth - recommended)', value: 'medium' },
          { name: 'High (Maximum reasoning depth & extended thinking)', value: 'high' },
          { name: 'Low (Fast execution, minimal thinking tokens)', value: 'low' },
          { name: 'Off / Default (Standard execution without extended thinking)', value: 'off' },
        ],
      });
      singleRoleConfig.reasoningEffort = effortChoice as 'low' | 'medium' | 'high' | 'off';

      const updatedConfig: AppConfig = {
        ...config,
        roles: {
          architect: { ...singleRoleConfig },
          builder: { ...singleRoleConfig },
          auditor: { ...singleRoleConfig },
        },
      };

      console.log(chalk.green(`\n+ All roles set to: ${singleRoleConfig.model} (${singleRoleConfig.provider}, effort: ${singleRoleConfig.reasoningEffort})\n`));
      return updatedConfig;
    }

    const roleChoice = await select({
      message: 'Select role to customize:',
      choices: [
        { name: `Architect (${config.roles.architect.model}) [${config.roles.architect.provider}]`, value: 'architect' },
        { name: `Builder (${config.roles.builder.model}) [${config.roles.builder.provider}]`, value: 'builder' },
        { name: `Auditor (${config.roles.auditor.model}) [${config.roles.auditor.provider}]`, value: 'auditor' },
      ],
    });

    const targetRole = roleChoice as 'architect' | 'builder' | 'auditor';
    let options: ModelOption[];
    if (targetRole === 'architect') options = POPULAR_ARCHITECT_MODELS;
    else if (targetRole === 'builder') options = POPULAR_BUILDER_MODELS;
    else options = POPULAR_AUDITOR_MODELS;

    const newRoleConfig = await this.selectOrCustomModel(targetRole, options);

    const isLocal =
      newRoleConfig.provider === 'openai-compatible' &&
      (newRoleConfig.baseURL?.includes('localhost') || newRoleConfig.baseURL?.includes('127.0.0.1'));

    if (isLocal) {
      newRoleConfig.apiKey = 'not-needed-for-local';
      console.log(chalk.green(`+ Local model selected - No API key required.`));
    } else {
      const currentKey = config.roles[targetRole]?.apiKey;
      const keyHint = currentKey
        ? chalk.dim(`[Enter to keep current (${maskKey(currentKey)}), or type "none" to remove]`)
        : chalk.dim('[Paste key, Enter if set in env, or type "none" for no key]');

      const inputKey = await input({
        message: `API Key for ${targetRole} ${keyHint}:`,
      });
      const trimmed = inputKey.trim();
      const lower = trimmed.toLowerCase();
      if (['none', 'clear', 'remove', 'delete', 'no', 'unset'].includes(lower)) {
        delete newRoleConfig.apiKey;
        console.log(chalk.yellow(`+ Removed API Key for ${targetRole} (key cleared).`));
      } else if (trimmed) {
        newRoleConfig.apiKey = trimmed;
        console.log(chalk.green(`+ ${targetRole} API Key updated (${maskKey(trimmed)})`));
      } else {
        newRoleConfig.apiKey = config.roles[targetRole]?.apiKey;
      }
    }

    const effortChoice = await select({
      message: `Reasoning effort / Thinking budget for ${targetRole}:`,
      default: config.roles[targetRole]?.reasoningEffort || 'medium',
      choices: [
        { name: 'Medium (Balanced speed & depth - recommended)', value: 'medium' },
        { name: 'High (Maximum reasoning depth & extended thinking)', value: 'high' },
        { name: 'Low (Fast execution, minimal thinking tokens)', value: 'low' },
        { name: 'Off / Default (Standard execution without extended thinking)', value: 'off' },
      ],
    });
    newRoleConfig.reasoningEffort = effortChoice as 'low' | 'medium' | 'high' | 'off';

    const updatedConfig: AppConfig = {
      ...config,
      roles: {
        ...config.roles,
        [targetRole]: newRoleConfig,
      },
    };

    console.log(chalk.green(`\n+ Updated ${targetRole} to ${newRoleConfig.model} (${newRoleConfig.provider}, effort: ${newRoleConfig.reasoningEffort})`));
    return updatedConfig;
  }

  static async promptKeyManagement(config: AppConfig): Promise<AppConfig> {
    const isEn = config.language === 'en';
    console.log(chalk.white.bold(isEn ? '\nAPI Key Management\n' : '\nQuản lý API Key\n'));

    const roles = [
      { id: 'architect' as const, name: 'Architect', role: config.roles.architect },
      { id: 'builder' as const, name: 'Builder', role: config.roles.builder },
      { id: 'auditor' as const, name: 'Auditor', role: config.roles.auditor },
    ];

    for (const { name, role } of roles) {
      const masked = maskKey(role.apiKey);
      const prov = role.provider + (role.baseURL ? ` @ ${role.baseURL}` : '');
      console.log(
        `  ${chalk.cyan(name.padEnd(10))} ${chalk.gray(`[${role.model}]`)} ${chalk.gray(`(${prov})`)}: ${chalk.yellow(masked)}`
      );
    }
    console.log();

    const action = await select({
      message: isEn ? 'Select API key action:' : 'Chọn thao tác với API Key:',
      choices: [
        {
          name: isEn ? '✏️  Update API Key for a role' : '✏️  Cập nhật API Key cho một vai trò',
          value: 'update',
        },
        {
          name: isEn ? '🗑️  Remove / Clear API Key for a role (Stop using key)' : '🗑️  Xóa / Bỏ API Key của một vai trò (Không dùng key nữa)',
          value: 'remove_one',
        },
        {
          name: isEn ? '🧹  Clear ALL stored API Keys (Switch to local Ollama or .env)' : '🧹  Xóa TOÀN BỘ API Key đã lưu (Chuyển sang offline hoặc file .env)',
          value: 'clear_all',
        },
        {
          name: isEn ? '🔙  Cancel / Back' : '🔙  Quay lại',
          value: 'back',
        },
      ],
    });

    if (action === 'back') return config;

    const newRoles = {
      architect: { ...config.roles.architect },
      builder: { ...config.roles.builder },
      auditor: { ...config.roles.auditor },
    };

    if (action === 'clear_all') {
      delete newRoles.architect.apiKey;
      delete newRoles.builder.apiKey;
      delete newRoles.auditor.apiKey;
      console.log(chalk.green(isEn ? '\n+ Cleared all API keys from config.\n' : '\n+ Đã xóa toàn bộ API key khỏi cấu hình.\n'));
      return { ...config, roles: newRoles };
    }

    if (action === 'remove_one') {
      const targetRole = (await select({
        message: isEn ? 'Select role to remove API key from:' : 'Chọn vai trò cần xóa API Key:',
        choices: [
          { name: `Architect (${config.roles.architect.model})`, value: 'architect' },
          { name: `Builder (${config.roles.builder.model})`, value: 'builder' },
          { name: `Auditor (${config.roles.auditor.model})`, value: 'auditor' },
        ],
      })) as 'architect' | 'builder' | 'auditor';

      delete newRoles[targetRole].apiKey;
      console.log(chalk.green(isEn ? `\n+ Removed API Key for ${targetRole}.\n` : `\n+ Đã xóa API Key của ${targetRole}.\n`));
      return { ...config, roles: newRoles };
    }

    if (action === 'update') {
      const targetRole = (await select({
        message: isEn ? 'Select role to update API key:' : 'Chọn vai trò cần cập nhật API Key:',
        choices: [
          { name: `Architect (${config.roles.architect.model})`, value: 'architect' },
          { name: `Builder (${config.roles.builder.model})`, value: 'builder' },
          { name: `Auditor (${config.roles.auditor.model})`, value: 'auditor' },
        ],
      })) as 'architect' | 'builder' | 'auditor';

      const keyInput = await input({
        message: isEn
          ? `Enter new API key for ${targetRole} (or type 'none' to remove):`
          : `Nhập API Key mới cho ${targetRole} (hoặc gõ 'none' để xóa key):`,
      });

      const trimmed = keyInput.trim();
      if (!trimmed || ['none', 'clear', 'remove', 'delete', 'no'].includes(trimmed.toLowerCase())) {
        delete newRoles[targetRole].apiKey;
        console.log(chalk.yellow(isEn ? `\n+ Removed API Key for ${targetRole}.\n` : `\n+ Đã xóa API Key của ${targetRole}.\n`));
      } else {
        newRoles[targetRole].apiKey = trimmed;
        console.log(chalk.green(isEn ? `\n+ Updated API Key for ${targetRole} (${maskKey(trimmed)}).\n` : `\n+ Đã cập nhật API Key cho ${targetRole} (${maskKey(trimmed)}).\n`));
      }
      return { ...config, roles: newRoles };
    }

    return config;
  }

  static async promptSelectEffort(config: AppConfig): Promise<AppConfig> {
    const roleChoice = await select({
      message: 'Select target role to configure reasoning effort / thinking budget:',
      choices: [
        { name: 'All Roles (Architect, Builder, Auditor)', value: 'all' },
        { name: `Architect (${config.roles.architect.model}) [Current: ${config.roles.architect.reasoningEffort || 'default'}]`, value: 'architect' },
        { name: `Builder (${config.roles.builder.model}) [Current: ${config.roles.builder.reasoningEffort || 'default'}]`, value: 'builder' },
        { name: `Auditor (${config.roles.auditor.model}) [Current: ${config.roles.auditor.reasoningEffort || 'default'}]`, value: 'auditor' },
      ],
    });

    const effortChoice = await select({
      message: 'Select reasoning effort level:',
      choices: [
        { name: 'High (Maximum reasoning depth & extended thinking budget)', value: 'high' },
        { name: 'Medium (Balanced reasoning speed & token budget - recommended)', value: 'medium' },
        { name: 'Low (Fast execution with minimal thinking tokens)', value: 'low' },
        { name: 'Off / Default (Standard execution without extended thinking)', value: 'off' },
      ],
    });

    const effort = effortChoice as 'low' | 'medium' | 'high' | 'off';
    const newRoles = { ...config.roles };

    if (roleChoice === 'all') {
      newRoles.architect = { ...newRoles.architect, reasoningEffort: effort };
      newRoles.builder = { ...newRoles.builder, reasoningEffort: effort };
      newRoles.auditor = { ...newRoles.auditor, reasoningEffort: effort };
    } else {
      const r = roleChoice as 'architect' | 'builder' | 'auditor';
      newRoles[r] = { ...newRoles[r], reasoningEffort: effort };
    }

    console.log(chalk.green(`\n+ Updated reasoning effort for ${roleChoice} to: ${effort}`));
    return {
      ...config,
      roles: newRoles,
    };
  }

  static async promptSelectLanguage(config: AppConfig): Promise<AppConfig> {
    const langChoice = await select({
      message: 'Interface language:',
      default: config.language || 'vi',
      choices: [
        { name: 'Vietnamese', value: 'vi' },
        { name: 'English', value: 'en' },
      ],
    });

    const updatedConfig: AppConfig = {
      ...config,
      language: langChoice as 'en' | 'vi',
    };

    console.log(chalk.green(`\n+ Language set to ${langChoice === 'en' ? 'English' : 'Vietnamese'}`));
    return updatedConfig;
  }

  static async promptSelectTheme(config: AppConfig): Promise<AppConfig> {
    const choices = Object.values(THEMES).map((t) => ({
      name: t.name,
      value: t.id,
    }));

    const themeChoice = await select({
      message: 'Terminal theme:',
      default: config.theme || 'cyber',
      choices,
    });

    const updatedConfig: AppConfig = {
      ...config,
      theme: themeChoice,
    };

    const chosenTheme = THEMES[themeChoice];
    console.log(chalk.gray('\n' + '─'.repeat(45)));
    console.log(chalk.gray('1  function greet() {'));
    console.log(chalk.red('2 -  console.log("Hello, World!");'));
    console.log(chalk.green('2 +  console.log("Hello, Duo!");'));
    console.log(chalk.gray('3  }'));
    console.log(chalk.gray('─'.repeat(45)));
    console.log(chalk.hex(chosenTheme.accent)(`\n+ Theme: ${chosenTheme.name}`));
    return updatedConfig;
  }
}
