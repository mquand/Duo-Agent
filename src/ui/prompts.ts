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

function maskKey(key: string): string {
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
  { name: 'Claude Opus 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-opus-5-5' },
  { name: 'Claude Sonnet 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'GPT-6 Astra (OpenAI flagship)', provider: 'openai-compatible', model: 'gpt-6-astra' },
  { name: 'GPT-6.1 Sol (OpenAI)', provider: 'openai-compatible', model: 'gpt-6.1-sol' },
  { name: 'Claude 3.7 Sonnet (Anthropic)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
  { name: 'OpenAI o3-mini', provider: 'openai-compatible', model: 'o3-mini' },
  { name: 'OpenAI o1', provider: 'openai-compatible', model: 'o1' },
  { name: 'GPT-4o (OpenAI)', provider: 'openai-compatible', model: 'gpt-4o' },
  { name: 'DeepSeek R1', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },
  { name: 'Claude 3.5 Sonnet (Anthropic)', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
  { name: 'Mistral Large 2', provider: 'openai-compatible', model: 'mistral-large-latest', baseURL: 'https://api.mistral.ai/v1' },
  { name: 'xAI Grok 2', provider: 'openai-compatible', model: 'grok-2-latest', baseURL: 'https://api.x.ai/v1' },
  { name: 'Ollama DeepSeek-R1 (Local)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
];

const POPULAR_BUILDER_MODELS: ModelOption[] = [
  { name: 'Gemini 2.0 Flash (Google)', provider: 'google', model: 'gemini-2.0-flash' },
  { name: 'GPT-6 Luna (OpenAI fast/cheap)', provider: 'openai-compatible', model: 'gpt-6-luna' },
  { name: 'GPT-6.1 Sol (OpenAI)', provider: 'openai-compatible', model: 'gpt-6.1-sol' },
  { name: 'Claude Haiku 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-haiku-5-5' },
  { name: 'Claude Sonnet 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Mistral Codestral', provider: 'openai-compatible', model: 'codestral-latest', baseURL: 'https://api.mistral.ai/v1' },
  { name: 'GPT-4o-mini (OpenAI)', provider: 'openai-compatible', model: 'gpt-4o-mini' },
  { name: 'OpenAI o3-mini', provider: 'openai-compatible', model: 'o3-mini' },
  { name: 'DeepSeek V3', provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
  { name: 'Groq Llama 3.3 70B', provider: 'openai-compatible', model: 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' },
  { name: 'Qwen 2.5 Coder 32B', provider: 'openai-compatible', model: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
  { name: 'Ollama Qwen 2.5 Coder (Local)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
];

const POPULAR_AUDITOR_MODELS: ModelOption[] = [
  { name: 'Claude Opus 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-opus-5-5' },
  { name: 'Claude Sonnet 5.5 (Anthropic)', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'GPT-6 Astra (OpenAI flagship)', provider: 'openai-compatible', model: 'gpt-6-astra' },
  { name: 'GPT-6.1 Sol (OpenAI)', provider: 'openai-compatible', model: 'gpt-6.1-sol' },
  { name: 'Claude 3.7 Sonnet (Anthropic)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
  { name: 'GPT-4o (OpenAI)', provider: 'openai-compatible', model: 'gpt-4o' },
  { name: 'OpenAI o3-mini', provider: 'openai-compatible', model: 'o3-mini' },
  { name: 'DeepSeek R1', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },
  { name: 'Mistral Large 2', provider: 'openai-compatible', model: 'mistral-large-latest', baseURL: 'https://api.mistral.ai/v1' },
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
    const choices = options.map((opt, idx) => ({
      name: opt.name,
      value: String(idx),
    }));
    choices.push({
      name: 'Custom model...',
      value: 'custom',
    });

    const selectedIdx = await select({
      message: `Select model for ${roleTitle}:`,
      choices,
    });

    if (selectedIdx === 'custom') {
      const providerChoice = await select({
        message: `Provider for ${roleTitle}:`,
        choices: [
          { name: 'Anthropic', value: 'anthropic' },
          { name: 'Google', value: 'google' },
          { name: 'OpenAI-compatible (DeepSeek, Groq, OpenAI, Ollama)', value: 'openai-compatible' },
        ],
      });

      const customModel = await input({
        message: `Model name:`,
      });

      let baseURL: string | undefined;
      if (providerChoice === 'openai-compatible') {
        baseURL = await input({
          message: 'Base URL (optional, e.g. https://api.deepseek.com/v1):',
          default: 'https://api.openai.com/v1',
        });
      }

      return {
        provider: providerChoice as ProviderType,
        model: customModel.trim(),
        baseURL: baseURL?.trim() || undefined,
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
          name: `${chalk.bold.yellow('⭐ Recommended Presets')}  ${chalk.gray('(Pre-optimized agent trios: Claude, Balanced, Offline Ollama, DeepSeek...)')}`,
          value: 'recommended',
        },
        {
          name: `${chalk.bold.cyan('🛠️  Custom Configuration')} ${chalk.gray('(Individually configure Architect, Builder, and Auditor)')}`,
          value: 'custom',
        },
      ],
    });

    let architectConfig: RoleConfig;
    let builderConfig: RoleConfig;
    let auditorConfig: RoleConfig;

    if (configMode === 'recommended') {
      const presetChoice = await select({
        message: 'Select Recommended Preset:',
        choices: [
          {
            name: `${chalk.bold.cyan('Claude 5.5 Flagship')}   ${chalk.gray('Architect: Opus 5.5 | Builder: Gemini Flash | Auditor: Sonnet 5.5')}`,
            value: 'flagship',
          },
          {
            name: `${chalk.bold.green('Balanced Duo')}         ${chalk.gray('Architect: Sonnet 5.5 | Builder: Gemini Flash | Auditor: Sonnet 5.5')}`,
            value: 'balanced',
          },
          {
            name: `${chalk.bold.yellow('Local Offline (Ollama)')} ${chalk.gray('Architect: DeepSeek-R1 14B | Builder: Qwen2.5 32B | Auditor: R1 (100% Free)')}`,
            value: 'offline',
          },
          {
            name: `${chalk.bold.magenta('DeepSeek Pure')}       ${chalk.gray('Architect: DeepSeek R1 | Builder: DeepSeek V3 | Auditor: DeepSeek R1')}`,
            value: 'deepseek',
          },
          {
            name: `${chalk.bold.blue('OpenAI Ecosystem')}     ${chalk.gray('Architect: GPT-6 Astra / o3-mini | Builder: GPT-6 Luna | Auditor: Sol')}`,
            value: 'gpt6',
          },
          {
            name: `${chalk.bold.hex('#FF8800')('Groq Ultra Speed')}     ${chalk.gray('Architect: Sonnet 5.5 | Builder: Llama 3.3 70B (Groq) | Auditor: Haiku')}`,
            value: 'fast',
          },
          {
            name: `${chalk.bold.white('Codestral Specialized')} ${chalk.gray('Architect: Sonnet 5.5 | Builder: Codestral (Mistral) | Auditor: Sonnet')}`,
            value: 'codestral',
          },
        ],
      });

      if (presetChoice === 'flagship') {
        architectConfig = { provider: 'anthropic', model: 'claude-opus-5-5' };
        builderConfig = { provider: 'google', model: 'gemini-2.0-flash' };
        auditorConfig = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
      } else if (presetChoice === 'gpt6') {
        architectConfig = { provider: 'openai-compatible', model: 'gpt-6-astra' };
        builderConfig = { provider: 'openai-compatible', model: 'gpt-6-luna' };
        auditorConfig = { provider: 'openai-compatible', model: 'gpt-6.1-sol' };
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
      } else if (presetChoice === 'deepseek') {
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

    if (architectConfig.provider === 'anthropic' || auditorConfig.provider === 'anthropic') {
      const hasEnv = !!process.env.ANTHROPIC_API_KEY;
      if (hasEnv) {
        architectConfig.apiKey = process.env.ANTHROPIC_API_KEY;
        if (auditorConfig.provider === 'anthropic') auditorConfig.apiKey = process.env.ANTHROPIC_API_KEY;
        console.log(chalk.green(`+ Found $ANTHROPIC_API_KEY in environment (${maskKey(process.env.ANTHROPIC_API_KEY!)})`));
      } else {
        const key = await password({
          message: `Anthropic API Key ${chalk.dim('[Paste sk-ant-... or press Enter to set later]')}:`,
          mask: '*',
        });
        if (key.trim()) {
          architectConfig.apiKey = key.trim();
          if (auditorConfig.provider === 'anthropic') auditorConfig.apiKey = key.trim();
          console.log(chalk.green(`+ Anthropic Key received (${maskKey(key.trim())})`));
        } else {
          console.log(chalk.yellow('⚠️ Notice: Claude models require an Anthropic API key to run.'));
        }
      }
    }

    if (builderConfig.provider === 'google') {
      const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (envKey) {
        builderConfig.apiKey = envKey;
        console.log(chalk.green(`+ Found $GEMINI_API_KEY in environment (${maskKey(envKey)})`));
      } else {
        const key = await password({
          message: `Google Gemini API Key ${chalk.dim('[Paste AIzaSy... or press Enter to set later]')}:`,
          mask: '*',
        });
        if (key.trim()) {
          builderConfig.apiKey = key.trim();
          console.log(chalk.green(`+ Google Gemini Key received (${maskKey(key.trim())})`));
        } else {
          console.log(chalk.yellow('⚠️ Notice: Gemini Flash requires a Google API key to run.'));
        }
      }
    }

    if (
      architectConfig.provider === 'openai-compatible' ||
      builderConfig.provider === 'openai-compatible' ||
      auditorConfig.provider === 'openai-compatible'
    ) {
      const isLocal =
        architectConfig.baseURL?.includes('localhost') ||
        builderConfig.baseURL?.includes('localhost') ||
        auditorConfig.baseURL?.includes('localhost') ||
        architectConfig.baseURL?.includes('127.0.0.1');

      if (isLocal) {
        if (architectConfig.provider === 'openai-compatible') architectConfig.apiKey = 'not-needed-for-local';
        if (builderConfig.provider === 'openai-compatible') builderConfig.apiKey = 'not-needed-for-local';
        if (auditorConfig.provider === 'openai-compatible') auditorConfig.apiKey = 'not-needed-for-local';
        console.log(chalk.green('+ Local LLM endpoint detected (Ollama) - No API key needed.'));
      } else {
        const envKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GROQ_API_KEY;
        if (envKey) {
          if (architectConfig.provider === 'openai-compatible') architectConfig.apiKey = envKey;
          if (builderConfig.provider === 'openai-compatible') builderConfig.apiKey = envKey;
          if (auditorConfig.provider === 'openai-compatible') auditorConfig.apiKey = envKey;
          console.log(chalk.green(`+ Found API key in environment (${maskKey(envKey)})`));
        } else {
          const key = await password({
            message: `API Key for ${architectConfig.model || builderConfig.model} ${chalk.dim('[Paste sk-... or press Enter to set later]')}:`,
            mask: '*',
          });
          if (key.trim()) {
            if (architectConfig.provider === 'openai-compatible') architectConfig.apiKey = key.trim();
            if (builderConfig.provider === 'openai-compatible') builderConfig.apiKey = key.trim();
            if (auditorConfig.provider === 'openai-compatible') auditorConfig.apiKey = key.trim();
            console.log(chalk.green(`+ API Key received (${maskKey(key.trim())})`));
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
          name: `${chalk.bold.yellow('⭐ Recommended Presets')}  ${chalk.gray('(Switch all roles to a curated preset: Claude, Balanced, Local Ollama, DeepSeek...)')}`,
          value: 'preset',
        },
        {
          name: `${chalk.bold.cyan('🛠️  Custom Role Setup')}    ${chalk.gray('(Customize Architect, Builder, or Auditor individually)')}`,
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
      console.log(chalk.green(`+ Local Ollama model selected - No API key required.`));
    } else {
      const currentKey = config.roles[targetRole]?.apiKey;
      const keyHint = currentKey
        ? chalk.dim('[Enter to keep current]')
        : chalk.dim('[Paste key or Enter if set in env]');

      const apiKey = await password({
        message: `API Key for ${targetRole} ${keyHint}:`,
        mask: '*',
      });
      if (apiKey.trim()) {
        newRoleConfig.apiKey = apiKey.trim();
        console.log(chalk.green(`+ ${targetRole} API Key updated (${maskKey(apiKey.trim())})`));
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
