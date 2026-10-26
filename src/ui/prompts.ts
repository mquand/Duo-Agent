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
  { name: 'Claude Opus 5.5 (Anthropic - Flagship Deep Reasoning)', provider: 'anthropic', model: 'claude-opus-5-5' },
  { name: 'Claude Sonnet 5.5 (Anthropic - Flagship Architecture & Hybrid)', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Claude 3.7 Sonnet (Anthropic - Hybrid Reasoning & Planning)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
  { name: 'Claude 3.5 Sonnet (Anthropic - High capability)', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },

  // OpenAI
  { name: 'OpenAI o3-mini (High-speed reasoning)', provider: 'openai-compatible', model: 'o3-mini', baseURL: 'https://api.openai.com/v1' },
  { name: 'OpenAI o1 (Full deep reasoning)', provider: 'openai-compatible', model: 'o1', baseURL: 'https://api.openai.com/v1' },
  { name: 'GPT-4o (OpenAI flagship)', provider: 'openai-compatible', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },

  // Google
  { name: 'Gemini 3.8 Pro (Google - Advanced Planning & Code)', provider: 'google', model: 'gemini-3.8-pro' },
  { name: 'Gemini 3.6 Flash (Google - Ultra-fast Planning)', provider: 'google', model: 'gemini-3.6-flash' },
  { name: 'Gemini 2.0 Flash (Google)', provider: 'google', model: 'gemini-2.0-flash' },
  { name: 'Gemini 1.5 Pro (Google)', provider: 'google', model: 'gemini-1.5-pro' },

  // DeepSeek Official
  { name: 'DeepSeek R1 Reasoner (DeepSeek official API)', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },
  { name: 'DeepSeek V3 Chat (DeepSeek official API)', provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },

  // OpenRouter Unified API
  { name: 'OpenRouter: Claude 3.7 Sonnet', provider: 'openai-compatible', model: 'anthropic/claude-3.7-sonnet', baseURL: 'https://openrouter.ai/api/v1' },
  { name: 'OpenRouter: DeepSeek R1', provider: 'openai-compatible', model: 'deepseek/deepseek-r1', baseURL: 'https://openrouter.ai/api/v1' },

  // Groq & Mistral
  { name: 'Groq: Llama 3.3 70B Versatile', provider: 'openai-compatible', model: 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' },
  { name: 'Mistral Large 2', provider: 'openai-compatible', model: 'mistral-large-latest', baseURL: 'https://api.mistral.ai/v1' },

  // Local Ollama
  { name: 'Ollama: DeepSeek-R1 14B (Local - Free)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: DeepSeek-R1 32B (Local - Free)', provider: 'openai-compatible', model: 'deepseek-r1:32b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: Qwen 2.5 Coder 32B (Local - Free)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
];

const POPULAR_BUILDER_MODELS: ModelOption[] = [
  // Google
  { name: 'Gemini 3.6 Flash (Google - Ultra-fast & Free)', provider: 'google', model: 'gemini-3.6-flash' },
  { name: 'Gemini 3.8 Flash (Google - High speed coding)', provider: 'google', model: 'gemini-3.8-flash' },
  { name: 'Gemini 2.0 Flash (Google)', provider: 'google', model: 'gemini-2.0-flash' },

  // Anthropic
  { name: 'Claude Sonnet 5.5 (Anthropic - Flagship Code Execution)', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Claude 3.5 Haiku (Anthropic ultra-fast & cheap)', provider: 'anthropic', model: 'claude-3-5-haiku-latest' },
  { name: 'Claude 3.7 Sonnet (Anthropic thinking code)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },

  // OpenAI
  { name: 'GPT-4o-mini (OpenAI fast/cheap)', provider: 'openai-compatible', model: 'gpt-4o-mini', baseURL: 'https://api.openai.com/v1' },
  { name: 'GPT-4o (OpenAI high capability)', provider: 'openai-compatible', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
  { name: 'OpenAI o3-mini (Coding reasoning)', provider: 'openai-compatible', model: 'o3-mini', baseURL: 'https://api.openai.com/v1' },

  // Mistral & DeepSeek
  { name: 'Mistral Codestral (Specialized code)', provider: 'openai-compatible', model: 'codestral-latest', baseURL: 'https://api.mistral.ai/v1' },
  { name: 'DeepSeek V3 Chat (DeepSeek API fast coding)', provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
  { name: 'DeepSeek R1 Reasoner (DeepSeek API reasoning)', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },

  // Groq & OpenRouter
  { name: 'Groq: Llama 3.3 70B (Ultra-fast)', provider: 'openai-compatible', model: 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' },
  { name: 'OpenRouter: Qwen 2.5 Coder 32B', provider: 'openai-compatible', model: 'qwen/qwen-2.5-coder-32b-instruct', baseURL: 'https://openrouter.ai/api/v1' },

  // Local Ollama
  { name: 'Ollama: Qwen 2.5 Coder 32B (Local - Free)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: Qwen 2.5 Coder 14B (Local - Free)', provider: 'openai-compatible', model: 'qwen2.5-coder:14b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: DeepSeek-R1 14B (Local - Free)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
];

const POPULAR_AUDITOR_MODELS: ModelOption[] = [
  // Anthropic
  { name: 'Claude Opus 5.5 (Anthropic - Thorough Deep Audit)', provider: 'anthropic', model: 'claude-opus-5-5' },
  { name: 'Claude Sonnet 5.5 (Anthropic - Flagship Review & Polish)', provider: 'anthropic', model: 'claude-sonnet-5-5' },
  { name: 'Claude 3.7 Sonnet (Anthropic - Thorough review)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
  { name: 'Claude 3.5 Sonnet (Anthropic - Standard audit)', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
  { name: 'Claude 3 Opus (Anthropic deep security audit)', provider: 'anthropic', model: 'claude-3-opus-20240229' },

  // OpenAI
  { name: 'GPT-4o (OpenAI flagship review)', provider: 'openai-compatible', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
  { name: 'OpenAI o3-mini (Deep verification reasoning)', provider: 'openai-compatible', model: 'o3-mini', baseURL: 'https://api.openai.com/v1' },
  { name: 'OpenAI o1 (Full reasoning verification)', provider: 'openai-compatible', model: 'o1', baseURL: 'https://api.openai.com/v1' },

  // Google
  { name: 'Gemini 2.0 Flash (Google fast review)', provider: 'google', model: 'gemini-2.0-flash' },
  { name: 'Gemini 2.0 Pro Experimental (Google deep audit)', provider: 'google', model: 'gemini-2.0-pro-exp-02-05' },

  // DeepSeek Official
  { name: 'DeepSeek R1 Reasoner (Deep review reasoning)', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },
  { name: 'DeepSeek V3 Chat (DeepSeek API fast review)', provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },

  // Local Ollama
  { name: 'Ollama: DeepSeek-R1 14B (Local - Free)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
  { name: 'Ollama: Qwen 2.5 Coder 32B (Local - Free)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
];

export class SecurityPrompts {
  static isDangerous(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }

  static async promptCommandApproval(command: string, autoAccept: boolean = false, isEn: boolean = false): Promise<boolean> {
    const isDanger = this.isDangerous(command);

    if (isDanger) {
      console.log(chalk.red.bold(isEn ? '\n[WARNING] Potentially destructive command:' : '\n[CẢNH BÁO] Lệnh có nguy cơ phá hủy hệ thống:'));
      console.log(chalk.red(`  ${command}\n`));
      return await confirm({
        message: isEn ? 'Execute this command?' : 'Bạn có chắc chắn muốn chạy lệnh này không?',
        default: false,
      });
    }

    if (autoAccept) return true;

    return await confirm({
      message: isEn ? `Execute: ${chalk.cyan(command)}?` : `Chạy lệnh: ${chalk.cyan(command)}?`,
      default: true,
    });
  }

  static async promptPlanApproval(plan: Plan, isEn: boolean = false): Promise<'execute' | 'abort'> {
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.white.bold(isEn ? 'Architect Plan' : 'Kế Hoạch Của Architect'));
    console.log(chalk.gray(isEn ? 'Goal:    ' : 'Mục tiêu: ') + chalk.white(plan.goal));
    console.log(chalk.gray(isEn ? 'Summary: ' : 'Tóm tắt:  ') + chalk.gray(plan.summary));
    console.log(chalk.gray('─'.repeat(60)));

    for (const step of plan.dag) {
      const depInfo = step.depends_on.length > 0
        ? chalk.gray(isEn ? ` (depends on ${step.depends_on.join(', ')})` : ` (phụ thuộc vào ${step.depends_on.join(', ')})`)
        : chalk.gray(isEn ? ' (parallel)' : ' (song song)');
      console.log(chalk.cyan(`\n[${step.id}] `) + chalk.white(step.title) + depInfo);
      console.log(chalk.gray(isEn ? '  Files: ' : '  Tập tin: ') + chalk.gray(step.target_files.join(', ')));
      console.log(chalk.gray(isEn ? '  Task:  ' : '  Nhiệm vụ: ') + chalk.gray(step.instructions));
      if (step.verification_cmd) {
        console.log(chalk.gray(isEn ? '  Test:  ' : '  Lệnh test: ') + chalk.gray(step.verification_cmd));
      }
    }
    console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));

    const answer = await select({
      message: isEn ? 'Plan action:' : 'Hành động với kế hoạch:',
      choices: [
        { name: isEn ? 'Execute plan' : 'Thực thi kế hoạch', value: 'execute' },
        { name: isEn ? 'Abort' : 'Hủy bỏ (Abort)', value: 'abort' },
      ],
    });

    return answer as 'execute' | 'abort';
  }

  private static async selectOrCustomModel(
    roleTitle: string,
    options: ModelOption[],
    isEn: boolean = false
  ): Promise<RoleConfig | null> {
    const choices = [
      {
        name: isEn
          ? `${chalk.bold.cyan('Enter Custom Model / Endpoint')} ${chalk.gray('(Any model: Ollama, OpenRouter, vLLM, DeepSeek...)')}`
          : `${chalk.bold.cyan('Nhập Model / Endpoint Tự Chọn')} ${chalk.gray('(Mọi model: Ollama, OpenRouter, vLLM, DeepSeek...)')}`,
        value: 'custom',
      },
      ...options.map((opt, idx) => ({
        name: opt.name,
        value: String(idx),
      })),
      {
        name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại',
        value: 'back',
      },
    ];

    const selectedIdx = await select({
      message: isEn ? `Select model for ${roleTitle}:` : `Chọn mô hình cho ${roleTitle}:`,
      choices,
    });

    if (selectedIdx === 'back') return null;

    if (selectedIdx === 'custom') {
      const customType = await select({
        message: isEn ? `Provider / Platform for ${roleTitle}:` : `Nền tảng / Nhà cung cấp cho ${roleTitle}:`,
        choices: [
          {
            name: `${chalk.bold.yellow('Local Ollama')}              ${chalk.gray(isEn ? 'Run local model offline (100% Free, 0đ API)' : 'Chạy offline trên máy (Miễn phí 100%, 0đ API)')}`,
            value: 'ollama',
          },
          {
            name: `${chalk.bold.cyan('Anthropic Claude')}             ${chalk.gray('Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku')}`,
            value: 'anthropic',
          },
          {
            name: `${chalk.bold.red('Google Gemini')}                ${chalk.gray('Gemini 2.0 Flash, Gemini 2.0 Pro')}`,
            value: 'google',
          },
          {
            name: `${chalk.bold.green('OpenAI Official')}              ${chalk.gray('o3-mini, o1, GPT-4o, GPT-4o-mini')}`,
            value: 'openai',
          },
          {
            name: `${chalk.bold.blue('DeepSeek Official')}            ${chalk.gray('deepseek-reasoner (R1), deepseek-chat (V3)')}`,
            value: 'deepseek',
          },
          {
            name: `${chalk.bold.hex('#FF8800')('OpenRouter')}                ${chalk.gray('300+ models with unified API (anthropic/claude-3.7-sonnet...)')}`,
            value: 'openrouter',
          },
          {
            name: `${chalk.bold.magenta('Groq Cloud')}                   ${chalk.gray('Ultra-fast inference (llama-3.3-70b-versatile)')}`,
            value: 'groq',
          },
          {
            name: `${chalk.bold.white('Local vLLM / LM Studio')}       ${chalk.gray('Local OpenAI-compatible server at custom port')}`,
            value: 'local_server',
          },
          {
            name: `${chalk.bold.gray('Custom OpenAI-Compatible')}     ${chalk.gray(isEn ? 'Any custom Base URL & model name' : 'Tùy chỉnh Base URL & tên model bất kỳ')}`,
            value: 'custom_url',
          },
          {
            name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại',
            value: 'back',
          },
        ],
      });

      if (customType === 'back') return null;

      if (customType === 'ollama') {
        const modelName = await input({
          message: isEn ? `Ollama model name (e.g. qwen2.5-coder:32b, deepseek-r1:14b):` : `Tên model Ollama (vd: qwen2.5-coder:32b, deepseek-r1:14b):`,
          default: roleTitle.toLowerCase().includes('build') ? 'qwen2.5-coder:32b' : 'deepseek-r1:14b',
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
          message: isEn ? `OpenRouter model identifier (e.g. anthropic/claude-3.7-sonnet):` : `Định danh model OpenRouter (vd: anthropic/claude-3.7-sonnet):`,
          default: roleTitle.toLowerCase().includes('build') ? 'qwen/qwen-2.5-coder-32b-instruct' : 'anthropic/claude-3.7-sonnet',
        });
        return {
          provider: 'openai-compatible',
          model: modelName.trim(),
          baseURL: 'https://openrouter.ai/api/v1',
        };
      }

      if (customType === 'deepseek') {
        const modelName = await select({
          message: isEn ? `DeepSeek model:` : `Chọn model DeepSeek:`,
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
          message: isEn ? `Groq model identifier:` : `Tên model Groq:`,
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
          message: isEn ? `Anthropic model name:` : `Tên model Anthropic:`,
          default: roleTitle.toLowerCase().includes('build') ? 'claude-3-5-haiku-latest' : 'claude-3-7-sonnet-20250219',
        });
        return {
          provider: 'anthropic',
          model: modelName.trim(),
        };
      }

      if (customType === 'google') {
        const modelName = await input({
          message: isEn ? `Google Gemini model name:` : `Tên model Google Gemini:`,
          default: 'gemini-2.0-flash',
        });
        return {
          provider: 'google',
          model: modelName.trim(),
        };
      }

      if (customType === 'openai') {
        const modelName = await input({
          message: isEn ? `OpenAI model name:` : `Tên model OpenAI:`,
          default: roleTitle.toLowerCase().includes('arch') ? 'o3-mini' : 'gpt-4o-mini',
        });
        return {
          provider: 'openai-compatible',
          model: modelName.trim(),
          baseURL: 'https://api.openai.com/v1',
        };
      }

      if (customType === 'local_server') {
        const baseURL = await input({
          message: isEn ? `Local server Base URL:` : `Base URL của server local:`,
          default: 'http://localhost:1234/v1',
        });
        const modelName = await input({
          message: isEn ? `Model name on local server:` : `Tên model trên server local:`,
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
        message: isEn ? `Custom OpenAI-compatible Base URL:` : `Base URL tùy chỉnh (OpenAI-compatible):`,
        default: 'https://api.openai.com/v1',
      });
      const modelName = await input({
        message: isEn ? `Model name:` : `Tên model:`,
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

  private static async askApiKeysIfNeeded(
    roles: { architect: RoleConfig; builder: RoleConfig; auditor: RoleConfig },
    isEn: boolean = false
  ): Promise<void> {
    console.log(chalk.gray(isEn ? '\nAPI Keys Configuration:' : '\nCấu hình API Key:'));

    // Anthropic keys
    const anthropicRoles = [roles.architect, roles.builder, roles.auditor].filter((r) => r.provider === 'anthropic');
    if (anthropicRoles.length > 0 && !anthropicRoles[0].apiKey) {
      const hasEnv = !!process.env.ANTHROPIC_API_KEY;
      if (hasEnv) {
        for (const r of anthropicRoles) r.apiKey = process.env.ANTHROPIC_API_KEY;
        console.log(chalk.green(`+ ${isEn ? 'Found' : 'Tìm thấy'} $ANTHROPIC_API_KEY ${isEn ? 'in environment' : 'trong môi trường'} (${maskKey(process.env.ANTHROPIC_API_KEY!)})`));
      } else {
        const key = await password({
          message: isEn
            ? `Anthropic API Key ${chalk.dim('[Paste sk-ant-... or press Enter to set later]')}:`
            : `Anthropic API Key ${chalk.dim('[Dán sk-ant-... hoặc Enter để bổ sung sau]')}:`,
          mask: '*',
        });
        if (key.trim()) {
          for (const r of anthropicRoles) r.apiKey = key.trim();
          console.log(chalk.green(`+ ${isEn ? 'Anthropic Key received' : 'Đã nhận Anthropic Key'} (${maskKey(key.trim())})`));
        } else {
          console.log(chalk.yellow(isEn
            ? '[!] Notice: Claude models require an Anthropic API key to run. You can configure later via /key.'
            : '[!] Lưu ý: Mô hình Claude cần có Anthropic API key để thực thi. Bạn có thể bổ sung sau qua lệnh /key.'
          ));
        }
      }
    }

    // Google Gemini keys
    const googleRoles = [roles.architect, roles.builder, roles.auditor].filter((r) => r.provider === 'google');
    if (googleRoles.length > 0 && !googleRoles[0].apiKey) {
      const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (envKey) {
        for (const r of googleRoles) r.apiKey = envKey;
        console.log(chalk.green(`+ ${isEn ? 'Found' : 'Tìm thấy'} $GEMINI_API_KEY ${isEn ? 'in environment' : 'trong môi trường'} (${maskKey(envKey)})`));
      } else {
        const key = await password({
          message: isEn
            ? `Google Gemini API Key ${chalk.dim('[Paste AIzaSy... or press Enter to set later]')}:`
            : `Google Gemini API Key ${chalk.dim('[Dán AIzaSy... hoặc Enter để bổ sung sau]')}:`,
          mask: '*',
        });
        if (key.trim()) {
          for (const r of googleRoles) r.apiKey = key.trim();
          console.log(chalk.green(`+ ${isEn ? 'Google Gemini Key received' : 'Đã nhận Google Gemini Key'} (${maskKey(key.trim())})`));
        } else {
          console.log(chalk.yellow(isEn
            ? '[!] Notice: Gemini models require a Google API key to run. You can configure later via /key.'
            : '[!] Lưu ý: Mô hình Gemini cần có Google API key để thực thi. Bạn có thể bổ sung sau qua lệnh /key.'
          ));
        }
      }
    }

    // OpenAI-compatible keys
    const openAIRoles = [roles.architect, roles.builder, roles.auditor].filter((r) => r.provider === 'openai-compatible');
    if (openAIRoles.length > 0) {
      const allLocal = openAIRoles.every((r) =>
        r.baseURL?.includes('localhost') || r.baseURL?.includes('127.0.0.1')
      );

      if (allLocal) {
        for (const r of openAIRoles) r.apiKey = 'not-needed-for-local';
        console.log(chalk.green(isEn
          ? '+ Local LLM endpoint detected (Ollama) - No API key needed.'
          : '+ Đã nhận diện mô hình Local (Ollama) - Không cần API Key (Miễn phí 100%).'
        ));
      } else if (!openAIRoles.some((r) => r.apiKey)) {
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
          console.log(chalk.green(`+ ${isEn ? 'Found' : 'Tìm thấy'} $${keyName.toUpperCase()}_API_KEY ${isEn ? 'in environment' : 'trong môi trường'} (${maskKey(envVar)})`));
        } else {
          const key = await password({
            message: isEn
              ? `${keyName} API Key ${chalk.dim('[Paste sk-... or press Enter to set later]')}:`
              : `${keyName} API Key ${chalk.dim('[Dán sk-... hoặc Enter để bổ sung sau]')}:`,
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
            console.log(chalk.green(`+ ${isEn ? `${keyName} API Key received` : `Đã nhận ${keyName} API Key`} (${maskKey(key.trim())})`));
          } else {
            console.log(chalk.yellow(isEn
              ? `[!] Notice: ${keyName} models require an API key to run. You can configure later via /key.`
              : `[!] Lưu ý: Mô hình ${keyName} cần có API key để thực thi. Bạn có thể bổ sung sau qua lệnh /key.`
            ));
          }
        }
      }
    }
  }

  static async promptSelectPreset(
    isEn: boolean = false
  ): Promise<{ roles: { architect: RoleConfig; builder: RoleConfig; auditor: RoleConfig } } | null> {
    const presetChoice = await select({
      message: isEn ? 'Select Recommended Preset:' : 'Chọn Cấu Hình Mẫu Đề Xuất:',
      choices: [
        {
          name: `${chalk.bold.yellow('Local Offline (100% Ollama)')}   ${chalk.gray('Arch: DeepSeek-R1 14B | Build: Qwen2.5 32B | Audit: R1 (100% Free, 0đ API)')}`,
          value: 'offline',
        },
        {
          name: `${chalk.bold.hex('#9333EA')('Pure Claude (100% Anthropic)')}  ${chalk.gray('Arch: Sonnet 3.7 | Build: Haiku 3.5 | Audit: Sonnet 3.7 (Only 1 Anthropic key!)')}`,
          value: 'claude_pure',
        },
        {
          name: `${chalk.bold.green('Pure OpenAI (100% OpenAI)')}     ${chalk.gray('Arch: o3-mini | Build: GPT-4o-mini | Audit: GPT-4o (Only 1 OpenAI key!)')}`,
          value: 'openai_pure',
        },
        {
          name: `${chalk.bold.blue('Pure Gemini (100% Google)')}     ${chalk.gray('Arch: Gemini 2.0 Pro | Build: Flash | Audit: Flash (Only 1 Google key!)')}`,
          value: 'gemini_pure',
        },
        {
          name: `${chalk.bold.magenta('Pure DeepSeek (100% DeepSeek)')} ${chalk.gray('Arch: DeepSeek R1 | Build: DeepSeek V3 | Audit: R1 (Only 1 DeepSeek key!)')}`,
          value: 'deepseek_pure',
        },
        {
          name: `${chalk.bold.cyan('Claude + Gemini Hybrid')}        ${chalk.gray('Arch: Sonnet 3.7 | Build: Gemini 2.0 Flash | Audit: Sonnet 3.7 (Power + Speed)')}`,
          value: 'hybrid',
        },
        {
          name: `${chalk.bold.hex('#FF8800')('Groq Ultra Speed (Hybrid)')}   ${chalk.gray('Arch: Sonnet 3.7 | Build: Llama 3.3 70B (Groq) | Audit: Haiku 3.5')}`,
          value: 'fast',
        },
        {
          name: `${chalk.bold.gray('Mistral Codestral (Hybrid)')}     ${chalk.gray('Arch: Sonnet 3.7 | Build: Codestral (Mistral) | Audit: Sonnet 3.7')}`,
          value: 'codestral',
        },
        {
          name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại',
          value: 'back',
        },
      ],
    });

    if (presetChoice === 'back') return null;

    let architectConfig: RoleConfig;
    let builderConfig: RoleConfig;
    let auditorConfig: RoleConfig;

    if (presetChoice === 'offline') {
      console.log(chalk.green(isEn ? '\n+ Configured for Local Offline (Ollama) - No API keys required!\n' : '\n+ Đã chọn Local Offline (Ollama) - Không cần API key (Hoàn toàn miễn phí)!\n'));
      return {
        roles: {
          architect: {
            provider: 'openai-compatible',
            model: 'deepseek-r1:14b',
            baseURL: 'http://localhost:11434/v1',
            apiKey: 'not-needed-for-local',
            reasoningEffort: 'medium',
          },
          builder: {
            provider: 'openai-compatible',
            model: 'qwen2.5-coder:32b',
            baseURL: 'http://localhost:11434/v1',
            apiKey: 'not-needed-for-local',
            reasoningEffort: 'off',
          },
          auditor: {
            provider: 'openai-compatible',
            model: 'deepseek-r1:14b',
            baseURL: 'http://localhost:11434/v1',
            apiKey: 'not-needed-for-local',
            reasoningEffort: 'medium',
          },
        },
      };
    }

    if (presetChoice === 'claude_pure') {
      architectConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
      builderConfig = { provider: 'anthropic', model: 'claude-3-5-haiku-latest', reasoningEffort: 'off' };
      auditorConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
    } else if (presetChoice === 'openai_pure') {
      architectConfig = { provider: 'openai-compatible', model: 'o3-mini', baseURL: 'https://api.openai.com/v1', reasoningEffort: 'medium' };
      builderConfig = { provider: 'openai-compatible', model: 'gpt-4o-mini', baseURL: 'https://api.openai.com/v1', reasoningEffort: 'off' };
      auditorConfig = { provider: 'openai-compatible', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1', reasoningEffort: 'medium' };
    } else if (presetChoice === 'gemini_pure') {
      architectConfig = { provider: 'google', model: 'gemini-2.0-pro-exp-02-05', reasoningEffort: 'medium' };
      builderConfig = { provider: 'google', model: 'gemini-2.0-flash', reasoningEffort: 'off' };
      auditorConfig = { provider: 'google', model: 'gemini-2.0-flash', reasoningEffort: 'off' };
    } else if (presetChoice === 'deepseek_pure') {
      architectConfig = {
        provider: 'openai-compatible',
        model: 'deepseek-reasoner',
        baseURL: 'https://api.deepseek.com/v1',
        reasoningEffort: 'medium',
      };
      builderConfig = {
        provider: 'openai-compatible',
        model: 'deepseek-chat',
        baseURL: 'https://api.deepseek.com/v1',
        reasoningEffort: 'off',
      };
      auditorConfig = {
        provider: 'openai-compatible',
        model: 'deepseek-reasoner',
        baseURL: 'https://api.deepseek.com/v1',
        reasoningEffort: 'medium',
      };
    } else if (presetChoice === 'hybrid') {
      architectConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
      builderConfig = { provider: 'google', model: 'gemini-2.0-flash', reasoningEffort: 'off' };
      auditorConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
    } else if (presetChoice === 'codestral') {
      architectConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
      builderConfig = {
        provider: 'openai-compatible',
        model: 'codestral-latest',
        baseURL: 'https://api.mistral.ai/v1',
        reasoningEffort: 'off',
      };
      auditorConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
    } else {
      // fast
      architectConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
      builderConfig = {
        provider: 'openai-compatible',
        model: 'llama-3.3-70b-versatile',
        baseURL: 'https://api.groq.com/openai/v1',
        reasoningEffort: 'off',
      };
      auditorConfig = { provider: 'anthropic', model: 'claude-3-5-haiku-latest', reasoningEffort: 'off' };
    }

    const roleBundle = {
      architect: architectConfig,
      builder: builderConfig,
      auditor: auditorConfig,
    };

    await this.askApiKeysIfNeeded(roleBundle, isEn);
    return { roles: roleBundle };
  }

  static async promptConfigureEcosystem(
    isEn: boolean = false
  ): Promise<{ roles: { architect: RoleConfig; builder: RoleConfig; auditor: RoleConfig } } | null> {
    console.log(chalk.cyan(isEn ? '\nConfigure by Single Provider / Ecosystem:' : '\nCấu hình theo một Hệ Sinh Thái AI:'));
    console.log(chalk.gray(isEn
      ? 'Tier models within 1 ecosystem (Plan with top model, Build with fast model, Audit with review model) using 1 key!\n'
      : 'Phân tầng trong 1 hệ sinh thái (Lập kế hoạch với model mạnh, Code với model nhanh, Audit để review) chỉ với 1 API Key!\n'
    ));

    const providerType = await select({
      message: isEn ? 'Select AI Ecosystem:' : 'Chọn Hệ Sinh Thái AI:',
      choices: [
        {
          name: `${chalk.bold.hex('#9333EA')('Anthropic Claude')}     ${chalk.gray('(Claude 3.7 Sonnet + Claude 3.5 Haiku + Sonnet 3.7)')}`,
          value: 'anthropic',
        },
        {
          name: `${chalk.bold.green('OpenAI')}               ${chalk.gray('(o3-mini + GPT-4o-mini + GPT-4o)')}`,
          value: 'openai',
        },
        {
          name: `${chalk.bold.blue('Google Gemini')}         ${chalk.gray('(Gemini 2.0 Pro + Gemini 2.0 Flash + Flash)')}`,
          value: 'google',
        },
        {
          name: `${chalk.bold.magenta('DeepSeek')}              ${chalk.gray('(DeepSeek R1 + DeepSeek V3 Chat + R1)')}`,
          value: 'deepseek',
        },
        {
          name: `${chalk.bold.yellow('Local Ollama')}          ${chalk.gray('(DeepSeek-R1 14B + Qwen 2.5 Coder 32B - 100% Free)')}`,
          value: 'ollama',
        },
        {
          name: `${chalk.bold.hex('#FF8800')('OpenRouter')}            ${chalk.gray('(Access 300+ models with 1 unified key)')}`,
          value: 'openrouter',
        },
        {
          name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại',
          value: 'back',
        },
      ],
    });

    if (providerType === 'back') return null;

    let smartArch: RoleConfig;
    let smartBuild: RoleConfig;
    let smartAudit: RoleConfig;
    let architectOptions: ModelOption[] = [];
    let builderOptions: ModelOption[] = [];
    let auditorOptions: ModelOption[] = [];

    if (providerType === 'anthropic') {
      smartArch = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
      smartBuild = { provider: 'anthropic', model: 'claude-3-5-haiku-latest', reasoningEffort: 'off' };
      smartAudit = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', reasoningEffort: 'medium' };
      architectOptions = [
        { name: 'Claude 3.7 Sonnet (Hybrid thinking & planning)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
        { name: 'Claude 3.5 Sonnet (High capability)', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
        { name: 'Claude 3 Opus (Deep reasoning flagship)', provider: 'anthropic', model: 'claude-3-opus-20240229' },
      ];
      builderOptions = [
        { name: 'Claude 3.5 Haiku (Ultra-fast & cheap)', provider: 'anthropic', model: 'claude-3-5-haiku-latest' },
        { name: 'Claude 3.5 Sonnet (High capability coding)', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
        { name: 'Claude 3.7 Sonnet (Hybrid coding)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
      ];
      auditorOptions = [
        { name: 'Claude 3.7 Sonnet (Thorough verification)', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' },
        { name: 'Claude 3.5 Sonnet (Standard review)', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
        { name: 'Claude 3 Opus (Deep security review)', provider: 'anthropic', model: 'claude-3-opus-20240229' },
      ];
    } else if (providerType === 'openai') {
      smartArch = { provider: 'openai-compatible', model: 'o3-mini', baseURL: 'https://api.openai.com/v1', reasoningEffort: 'medium' };
      smartBuild = { provider: 'openai-compatible', model: 'gpt-4o-mini', baseURL: 'https://api.openai.com/v1', reasoningEffort: 'off' };
      smartAudit = { provider: 'openai-compatible', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1', reasoningEffort: 'medium' };
      architectOptions = [
        { name: 'OpenAI o3-mini (High-speed reasoning)', provider: 'openai-compatible', model: 'o3-mini', baseURL: 'https://api.openai.com/v1' },
        { name: 'OpenAI o1 (Full extended reasoning)', provider: 'openai-compatible', model: 'o1', baseURL: 'https://api.openai.com/v1' },
        { name: 'GPT-4o (OpenAI flagship)', provider: 'openai-compatible', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
      ];
      builderOptions = [
        { name: 'GPT-4o-mini (Ultra-fast, lowest cost)', provider: 'openai-compatible', model: 'gpt-4o-mini', baseURL: 'https://api.openai.com/v1' },
        { name: 'OpenAI o3-mini (Reasoning coding)', provider: 'openai-compatible', model: 'o3-mini', baseURL: 'https://api.openai.com/v1' },
        { name: 'GPT-4o (High capability coding)', provider: 'openai-compatible', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
      ];
      auditorOptions = [
        { name: 'GPT-4o (Standard audit & review)', provider: 'openai-compatible', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
        { name: 'OpenAI o3-mini (Deep verification)', provider: 'openai-compatible', model: 'o3-mini', baseURL: 'https://api.openai.com/v1' },
      ];
    } else if (providerType === 'google') {
      smartArch = { provider: 'google', model: 'gemini-2.0-pro-exp-02-05', reasoningEffort: 'medium' };
      smartBuild = { provider: 'google', model: 'gemini-2.0-flash', reasoningEffort: 'off' };
      smartAudit = { provider: 'google', model: 'gemini-2.0-flash', reasoningEffort: 'off' };
      architectOptions = [
        { name: 'Gemini 2.0 Pro Experimental (Complex reasoning)', provider: 'google', model: 'gemini-2.0-pro-exp-02-05' },
        { name: 'Gemini 2.0 Flash (Fast planning)', provider: 'google', model: 'gemini-2.0-flash' },
        { name: 'Gemini 1.5 Pro', provider: 'google', model: 'gemini-1.5-pro' },
      ];
      builderOptions = [
        { name: 'Gemini 2.0 Flash (Superfast coding)', provider: 'google', model: 'gemini-2.0-flash' },
        { name: 'Gemini 1.5 Flash', provider: 'google', model: 'gemini-1.5-flash' },
      ];
      auditorOptions = [
        { name: 'Gemini 2.0 Flash (Fast review & polish)', provider: 'google', model: 'gemini-2.0-flash' },
        { name: 'Gemini 2.0 Pro Experimental', provider: 'google', model: 'gemini-2.0-pro-exp-02-05' },
      ];
    } else if (providerType === 'deepseek') {
      smartArch = { provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1', reasoningEffort: 'medium' };
      smartBuild = { provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1', reasoningEffort: 'off' };
      smartAudit = { provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1', reasoningEffort: 'medium' };
      architectOptions = [
        { name: 'DeepSeek R1 Reasoner (Deep thinking)', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },
      ];
      builderOptions = [
        { name: 'DeepSeek V3 Chat (High-speed coding)', provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
        { name: 'DeepSeek R1 Reasoner', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },
      ];
      auditorOptions = [
        { name: 'DeepSeek R1 Reasoner (Deep review)', provider: 'openai-compatible', model: 'deepseek-reasoner', baseURL: 'https://api.deepseek.com/v1' },
        { name: 'DeepSeek V3 Chat', provider: 'openai-compatible', model: 'deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
      ];
    } else if (providerType === 'ollama') {
      smartArch = { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local', reasoningEffort: 'medium' };
      smartBuild = { provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local', reasoningEffort: 'off' };
      smartAudit = { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local', reasoningEffort: 'medium' };
      architectOptions = [
        { name: 'Ollama: DeepSeek-R1 14B (Local)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
        { name: 'Ollama: DeepSeek-R1 32B (Local)', provider: 'openai-compatible', model: 'deepseek-r1:32b', baseURL: 'http://localhost:11434/v1' },
        { name: 'Ollama: Qwen 2.5 Coder 32B (Local)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
      ];
      builderOptions = [
        { name: 'Ollama: Qwen 2.5 Coder 32B (Local)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
        { name: 'Ollama: Qwen 2.5 Coder 14B (Local)', provider: 'openai-compatible', model: 'qwen2.5-coder:14b', baseURL: 'http://localhost:11434/v1' },
        { name: 'Ollama: DeepSeek-R1 14B (Local)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
      ];
      auditorOptions = [
        { name: 'Ollama: DeepSeek-R1 14B (Local)', provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1' },
        { name: 'Ollama: Qwen 2.5 Coder 32B (Local)', provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1' },
      ];
    } else {
      smartArch = { provider: 'openai-compatible', model: 'anthropic/claude-3.7-sonnet', baseURL: 'https://openrouter.ai/api/v1', reasoningEffort: 'medium' };
      smartBuild = { provider: 'openai-compatible', model: 'qwen/qwen-2.5-coder-32b-instruct', baseURL: 'https://openrouter.ai/api/v1', reasoningEffort: 'off' };
      smartAudit = { provider: 'openai-compatible', model: 'anthropic/claude-3.7-sonnet', baseURL: 'https://openrouter.ai/api/v1', reasoningEffort: 'medium' };
      architectOptions = [
        { name: 'OpenRouter: Claude 3.7 Sonnet', provider: 'openai-compatible', model: 'anthropic/claude-3.7-sonnet', baseURL: 'https://openrouter.ai/api/v1' },
        { name: 'OpenRouter: DeepSeek R1', provider: 'openai-compatible', model: 'deepseek/deepseek-r1', baseURL: 'https://openrouter.ai/api/v1' },
      ];
      builderOptions = [
        { name: 'OpenRouter: Qwen 2.5 Coder 32B', provider: 'openai-compatible', model: 'qwen/qwen-2.5-coder-32b-instruct', baseURL: 'https://openrouter.ai/api/v1' },
        { name: 'OpenRouter: DeepSeek V3', provider: 'openai-compatible', model: 'deepseek/deepseek-chat', baseURL: 'https://openrouter.ai/api/v1' },
      ];
      auditorOptions = [
        { name: 'OpenRouter: Claude 3.7 Sonnet', provider: 'openai-compatible', model: 'anthropic/claude-3.7-sonnet', baseURL: 'https://openrouter.ai/api/v1' },
        { name: 'OpenRouter: DeepSeek R1', provider: 'openai-compatible', model: 'deepseek/deepseek-r1', baseURL: 'https://openrouter.ai/api/v1' },
      ];
    }

    console.log(chalk.white.bold(isEn ? `\nRecommended ${providerType.toUpperCase()} Tier:` : `\nCấu hình đề xuất cho ${providerType.toUpperCase()}:`));
    console.log(chalk.gray(`  • Architect: `) + chalk.cyan(smartArch.model) + chalk.gray(` (planning) [effort: ${smartArch.reasoningEffort}]`));
    console.log(chalk.gray(`  • Builder:   `) + chalk.green(smartBuild.model) + chalk.gray(` (fast coding) [effort: ${smartBuild.reasoningEffort}]`));
    console.log(chalk.gray(`  • Auditor:   `) + chalk.magenta(smartAudit.model) + chalk.gray(` (verification) [effort: ${smartAudit.reasoningEffort}]`));

    const tierChoice = await select({
      message: isEn ? 'Setup choice:' : 'Lựa chọn cài đặt:',
      choices: [
        {
          name: isEn
            ? `${chalk.bold.green('Use Recommended Tier (1-click)')} ${chalk.gray('- optimal speed and quality balance')}`
            : `${chalk.bold.green('Dùng Cấu Hình Đề Xuất (1-click)')} ${chalk.gray('- cân bằng tối ưu giữa tốc độ và chất lượng')}`,
          value: 'recommended',
        },
        {
          name: isEn
            ? `${chalk.bold.yellow('Custom Tier')} ${chalk.gray('- manually choose models & reasoning effort')}`
            : `${chalk.bold.yellow('Tự Tinh Chỉnh')} ${chalk.gray('- tự chọn model và reasoning effort cho từng vai trò')}`,
          value: 'custom',
        },
        {
          name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại',
          value: 'back',
        },
      ],
    });

    if (tierChoice === 'back') return null;

    let arch: RoleConfig = { ...smartArch };
    let build: RoleConfig = { ...smartBuild };
    let audit: RoleConfig = { ...smartAudit };

    if (tierChoice === 'custom') {
      // Step 1: Select Architect
      console.log(chalk.cyan(isEn ? `\n1. Select Architect model for planning:` : `\n1. Chọn model cho Architect (lập kế hoạch):`));
      const customArch = await this.selectOrCustomModel('Architect', architectOptions, isEn);
      if (!customArch) return null;
      arch = customArch;

      const archEffort = await select({
        message: isEn ? 'Reasoning effort for Architect:' : 'Mức độ suy luận (Reasoning effort) cho Architect:',
        default: 'medium',
        choices: [
          { name: isEn ? 'Medium (Balanced speed & depth - recommended)' : 'Trung bình (Cân bằng tốc độ & độ sâu - khuyên dùng)', value: 'medium' },
          { name: isEn ? 'High (Maximum reasoning depth & extended thinking)' : 'Cao (Suy luận sâu tối đa, tốn nhiều token)', value: 'high' },
          { name: isEn ? 'Low (Fast execution, minimal thinking tokens)' : 'Thấp (Nhanh, ít token suy luận)', value: 'low' },
          { name: isEn ? 'Off / Default (Standard execution without extended thinking)' : 'Tắt (Chạy tiêu chuẩn không extended thinking)', value: 'off' },
        ],
      });
      arch.reasoningEffort = archEffort as any;

      // Step 2: Select Builder
      console.log(chalk.cyan(isEn ? `\n2. Select Builder model for code execution:` : `\n2. Chọn model cho Builder (thực thi code):`));
      const customBuild = await this.selectOrCustomModel('Builder', builderOptions, isEn);
      if (!customBuild) return null;
      build = customBuild;

      const buildEffort = await select({
        message: isEn ? 'Reasoning effort for Builder:' : 'Mức độ suy luận cho Builder:',
        default: 'off',
        choices: [
          { name: isEn ? 'Off / Default (Fastest code generation - recommended for Builder)' : 'Tắt (Sinh code nhanh nhất - khuyên dùng cho Builder)', value: 'off' },
          { name: isEn ? 'Low (Minimal thinking tokens)' : 'Thấp (Ít token suy luận)', value: 'low' },
          { name: isEn ? 'Medium (Balanced)' : 'Trung bình', value: 'medium' },
        ],
      });
      build.reasoningEffort = buildEffort as any;

      // Step 3: Select Auditor
      console.log(chalk.cyan(isEn ? `\n3. Select Auditor model for review & verification:` : `\n3. Chọn model cho Auditor (review & kiểm thử):`));
      const customAudit = await this.selectOrCustomModel('Auditor', auditorOptions, isEn);
      if (!customAudit) return null;
      audit = customAudit;

      const auditEffort = await select({
        message: isEn ? 'Reasoning effort for Auditor:' : 'Mức độ suy luận cho Auditor:',
        default: 'medium',
        choices: [
          { name: isEn ? 'Medium (Balanced review depth - recommended)' : 'Trung bình (Review cân bằng - khuyên dùng)', value: 'medium' },
          { name: isEn ? 'High (Thorough edge-case inspection)' : 'Cao (Soát kỹ từng edge-case)', value: 'high' },
          { name: isEn ? 'Low (Quick review)' : 'Thấp (Review nhanh)', value: 'low' },
          { name: isEn ? 'Off / Default (Standard verification)' : 'Tắt (Kiểm tra tiêu chuẩn)', value: 'off' },
        ],
      });
      audit.reasoningEffort = auditEffort as any;
    }

    // Step 4: Ask API key ONCE
    const roleBundle = { architect: arch, builder: build, auditor: audit };
    await this.askApiKeysIfNeeded(roleBundle, isEn);

    console.log(chalk.green(isEn ? `\n+ Configured ${providerType.toUpperCase()} Ecosystem:` : `\n+ Đã cấu hình hệ sinh thái ${providerType.toUpperCase()}:`));
    console.log(chalk.gray(`  Architect: ${arch.model} (effort: ${arch.reasoningEffort})`));
    console.log(chalk.gray(`  Builder:   ${build.model} (effort: ${build.reasoningEffort})`));
    console.log(chalk.gray(`  Auditor:   ${audit.model} (effort: ${audit.reasoningEffort})\n`));

    return { roles: roleBundle };
  }

  static async promptOnboarding(existingConfig?: AppConfig): Promise<AppConfig> {
    const isEn = (existingConfig?.language ?? 'vi') === 'en';
    console.log(chalk.white.bold(isEn ? '\nDuo Setup\n' : '\nThiết Lập Duo Agent\n'));

    const configMode = await select({
      message: isEn ? 'Configuration mode:' : 'Chế độ cấu hình:',
      choices: [
        {
          name: `${chalk.bold.yellow('Recommended Presets')}        ${chalk.gray(isEn ? '(Pre-packaged setups: Pure Claude, Pure OpenAI, Offline...)' : '(Gói cài đặt sẵn: Pure Claude, Pure OpenAI, Offline...)')}`,
          value: 'recommended',
        },
        {
          name: `${chalk.bold.hex('#9333EA')('Single Provider Ecosystem')}  ${chalk.gray(isEn ? '(Tier models in 1 ecosystem: Claude Sonnet+Haiku, OpenAI o3+4o...)' : '(Phân tầng trong 1 hãng: Claude Sonnet+Haiku, OpenAI o3+4o...)')}`,
          value: 'ecosystem',
        },
        {
          name: `${chalk.bold.green('Single Model for All Roles')}   ${chalk.gray(isEn ? '(Use ONE model & ONE API key for all 3 roles)' : '(Dùng 1 model & 1 API key duy nhất cho cả 3 vai trò)')}`,
          value: 'single',
        },
        {
          name: `${chalk.bold.cyan('Custom Role-by-Role')}         ${chalk.gray(isEn ? '(Individually configure Architect, Builder, and Auditor)' : '(Tự cấu hình chi tiết từng vai trò Architect, Builder, Auditor)')}`,
          value: 'custom',
        },
      ],
    });

    let architectConfig: RoleConfig;
    let builderConfig: RoleConfig;
    let auditorConfig: RoleConfig;

    if (configMode === 'ecosystem') {
      const eco = await this.promptConfigureEcosystem(isEn);
      if (eco) {
        return {
          roles: eco.roles,
          language: existingConfig?.language ?? 'vi',
          theme: existingConfig?.theme ?? 'dark',
        };
      }
      // If user hit back in ecosystem during onboarding, fallback to offline preset
      const fallback = await this.promptSelectPreset(isEn);
      return {
        roles: fallback?.roles || {
          architect: { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' },
          builder: { provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' },
          auditor: { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' },
        },
      };
    } else if (configMode === 'single') {
      console.log(chalk.cyan(isEn
        ? '\nConfigure Single Model (Applies to Architect, Builder & Auditor):'
        : '\nCấu hình 1 Model duy nhất (Áp dụng cho Architect, Builder & Auditor):'
      ));
      const single = await this.selectOrCustomModel(isEn ? 'All Roles' : 'Tất cả các vai trò', POPULAR_ARCHITECT_MODELS, isEn);
      const chosen = single || {
        provider: 'openai-compatible' as const,
        model: 'deepseek-r1:14b',
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'not-needed-for-local',
      };
      architectConfig = { ...chosen };
      builderConfig = { ...chosen };
      auditorConfig = { ...chosen };

      const roleBundle = { architect: architectConfig, builder: builderConfig, auditor: auditorConfig };
      await this.askApiKeysIfNeeded(roleBundle, isEn);
      return { roles: roleBundle };
    } else if (configMode === 'recommended') {
      const presetRes = await this.promptSelectPreset(isEn);
      if (presetRes) {
        return { roles: presetRes.roles };
      }
      return {
        roles: {
          architect: { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' },
          builder: { provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' },
          auditor: { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' },
        },
      };
    } else {
      console.log(chalk.cyan(isEn ? '\nCustom Configuration:' : '\nCấu Hình Chi Tiết Từng Vai Trò:'));
      const arch = await this.selectOrCustomModel('Architect', POPULAR_ARCHITECT_MODELS, isEn);
      const build = await this.selectOrCustomModel('Builder', POPULAR_BUILDER_MODELS, isEn);
      const audit = await this.selectOrCustomModel('Auditor', POPULAR_AUDITOR_MODELS, isEn);

      architectConfig = arch || { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' };
      builderConfig = build || { provider: 'openai-compatible', model: 'qwen2.5-coder:32b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' };
      auditorConfig = audit || { provider: 'openai-compatible', model: 'deepseek-r1:14b', baseURL: 'http://localhost:11434/v1', apiKey: 'not-needed-for-local' };

      const roleBundle = { architect: architectConfig, builder: builderConfig, auditor: auditorConfig };
      await this.askApiKeysIfNeeded(roleBundle, isEn);
      return { roles: roleBundle };
    }
  }

  static async promptChangeModel(config: AppConfig): Promise<AppConfig> {
    const isEn = config.language === 'en';
    const modeChoice = await select({
      message: isEn ? 'Model configuration mode:' : 'Chế độ cấu hình mô hình:',
      choices: [
        {
          name: `${chalk.bold.yellow('Recommended Presets')}        ${chalk.gray(isEn ? '(Switch to a curated preset: Pure Claude, OpenAI, Offline...)' : '(Chọn cấu hình mẫu: Pure Claude, OpenAI, Offline...)')}`,
          value: 'preset',
        },
        {
          name: `${chalk.bold.hex('#9333EA')('Single Provider Ecosystem')}  ${chalk.gray(isEn ? '(Tier models in 1 provider: Claude Sonnet+Haiku, OpenAI o3+4o...)' : '(Phân tầng trong 1 hãng: Claude Sonnet+Haiku, OpenAI o3+4o...)')}`,
          value: 'ecosystem',
        },
        {
          name: `${chalk.bold.green('Single Model for All Roles')}   ${chalk.gray(isEn ? '(Apply ONE model & API key to Architect, Builder, and Auditor)' : '(Dùng 1 model & 1 API key duy nhất cho cả 3 vai trò)')}`,
          value: 'single',
        },
        {
          name: `${chalk.bold.cyan('Custom Role Setup')}            ${chalk.gray(isEn ? '(Customize Architect, Builder, or Auditor individually)' : '(Tùy chỉnh riêng lẻ từng vai trò Architect, Builder, Auditor)')}`,
          value: 'role',
        },
        {
          name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại',
          value: 'back',
        },
      ],
    });

    if (modeChoice === 'back') return config;

    if (modeChoice === 'preset') {
      const presetRes = await this.promptSelectPreset(isEn);
      if (!presetRes) return config;
      return {
        ...config,
        roles: presetRes.roles,
      };
    }

    if (modeChoice === 'ecosystem') {
      const eco = await this.promptConfigureEcosystem(isEn);
      if (!eco) return config;
      return {
        ...config,
        roles: eco.roles,
      };
    }

    if (modeChoice === 'single') {
      console.log(chalk.cyan(isEn
        ? '\nConfigure Single Model (Applies to Architect, Builder & Auditor):'
        : '\nCấu hình 1 Model duy nhất (Áp dụng cho Architect, Builder & Auditor):'
      ));
      const singleRoleConfig = await this.selectOrCustomModel(isEn ? 'All Roles' : 'Tất cả vai trò', POPULAR_ARCHITECT_MODELS, isEn);
      if (!singleRoleConfig) return config;

      const isLocal =
        singleRoleConfig.provider === 'openai-compatible' &&
        (singleRoleConfig.baseURL?.includes('localhost') || singleRoleConfig.baseURL?.includes('127.0.0.1'));

      if (isLocal) {
        singleRoleConfig.apiKey = 'not-needed-for-local';
        console.log(chalk.green(isEn ? '+ Local model selected - No API key required.' : '+ Đã chọn model Local - Không cần API key (0đ).'));
      } else {
        const currentKey = config.roles.architect?.apiKey;
        const keyHint = currentKey
          ? chalk.dim(isEn ? `[Enter to keep current (${maskKey(currentKey)}), or type "none" to remove]` : `[Enter để giữ key hiện tại (${maskKey(currentKey)}), hoặc gõ "none" để xóa]`)
          : chalk.dim(isEn ? '[Paste key, Enter if set in env, or type "none" for no key]' : '[Dán key, Enter nếu đã có trong env, hoặc gõ "none" nếu không dùng]');

        const inputKey = await input({
          message: isEn ? `API Key for ${singleRoleConfig.model} ${keyHint}:` : `API Key cho ${singleRoleConfig.model} ${keyHint}:`,
        });
        const trimmed = inputKey.trim();
        const lower = trimmed.toLowerCase();
        if (['none', 'clear', 'remove', 'delete', 'no', 'unset'].includes(lower)) {
          delete singleRoleConfig.apiKey;
          console.log(chalk.yellow(isEn ? '+ Removed API Key (key cleared).' : '+ Đã xóa API Key.'));
        } else if (trimmed) {
          singleRoleConfig.apiKey = trimmed;
          console.log(chalk.green(isEn ? `+ API Key updated (${maskKey(trimmed)})` : `+ Đã cập nhật API Key (${maskKey(trimmed)})`));
        } else {
          singleRoleConfig.apiKey = config.roles.architect?.apiKey;
        }
      }

      const effortChoice = await select({
        message: isEn ? 'Reasoning effort / Thinking budget:' : 'Mức độ suy luận (Reasoning effort):',
        default: config.roles.architect?.reasoningEffort || 'medium',
        choices: [
          { name: isEn ? 'Medium (Balanced speed & depth - recommended)' : 'Trung bình (Cân bằng tốc độ & chất lượng - khuyên dùng)', value: 'medium' },
          { name: isEn ? 'High (Maximum reasoning depth & extended thinking)' : 'Cao (Suy luận sâu tối đa, extended thinking)', value: 'high' },
          { name: isEn ? 'Low (Fast execution, minimal thinking tokens)' : 'Thấp (Nhanh, ít token suy luận)', value: 'low' },
          { name: isEn ? 'Off / Default (Standard execution without extended thinking)' : 'Tắt (Tiêu chuẩn không extended thinking)', value: 'off' },
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

      console.log(chalk.green(isEn
        ? `\n+ All roles set to: ${singleRoleConfig.model} (${singleRoleConfig.provider}, effort: ${singleRoleConfig.reasoningEffort})\n`
        : `\n+ Cả 3 vai trò đã chuyển sang: ${singleRoleConfig.model} (${singleRoleConfig.provider}, suy luận: ${singleRoleConfig.reasoningEffort})\n`
      ));
      return updatedConfig;
    }

    // modeChoice === 'role'
    const roleChoice = await select({
      message: isEn ? 'Select role to customize:' : 'Chọn vai trò cần tùy chỉnh:',
      choices: [
        { name: `Architect (${config.roles.architect.model}) [${config.roles.architect.provider}]`, value: 'architect' },
        { name: `Builder (${config.roles.builder.model}) [${config.roles.builder.provider}]`, value: 'builder' },
        { name: `Auditor (${config.roles.auditor.model}) [${config.roles.auditor.provider}]`, value: 'auditor' },
        { name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại', value: 'back' },
      ],
    });

    if (roleChoice === 'back') return config;

    const targetRole = roleChoice as 'architect' | 'builder' | 'auditor';
    let options: ModelOption[];
    if (targetRole === 'architect') options = POPULAR_ARCHITECT_MODELS;
    else if (targetRole === 'builder') options = POPULAR_BUILDER_MODELS;
    else options = POPULAR_AUDITOR_MODELS;

    const newRoleConfig = await this.selectOrCustomModel(targetRole, options, isEn);
    if (!newRoleConfig) return config;

    const isLocal =
      newRoleConfig.provider === 'openai-compatible' &&
      (newRoleConfig.baseURL?.includes('localhost') || newRoleConfig.baseURL?.includes('127.0.0.1'));

    if (isLocal) {
      newRoleConfig.apiKey = 'not-needed-for-local';
      console.log(chalk.green(isEn ? '+ Local model selected - No API key required.' : '+ Đã chọn model Local - Không cần API key (0đ).'));
    } else {
      const currentKey = config.roles[targetRole]?.apiKey;
      const keyHint = currentKey
        ? chalk.dim(isEn ? `[Enter to keep current (${maskKey(currentKey)}), or type "none" to remove]` : `[Enter để giữ key hiện tại (${maskKey(currentKey)}), hoặc gõ "none" để xóa]`)
        : chalk.dim(isEn ? '[Paste key, Enter if set in env, or type "none" for no key]' : '[Dán key, Enter nếu đã có trong env, hoặc gõ "none" nếu không dùng]');

      const inputKey = await input({
        message: isEn ? `API Key for ${targetRole} ${keyHint}:` : `API Key cho ${targetRole} ${keyHint}:`,
      });
      const trimmed = inputKey.trim();
      const lower = trimmed.toLowerCase();
      if (['none', 'clear', 'remove', 'delete', 'no', 'unset'].includes(lower)) {
        delete newRoleConfig.apiKey;
        console.log(chalk.yellow(isEn ? `+ Removed API Key for ${targetRole} (key cleared).` : `+ Đã xóa API Key của ${targetRole}.`));
      } else if (trimmed) {
        newRoleConfig.apiKey = trimmed;
        console.log(chalk.green(isEn ? `+ ${targetRole} API Key updated (${maskKey(trimmed)})` : `+ Đã cập nhật API Key cho ${targetRole} (${maskKey(trimmed)})`));
      } else {
        newRoleConfig.apiKey = config.roles[targetRole]?.apiKey;
      }
    }

    const effortChoice = await select({
      message: isEn ? `Reasoning effort / Thinking budget for ${targetRole}:` : `Mức độ suy luận cho ${targetRole}:`,
      default: config.roles[targetRole]?.reasoningEffort || 'medium',
      choices: [
        { name: isEn ? 'Medium (Balanced speed & depth - recommended)' : 'Trung bình (Cân bằng tốc độ & chất lượng - khuyên dùng)', value: 'medium' },
        { name: isEn ? 'High (Maximum reasoning depth & extended thinking)' : 'Cao (Suy luận sâu tối đa, extended thinking)', value: 'high' },
        { name: isEn ? 'Low (Fast execution, minimal thinking tokens)' : 'Thấp (Nhanh, ít token suy luận)', value: 'low' },
        { name: isEn ? 'Off / Default (Standard execution without extended thinking)' : 'Tắt (Tiêu chuẩn không extended thinking)', value: 'off' },
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

    console.log(chalk.green(isEn
      ? `\n+ Updated ${targetRole} to ${newRoleConfig.model} (${newRoleConfig.provider}, effort: ${newRoleConfig.reasoningEffort})\n`
      : `\n+ Đã cập nhật ${targetRole} thành ${newRoleConfig.model} (${newRoleConfig.provider}, suy luận: ${newRoleConfig.reasoningEffort})\n`
    ));
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
          name: isEn ? 'Update API Key for a role' : 'Cập nhật API Key cho một vai trò',
          value: 'update',
        },
        {
          name: isEn ? 'Remove / Clear API Key for a role (Stop using key)' : 'Xóa / Bỏ API Key của một vai trò (Không dùng key nữa)',
          value: 'remove_one',
        },
        {
          name: isEn ? 'Clear ALL stored API Keys (Switch to local Ollama or .env)' : 'Xóa TOÀN BỘ API Key đã lưu (Chuyển sang offline hoặc file .env)',
          value: 'clear_all',
        },
        {
          name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại',
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
      const roleChoice = await select({
        message: isEn ? 'Select role to remove API key from:' : 'Chọn vai trò cần xóa API Key:',
        choices: [
          { name: `Architect (${config.roles.architect.model})`, value: 'architect' },
          { name: `Builder (${config.roles.builder.model})`, value: 'builder' },
          { name: `Auditor (${config.roles.auditor.model})`, value: 'auditor' },
          { name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại', value: 'back' },
        ],
      });

      if (roleChoice === 'back') return config;

      const targetRole = roleChoice as 'architect' | 'builder' | 'auditor';
      delete newRoles[targetRole].apiKey;
      console.log(chalk.green(isEn ? `\n+ Removed API Key for ${targetRole}.\n` : `\n+ Đã xóa API Key của ${targetRole}.\n`));
      return { ...config, roles: newRoles };
    }

    if (action === 'update') {
      const roleChoice = await select({
        message: isEn ? 'Select role to update API key:' : 'Chọn vai trò cần cập nhật API Key:',
        choices: [
          { name: `Architect (${config.roles.architect.model})`, value: 'architect' },
          { name: `Builder (${config.roles.builder.model})`, value: 'builder' },
          { name: `Auditor (${config.roles.auditor.model})`, value: 'auditor' },
          { name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại', value: 'back' },
        ],
      });

      if (roleChoice === 'back') return config;

      const targetRole = roleChoice as 'architect' | 'builder' | 'auditor';
      const keyInput = await input({
        message: isEn
          ? `Enter new API Key for ${targetRole} (or type 'none' to remove):`
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
    const isEn = config.language === 'en';
    const roleChoice = await select({
      message: isEn ? 'Select target role to configure reasoning effort:' : 'Chọn vai trò cần cấu hình mức độ suy luận:',
      choices: [
        { name: isEn ? 'All Roles (Architect, Builder, Auditor)' : 'Tất cả các vai trò (Architect, Builder, Auditor)', value: 'all' },
        { name: `Architect (${config.roles.architect.model}) [Current: ${config.roles.architect.reasoningEffort || 'default'}]`, value: 'architect' },
        { name: `Builder (${config.roles.builder.model}) [Current: ${config.roles.builder.reasoningEffort || 'default'}]`, value: 'builder' },
        { name: `Auditor (${config.roles.auditor.model}) [Current: ${config.roles.auditor.reasoningEffort || 'default'}]`, value: 'auditor' },
        { name: isEn ? '[Back] Cancel' : '[Quay lại] Hủy / Quay lại', value: 'back' },
      ],
    });

    if (roleChoice === 'back') return config;

    const effortChoice = await select({
      message: isEn ? 'Select reasoning effort level:' : 'Chọn mức độ suy luận (Reasoning effort):',
      choices: [
        { name: isEn ? 'Medium (Balanced speed & depth - recommended)' : 'Trung bình (Cân bằng tốc độ & độ sâu - khuyên dùng)', value: 'medium' },
        { name: isEn ? 'High (Maximum reasoning depth & extended thinking)' : 'Cao (Suy luận sâu tối đa, extended thinking)', value: 'high' },
        { name: isEn ? 'Low (Fast execution, minimal thinking tokens)' : 'Thấp (Thực thi nhanh, ít token)', value: 'low' },
        { name: isEn ? 'Off / Default (Standard execution without extended thinking)' : 'Tắt (Tiêu chuẩn không suy luận mở rộng)', value: 'off' },
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

    console.log(chalk.green(isEn ? `\n+ Updated reasoning effort for ${roleChoice} to: ${effort}\n` : `\n+ Đã cập nhật mức độ suy luận cho ${roleChoice} thành: ${effort}\n`));
    return {
      ...config,
      roles: newRoles,
    };
  }

  static async promptSelectLanguage(config: AppConfig): Promise<AppConfig> {
    const langChoice = await select({
      message: 'Interface language / Ngôn ngữ giao diện:',
      default: config.language || 'vi',
      choices: [
        { name: 'Tiếng Việt (Vietnamese)', value: 'vi' },
        { name: 'English (Tiếng Anh)', value: 'en' },
      ],
    });

    const updatedConfig: AppConfig = {
      ...config,
      language: langChoice as 'en' | 'vi',
    };

    console.log(chalk.green(`\n+ Language set to ${langChoice === 'en' ? 'English' : 'Tiếng Việt'}\n`));
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
