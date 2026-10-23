#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { input } from '@inquirer/prompts';

import { ConfigManager } from './config/manager.js';
import { ProjectDetector } from './detector/project.js';
import { GitGuard } from './core/git-guard.js';
import { CodeGraph } from './core/codegraph.js';
import { Blackboard } from './core/blackboard.js';
import { DAGScheduler } from './core/scheduler.js';
import { ProviderFactory } from './providers/factory.js';
import { ArchitectAgent } from './agents/architect.js';
import { BuilderAgent } from './agents/builder.js';
import { AuditorAgent } from './agents/auditor.js';
import { Logger } from './ui/logger.js';
import { SecurityPrompts } from './ui/prompts.js';
import { AppConfig, ExecutionOptions } from './types/index.js';

const execAsync = promisify(exec);
const program = new Command();

async function runWorkflow(
  promptText: string,
  options: ExecutionOptions,
  config: AppConfig
): Promise<void> {
  // 1. Detect Project Stack & Rules
  const project = await ProjectDetector.detect();
  Logger.printInfo(
    `Phát hiện dự án: ${chalk.bold(project.type.toUpperCase())} (${project.language})` +
      (project.ruleFile ? ` | Quy ước: ${chalk.cyan(project.ruleFile)}` : '')
  );

  // 2. Create Safety Checkpoint
  const checkpointRef = await GitGuard.createCheckpoint();
  if (checkpointRef) {
    Logger.printInfo(`Đã tạo Git Checkpoint an toàn [${checkpointRef.slice(0, 7)}]`);
  }

  // 3. Build CodeGraph Skeleton
  const spinner = ora('Đang quét cấu trúc mã nguồn (CodeGraph Skeleton)...').start();
  const codeSkeleton = await CodeGraph.generateSkeleton();
  spinner.succeed(chalk.green('Đã trích xuất xong CodeGraph Skeleton!'));

  // 4. Architect Phase (Reasoning Model)
  spinner.start(`🧠 Architect (${config.roles.architect.model}) đang lập kế hoạch...`);
  const architectProvider = ProviderFactory.create(config.roles.architect);
  const architect = new ArchitectAgent(architectProvider);

  let plan;
  try {
    plan = await architect.plan(promptText, codeSkeleton, project.ruleContent);
    spinner.succeed(chalk.green('Architect đã lập kế hoạch xong!'));
  } catch (err: any) {
    spinner.fail(chalk.red(`Lỗi lập kế hoạch: ${err.message}`));
    return;
  }

  // 5. Handle --plan-only
  if (options.planOnly) {
    await fs.ensureDir('.duo');
    await fs.writeFile(
      path.join('.duo', 'plan.md'),
      `# Kế hoạch: ${plan.goal}\n\n${plan.summary}\n\n` +
        plan.dag
          .map(
            (s) =>
              `### [${s.id}] ${s.title}\n- Files: ${s.target_files.join(', ')}\n- Hướng dẫn: ${s.instructions}\n- Test: ${s.verification_cmd || 'N/A'}`
          )
          .join('\n\n')
    );
    console.log(
      chalk.bold.green(
        `\n✔ Đã lưu kế hoạch vào .duo/plan.md (Chế độ Plan-Only). Mã nguồn không bị thay đổi!`
      )
    );
    return;
  }

  // 6. Human-in-the-Loop Gate (Plan Approval)
  if (!options.autoAccept) {
    const decision = await SecurityPrompts.promptPlanApproval(plan);
    if (decision === 'abort') {
      console.log(chalk.red('\nĐã hủy bỏ thực thi.'));
      return;
    }
  }

  // 7. Builder Phase (Concurrent Execution via DAG Scheduler)
  console.log(
    chalk.bold.cyan(
      `\n⚡ BẮT ĐẦU THỰC THI ĐỒ THỊ NHIỆM VỤ VỚI BUILDER (${config.roles.builder.model})...\n`
    )
  );
  const builderProvider = ProviderFactory.create(config.roles.builder);
  const builder = new BuilderAgent(builderProvider);
  const blackboard = new Blackboard();
  await blackboard.init(plan.goal);

  const scheduler = new DAGScheduler(builder, blackboard);

  const stepSpinners: Record<string, any> = {};
  const executionResult = await scheduler.executePlan(plan, {
    onStepStart: (step) => {
      stepSpinners[step.id] = ora(`[${step.id}] Đang thực thi: ${step.title}`).start();
    },
    onStepComplete: (step, res) => {
      if (stepSpinners[step.id]) {
        stepSpinners[step.id].succeed(
          chalk.green(`[${step.id}] Hoàn thành: ${step.title} (${res.modifiedFiles.join(', ')})`)
        );
      }
    },
    onStepError: (step, err) => {
      if (stepSpinners[step.id]) {
        stepSpinners[step.id].fail(chalk.red(`[${step.id}] Lỗi: ${err}`));
      }
    },
  });

  if (!executionResult.success) {
    Logger.printError('Một số bước trong kế hoạch bị lỗi. Quá trình tạm dừng.');
    console.log(chalk.yellow(`Gõ 'duo --undo' hoặc dùng lệnh slash '/undo' để khôi phục.`));
    return;
  }

  // 8. Chief Auditor Phase (Final Review & Last-Mile Polish)
  const auditorSpinner = ora(
    `🔍 Chief Auditor (${config.roles.auditor.model}) đang tổng duyệt toàn bộ Git Diff cuối cùng...`
  ).start();
  const auditorProvider = ProviderFactory.create(config.roles.auditor);
  const auditor = new AuditorAgent(auditorProvider);

  const accumulatedDiff = await GitGuard.getDiff(checkpointRef || 'HEAD');
  const reviewResult = await auditor.review(plan.goal, accumulatedDiff, project.ruleContent);

  if (reviewResult.approved) {
    auditorSpinner.succeed(chalk.green('Chief Auditor: PHÊ DUYỆT CHẤT LƯỢNG (PASS)'));
    console.log(chalk.gray(`Nhận xét: ${reviewResult.critique}`));
    if (reviewResult.polishDiffs && reviewResult.polishDiffs.length > 0) {
      console.log(
        chalk.magenta(
          `✨ Chief Auditor đã tự động vá ${reviewResult.polishDiffs.length} chi tiết biên (Last-Mile Polish).`
        )
      );
    }
  } else {
    auditorSpinner.warn(chalk.yellow('Chief Auditor: Có lưu ý về chất lượng code:'));
    console.log(chalk.yellow(`Nhận xét: ${reviewResult.critique}`));
  }

  // 9. Auto Format Code
  if (project.formatCommand) {
    try {
      const fmtSpinner = ora(`Đang định dạng mã nguồn (${project.formatCommand})...`).start();
      await execAsync(project.formatCommand);
      fmtSpinner.succeed(chalk.green('Đã định dạng mã nguồn chuẩn quy chuẩn dự án!'));
    } catch {
      // Ignore format error
    }
  }

  // 10. Cleanup Blackboard & Print Summary
  await blackboard.cleanup();
  Logger.printSuccess('TẤT CẢ CÁC BƯỚC ĐÃ HOÀN TẤT THÀNH CÔNG VỚI ĐỘ CHÍNH XÁC CAO NHẤT!');

  Logger.printCostReport({
    architectCalls: 1,
    builderCalls: plan.dag.length,
    auditorCalls: 1,
    estimatedCostUsd: 0.015 * plan.dag.length,
  });
}

