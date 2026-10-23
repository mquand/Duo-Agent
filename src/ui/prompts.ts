import { confirm, select, input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { Plan, AppConfig } from '../types/index.js';

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

  static async promptOnboarding(): Promise<AppConfig> {
    console.log(chalk.bold.cyan('\n🚀 CHÀO MỪNG BẠN ĐẾN VỚI DUO-AGENT!'));
    console.log(chalk.gray('Cần thiết lập cấu hình Model và API Key để bắt đầu.\n'));

    const architectModel = await input({
      message: 'Nhập model cho Architect (Claude / Reasoning):',
      default: 'claude-3-7-sonnet-20250219',
    });
    const anthropicKey = await password({
      message: 'Nhập Anthropic API Key (Bấm Enter nếu đã đặt trong env):',
    });

    const builderModel = await input({
      message: 'Nhập model cho Builder (Gemini / DeepSeek / Fast Coder):',
      default: 'gemini-2.0-flash',
    });
    const geminiKey = await password({
      message: 'Nhập Google Gemini API Key (Bấm Enter nếu đã đặt trong env):',
    });

    const auditorModel = await input({
      message: 'Nhập model cho Auditor (Tổng duyệt chất lượng):',
      default: architectModel,
    });

    return {
      roles: {
        architect: {
          provider: 'anthropic',
          model: architectModel.trim(),
          apiKey: anthropicKey.trim() || undefined,
        },
        builder: {
          provider: 'google',
          model: builderModel.trim(),
          apiKey: geminiKey.trim() || undefined,
        },
        auditor: {
          provider: 'anthropic',
          model: auditorModel.trim(),
          apiKey: anthropicKey.trim() || undefined,
        },
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
    const current = config.roles[targetRole];

    const providerChoice = await select({
      message: `Chọn nhà cung cấp (Provider) cho ${targetRole}:`,
      default: current.provider,
      choices: [
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'Google (Gemini)', value: 'google' },
        { name: 'OpenAI-Compatible (DeepSeek, Groq, OpenAI, Ollama...)', value: 'openai-compatible' },
      ],
    });

    const newModel = await input({
      message: `Nhập tên model mới cho ${targetRole}:`,
      default: current.model,
    });

    let newBaseURL = current.baseURL;
    if (providerChoice === 'openai-compatible') {
      newBaseURL = await input({
        message: 'Nhập Base URL (nếu có, ví dụ https://api.deepseek.com/v1 hoặc http://localhost:11434/v1):',
        default: current.baseURL || 'https://api.openai.com/v1',
      });
    }

    const newApiKey = await password({
      message: `Nhập API Key mới (Bấm Enter để giữ nguyên):`,
    });

    const updatedConfig: AppConfig = {
      ...config,
      roles: {
        ...config.roles,
        [targetRole]: {
          provider: providerChoice as any,
          model: newModel.trim(),
          baseURL: newBaseURL?.trim() || undefined,
          apiKey: newApiKey.trim() || current.apiKey,
        },
      },
    };

    console.log(chalk.green(`\n✔ Đã cập nhật ${targetRole} sang model: ${chalk.bold(newModel)} (${providerChoice})`));
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
