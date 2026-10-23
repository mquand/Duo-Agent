import { confirm, select, input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { Plan, AppConfig, RoleConfig, ProviderType } from '../types/index.js';

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

interface ModelOption {
  name: string;
  provider: ProviderType;
  model: string;
  baseURL?: string;
}

const POPULAR_ARCHITECT_MODELS: ModelOption[] = [
  {
    name: 'Claude 3.7 Sonnet (Anthropic - Tư duy kiến trúc & lập kế hoạch xuất sắc)',
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
  },
  {
    name: 'Claude 3.5 Sonnet (Anthropic - Rất thông minh & ổn định)',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
  },
  {
    name: 'DeepSeek R1 (DeepSeek Reasoning - Suy luận mạnh, giá siêu rẻ)',
    provider: 'openai-compatible',
    model: 'deepseek-reasoner',
    baseURL: 'https://api.deepseek.com/v1',
  },
  {
    name: 'OpenAI o3-mini (OpenAI - Suy luận nhanh)',
    provider: 'openai-compatible',
    model: 'o3-mini',
  },
  {
    name: 'GPT-4o (OpenAI)',
    provider: 'openai-compatible',
    model: 'gpt-4o',
  },
];

const POPULAR_BUILDER_MODELS: ModelOption[] = [
  {
    name: 'Gemini 2.0 Flash (Google - Siêu nhanh, chi phí ~0, 1M context - Khuyên dùng)',
    provider: 'google',
    model: 'gemini-2.0-flash',
  },
  {
    name: 'Gemini 1.5 Flash (Google - Rất nhanh & ổn định)',
    provider: 'google',
    model: 'gemini-1.5-flash',
  },
  {
    name: 'DeepSeek V3 (DeepSeek Chat - Code cực tốt, giá cực rẻ)',
    provider: 'openai-compatible',
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
  },
  {
    name: 'Llama 3.3 70B (Groq - Tốc độ cực nhanh ~300-500 tok/s)',
    provider: 'openai-compatible',
    model: 'llama-3.3-70b-versatile',
    baseURL: 'https://api.groq.com/openai/v1',
  },
  {
    name: 'Claude 3.5 Haiku (Anthropic - Nhanh, chuẩn cú pháp)',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-latest',
  },
  {
    name: 'Qwen 2.5 Coder 32B (OpenAI-compatible / Ollama / DeepInfra)',
    provider: 'openai-compatible',
    model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
  },
];

const POPULAR_AUDITOR_MODELS: ModelOption[] = [
  {
    name: 'Claude 3.7 Sonnet (Anthropic - Soi lỗi & review chuẩn xác nhất)',
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
  },
  {
    name: 'Claude 3.5 Sonnet (Anthropic - Tổng duyệt chất lượng cao)',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
  },
  {
    name: 'DeepSeek R1 (DeepSeek Reasoning - Soi logic kỹ lưỡng)',
    provider: 'openai-compatible',
    model: 'deepseek-reasoner',
    baseURL: 'https://api.deepseek.com/v1',
  },
  {
    name: 'GPT-4o (OpenAI - Đánh giá toàn diện)',
    provider: 'openai-compatible',
    model: 'gpt-4o',
  },
];

export class SecurityPrompts {
  static isDangerous(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }

  static async promptCommandApproval(command: string, autoAccept: boolean = false): Promise<boolean> {
    const isDanger = this.isDangerous(command);

    if (isDanger) {
      console.log(chalk.bgRed.white.bold('\n⚠️  CẢNH BÁO NGUY HIỂM: Lệnh này có thể gây mất dữ liệu!'));
      console.log(chalk.red(`Lệnh: ${command}\n`));
      return await confirm({
        message: 'Bạn có CHẮC CHẮN muốn chạy lệnh nguy hiểm này không?',
        default: false,
      });
    }

    if (autoAccept) return true;

    return await confirm({
      message: `Chạy lệnh: ${chalk.cyan(command)}?`,
      default: true,
    });
  }

  static async promptPlanApproval(plan: Plan): Promise<'execute' | 'abort'> {
    console.log(chalk.bold.yellow('\n' + '─'.repeat(60)));
    console.log(chalk.bold.yellow(`📋 KẾ HOẠCH THỰC THI (ARCHITECT PLAN)`));
    console.log(chalk.bold.white(`Mục tiêu: ${plan.goal}`));
    console.log(chalk.gray(`Tóm tắt:  ${plan.summary}`));
    console.log(chalk.bold.yellow('─'.repeat(60)));

    for (const step of plan.dag) {
      const depInfo = step.depends_on.length > 0 ? chalk.magenta(` (Phụ thuộc: ${step.depends_on.join(', ')})`) : chalk.green(' (Song song)');
      console.log(chalk.bold.blue(`\n[${step.id}] `) + chalk.bold.white(step.title) + depInfo);
      console.log(chalk.gray(`  Files: `) + chalk.cyan(step.target_files.join(', ')));
      console.log(chalk.gray(`  Mô tả: `) + step.instructions);
      if (step.verification_cmd) {
        console.log(chalk.gray(`  Test:  `) + chalk.yellow(step.verification_cmd));
      }
    }
    console.log(chalk.bold.yellow('\n' + '─'.repeat(60) + '\n'));

    const answer = await select({
      message: 'Bạn muốn xử lý kế hoạch này như thế nào?',
      choices: [
        { name: '✅ Chấp thuận và bắt đầu thực thi (Execute)', value: 'execute' },
        { name: '❌ Hủy bỏ (Abort)', value: 'abort' },
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
      name: '✏️  Nhập model tùy chỉnh khác (Custom model)...',
      value: 'custom',
    });

    const selectedIdx = await select({
      message: `Chọn model cho ${roleTitle}:`,
      choices,
    });

    if (selectedIdx === 'custom') {
      const providerChoice = await select({
        message: `Chọn nhà cung cấp (Provider) cho ${roleTitle}:`,
        choices: [
          { name: 'Anthropic (Claude)', value: 'anthropic' },
          { name: 'Google (Gemini)', value: 'google' },
          { name: 'OpenAI-Compatible (DeepSeek, Groq, OpenAI, Ollama...)', value: 'openai-compatible' },
        ],
      });

      const customModel = await input({
        message: `Nhập tên model tùy chỉnh:`,
      });

      let baseURL: string | undefined;
      if (providerChoice === 'openai-compatible') {
        baseURL = await input({
          message: 'Nhập Base URL (nếu có, ví dụ https://api.deepseek.com/v1 hoặc http://localhost:11434/v1):',
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
    console.log(chalk.bold.cyan('\n🚀 CHÀO MỪNG BẠN ĐẾN VỚI DUO-AGENT!'));
    console.log(chalk.gray('Hãy chọn cấu hình đội hình Agent (không cần tự gõ tên model):\n'));

    const presetChoice = await select({
      message: 'Chọn cấu hình đội hình Agent (Preset):',
      choices: [
        {
          name: '🥪 Tiêu chuẩn (Balanced): Claude (Architect) + Gemini 2.0 Flash (Builder) + Claude (Auditor)',
          value: 'balanced',
        },
        {
          name: '💰 Siêu tiết kiệm (DeepSeek Team): DeepSeek-R1 (Architect) + DeepSeek-V3 (Builder) + DeepSeek-R1 (Auditor)',
          value: 'deepseek',
        },
        {
          name: '⚡ Tốc độ cao (OpenAI + Groq): o3-mini (Architect) + Groq Llama-3.3 (Builder) + GPT-4o (Auditor)',
          value: 'fast',
        },
        {
          name: '🛠️  Tự chọn từng vai trò từ danh sách (Custom selection by role)',
          value: 'custom',
        },
      ],
    });

    let architectConfig: RoleConfig;
    let builderConfig: RoleConfig;
    let auditorConfig: RoleConfig;

    if (presetChoice === 'balanced') {
      architectConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' };
      builderConfig = { provider: 'google', model: 'gemini-2.0-flash' };
      auditorConfig = { provider: 'anthropic', model: 'claude-3-7-sonnet-20250219' };
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
      architectConfig = { provider: 'openai-compatible', model: 'o3-mini' };
      builderConfig = {
        provider: 'openai-compatible',
        model: 'llama-3.3-70b-versatile',
        baseURL: 'https://api.groq.com/openai/v1',
      };
      auditorConfig = { provider: 'openai-compatible', model: 'gpt-4o' };
    } else {
      architectConfig = await this.selectOrCustomModel('🧠 Architect (Lên kế hoạch)', POPULAR_ARCHITECT_MODELS);
      builderConfig = await this.selectOrCustomModel('⚡ Builder (Viết code & Test)', POPULAR_BUILDER_MODELS);
      auditorConfig = await this.selectOrCustomModel('🔍 Auditor (Tổng duyệt)', POPULAR_AUDITOR_MODELS);
    }

    // Ask for API keys if needed
    console.log(chalk.bold.yellow('\n🔑 NHẬP API KEY (Bấm Enter nếu bạn đã đặt trong biến môi trường):'));

    if (architectConfig.provider === 'anthropic' || auditorConfig.provider === 'anthropic') {
      const key = await password({
        message: 'Anthropic API Key (Claude) [Enter nếu đã có trong ANTHROPIC_API_KEY]:',
      });
      if (key.trim()) {
        architectConfig.apiKey = key.trim();
        if (auditorConfig.provider === 'anthropic') auditorConfig.apiKey = key.trim();
      }
    }

    if (builderConfig.provider === 'google') {
      const key = await password({
        message: 'Google Gemini API Key [Enter nếu đã có trong GEMINI_API_KEY]:',
      });
      if (key.trim()) builderConfig.apiKey = key.trim();
    }

    if (
      architectConfig.provider === 'openai-compatible' ||
      builderConfig.provider === 'openai-compatible' ||
      auditorConfig.provider === 'openai-compatible'
    ) {
      const key = await password({
        message: 'API Key cho dịch vụ OpenAI-compatible (DeepSeek / Groq / OpenAI) [Enter nếu đã đặt trong env]:',
      });
      if (key.trim()) {
        if (architectConfig.provider === 'openai-compatible') architectConfig.apiKey = key.trim();
        if (builderConfig.provider === 'openai-compatible') builderConfig.apiKey = key.trim();
        if (auditorConfig.provider === 'openai-compatible') auditorConfig.apiKey = key.trim();
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
    const roleChoice = await select({
      message: 'Chọn vai trò bạn muốn đổi model:',
      choices: [
        { name: `🧠 Architect (${config.roles.architect.model})`, value: 'architect' },
        { name: `⚡ Builder (${config.roles.builder.model})`, value: 'builder' },
        { name: `🔍 Auditor (${config.roles.auditor.model})`, value: 'auditor' },
      ],
    });

    const targetRole = roleChoice as 'architect' | 'builder' | 'auditor';
    let options: ModelOption[];
    if (targetRole === 'architect') options = POPULAR_ARCHITECT_MODELS;
    else if (targetRole === 'builder') options = POPULAR_BUILDER_MODELS;
    else options = POPULAR_AUDITOR_MODELS;

    const newRoleConfig = await this.selectOrCustomModel(targetRole, options);

    const apiKey = await password({
      message: `Nhập API Key mới cho ${targetRole} (Bấm Enter để giữ nguyên):`,
    });
    if (apiKey.trim()) {
      newRoleConfig.apiKey = apiKey.trim();
    } else {
      newRoleConfig.apiKey = config.roles[targetRole].apiKey;
    }

    const updatedConfig: AppConfig = {
      ...config,
      roles: {
        ...config.roles,
        [targetRole]: newRoleConfig,
      },
    };

    console.log(
      chalk.green(
        `\n✔ Đã cập nhật ${targetRole} sang: ${chalk.bold(newRoleConfig.model)} (${newRoleConfig.provider})`
      )
    );
    return updatedConfig;
  }

  static async promptSelectLanguage(config: AppConfig): Promise<AppConfig> {
    const langChoice = await select({
      message: 'Chọn ngôn ngữ giao diện (Select interface language):',
      default: config.language || 'vi',
      choices: [
        { name: '🇻🇳 Tiếng Việt', value: 'vi' },
        { name: '🇬🇧 English', value: 'en' },
      ],
    });

    const updatedConfig: AppConfig = {
      ...config,
      language: langChoice as 'en' | 'vi',
    };

    console.log(
      chalk.green(
        langChoice === 'en'
          ? '\n✔ Interface language set to English!'
          : '\n✔ Đã thiết lập ngôn ngữ giao diện sang Tiếng Việt!'
      )
    );
    return updatedConfig;
  }
}