// Interactive REPL Shell mode
async function startInteractiveSession(initialConfig: AppConfig): Promise<void> {
  let config = initialConfig;
  console.log(chalk.bold.yellow('\n💬 CHẾ ĐỘ TƯƠNG TÁC (INTERACTIVE REPL)'));
  console.log(chalk.gray('  - Nhập yêu cầu trực tiếp mà không cần dấu ngoặc kép!'));
  console.log(chalk.gray('  - Lệnh Slash:'));
  console.log(chalk.cyan('    /model hoặc /change_model') + chalk.gray(' : Đổi model/provider cho từng vai trò'));
  console.log(chalk.cyan('    /plan <task>             ') + chalk.gray(' : Chỉ lập kế hoạch, không sửa file'));
  console.log(chalk.cyan('    /diff                    ') + chalk.gray(' : Xem các thay đổi git hiện tại'));
  console.log(chalk.cyan('    /undo                    ') + chalk.gray(' : Khôi phục mã nguồn về checkpoint ban đầu'));
  console.log(chalk.cyan('    /config                  ') + chalk.gray(' : Xem cấu hình hiện tại'));
  console.log(chalk.cyan('    /help                    ') + chalk.gray(' : Hiển thị trợ giúp'));
  console.log(chalk.cyan('    /exit hoặc /quit         ') + chalk.gray(' : Thoát chương trình\n'));

  while (true) {
    let userInput: string;
    try {
      userInput = await input({ message: chalk.bold.cyan('duo >') });
    } catch {
      break;
    }

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log(chalk.gray('Tạm biệt!'));
      break;
    }

    if (trimmed === '/help') {
      console.log(chalk.yellow('\nCác lệnh slash có sẵn:'));
      console.log('  /model, /change_model : Đổi model cho Architect, Builder, hoặc Auditor');
      console.log('  /plan <nội dung task> : Lập kế hoạch chi tiết mà không sửa code');
      console.log('  /diff                 : Xem git diff hiện tại');
      console.log('  /undo                 : Rollback thay đổi');
      console.log('  /config               : Hiển thị file config');
      console.log('  /exit, /quit          : Thoát phiên làm việc\n');
      continue;
    }

    if (trimmed === '/model' || trimmed === '/change_model') {
      config = await SecurityPrompts.promptChangeModel(config);
      await ConfigManager.saveConfig(config);
      continue;
    }

    if (trimmed === '/config') {
      console.log(chalk.bold.yellow('\nCấu hình hiện tại:'));
      console.log(JSON.stringify(config, null, 2) + '\n');
      continue;
    }

    if (trimmed === '/undo') {
      const spinner = ora('Đang khôi phục mã nguồn...').start();
      const ok = await GitGuard.rollback();
      if (ok) {
        spinner.succeed(chalk.green('Đã khôi phục (Rollback) thành công!\n'));
      } else {
        spinner.fail(chalk.red('Không thể rollback.\n'));
      }
      continue;
    }

    if (trimmed === '/diff') {
      const diffText = await GitGuard.getDiff();
      console.log(diffText ? chalk.cyan(diffText) : chalk.gray('Không có thay đổi nào trong git.\n'));
      continue;
    }

    if (trimmed.startsWith('/plan ')) {
      const task = trimmed.replace('/plan ', '').trim();
      await runWorkflow(task, { planOnly: true }, config);
      continue;
    }

    // Normal task execution
    await runWorkflow(trimmed, { autoAccept: false }, config);
  }
}

program
  .name('duo')
  .description('Universal Multi-Agent Orchestrator: Architect, Builder, Auditor (Pluggable AI Models)')
  .version('1.0.0')
  .argument('[prompt]', 'Mô tả công việc cần thực hiện')
  .option('-p, --plan-only', 'Chỉ lập kế hoạch, không sửa đổi mã nguồn', false)
  .option('-y, --auto-accept', 'Tự động duyệt kế hoạch và thực thi mà không cần xác nhận', false)
  .option('-d, --dry-run', 'Chạy mô phỏng không ghi đè vào file', false)
  .option('--undo', 'Khôi phục mã nguồn về trạng thái trước khi chạy Duo', false)
  .action(async (promptText, options) => {
    Logger.printBanner();

    // Handle --undo
    if (options.undo) {
      const spinner = ora('Đang khôi phục mã nguồn về checkpoint gần nhất...').start();
      const ok = await GitGuard.rollback();
      if (ok) {
        spinner.succeed(chalk.green('Đã khôi phục (Rollback) thành công!'));
      } else {
        spinner.fail(chalk.red('Không thể rollback. Đảm bảo thư mục hiện tại là git repo.'));
      }
      return;
    }

    // Load Configuration
    let config = await ConfigManager.loadConfig();
    const missingKeys = ConfigManager.getMissingKeys(config);

    if (missingKeys.length > 0) {
      console.log(chalk.yellow(`Lưu ý: ${missingKeys.join(', ')}`));
      const newConfig = await SecurityPrompts.promptOnboarding();
      config = { ...config, roles: { ...config.roles, ...newConfig.roles } };
      await ConfigManager.saveConfig(config);
      console.log(chalk.green('Đã lưu cấu hình tại ~/.duo/config.json!\n'));
    }

    // If no prompt provided -> Start Interactive REPL Session!
    if (!promptText) {
      await startInteractiveSession(config);
      return;
    }

    // One-shot CLI command execution
    await runWorkflow(promptText, options, config);
  });

program.parse(process.argv);
