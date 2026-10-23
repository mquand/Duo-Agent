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
import { SessionManager } from './core/session.js';
import { ActivityLogger, ActivityMonitor } from './core/monitor.js';
import { ProviderFactory } from './providers/factory.js';
import { ArchitectAgent } from './agents/architect.js';
import { BuilderAgent } from './agents/builder.js';
import { AuditorAgent } from './agents/auditor.js';
import { Logger } from './ui/logger.js';
import { SecurityPrompts } from './ui/prompts.js';
import { AppConfig, ExecutionOptions, SessionData } from './types/index.js';

const execAsync = promisify(exec);
const program = new Command();

async function runWorkflow(
  promptText: string,
  options: ExecutionOptions,
  config: AppConfig,
  sessionManager: SessionManager,
  session: SessionData
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
    await ActivityLogger.log('architect', `Kế hoạch: ${plan.goal}`, plan.summary);
  } catch (err: any) {
    spinner.fail(chalk.red(`Lỗi lập kế hoạch: ${err.message}`));
    await ActivityLogger.log('architect', `Lỗi lập kế hoạch: ${err.message}`);
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
      ActivityLogger.log('builder', `[${step.id}] Bắt đầu: ${step.title}`, step.instructions);
    },
    onStepComplete: (step, res) => {
      if (stepSpinners[step.id]) {
        stepSpinners[step.id].succeed(
          chalk.green(`[${step.id}] Hoàn thành: ${step.title} (${res.modifiedFiles.join(', ')})`)
        );
      }
      ActivityLogger.log('builder', `[${step.id}] Hoàn thành: ${step.title}`, res.findings);
    },
    onStepError: (step, err) => {
      if (stepSpinners[step.id]) {
        stepSpinners[step.id].fail(chalk.red(`[${step.id}] Lỗi: ${err}`));
      }
      ActivityLogger.log('builder', `[${step.id}] Lỗi: ${err}`);
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
    await ActivityLogger.log('auditor', 'Chief Auditor: PHÊ DUYỆT (PASS)', reviewResult.critique);
    if (reviewResult.polishDiffs && reviewResult.polishDiffs.length > 0) {
      console.log(
        chalk.magenta(
          `✨ Chief Auditor đã tự động vá ${reviewResult.polishDiffs.length} chi tiết biên (Last-Mile Polish).`
        )
      );
      await ActivityLogger.log('auditor', `Tự động vá ${reviewResult.polishDiffs.length} chi tiết biên (Last-Mile Polish)`);
    }
  } else {
    auditorSpinner.warn(chalk.yellow('Chief Auditor: Có lưu ý về chất lượng code:'));
    console.log(chalk.yellow(`Nhận xét: ${reviewResult.critique}`));
    await ActivityLogger.log('auditor', 'Chief Auditor: CÓ LƯU Ý', reviewResult.critique);
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

  // 10. Record Task to Current Session
  await sessionManager.recordTask(
    session,
    `task-${Date.now()}`,
    plan.goal,
    plan.dag.flatMap((s) => s.target_files),
    reviewResult.critique
  );

  // 11. Cleanup Blackboard & Print Summary
  await blackboard.cleanup();
  Logger.printSuccess('TẤT CẢ CÁC BƯỚC ĐÃ HOÀN TẤT THÀNH CÔNG VỚI ĐỘ CHÍNH XÁC CAO NHẤT!');

  Logger.printCostReport({
    architectCalls: 1,
    builderCalls: plan.dag.length,
    auditorCalls: 1,
    estimatedCostUsd: 0.015 * plan.dag.length,
  });
}

// Print formatted list of sessions
async function printSessionsList(sessionManager: SessionManager): Promise<void> {
  const sessions = await sessionManager.listSessions();
  const activeId = await sessionManager.getActiveId();

  console.log(chalk.bold.yellow('\n📋 DANH SÁCH CÁC PHIÊN LÀM VIỆC (SESSIONS):'));
  if (sessions.length === 0) {
    console.log(chalk.gray('  Chưa có phiên làm việc nào được lưu.'));
    return;
  }

  for (const s of sessions) {
    const isActive = s.id === activeId;
    const marker = isActive ? chalk.bold.green('▶ (active) ') : chalk.gray('  ');
    const title = isActive ? chalk.bold.white(s.title) : chalk.white(s.title);
    const date = new Date(s.updatedAt).toLocaleString();
    console.log(`${marker}${chalk.cyan(`[${s.id}]`)} ${title}`);
    console.log(
      chalk.gray(`     Đã hoàn thành ${s.records.length} tasks • Cập nhật: ${date}`)
    );
  }
  console.log();
}

// Interactive REPL Shell mode
async function startInteractiveSession(initialConfig: AppConfig, initialSessionId?: string): Promise<void> {
  let config = initialConfig;
  const sessionManager = new SessionManager();
  let currentSession = initialSessionId
    ? await sessionManager.switchSession(initialSessionId)
    : await sessionManager.getActiveSession();

  console.log(chalk.bold.yellow('\n💬 CHẾ ĐỘ TƯƠNG TÁC (INTERACTIVE REPL)'));
  console.log(chalk.gray(`  Phiên hiện tại: `) + chalk.bold.green(`${currentSession.title} [${currentSession.id}]`));
  console.log(chalk.gray('  - Nhập yêu cầu trực tiếp mà không cần dấu ngoặc kép!'));
  console.log(chalk.gray('  - Lệnh Slash Quản lý Phiên (Sessions):'));
  console.log(chalk.cyan('    /sessions                ') + chalk.gray(' : Xem danh sách các phiên làm việc'));
  console.log(chalk.cyan('    /switch <id hoặc tên>    ') + chalk.gray(' : Chuyển sang phiên làm việc khác'));
  console.log(chalk.cyan('    /new <tên phiên>         ') + chalk.gray(' : Tạo phiên làm việc mới (ngữ cảnh sạch)'));
  console.log(chalk.cyan('    /session                 ') + chalk.gray(' : Xem thông tin chi tiết phiên hiện tại'));
  console.log(chalk.gray('  - Lệnh Slash Hệ thống:'));
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
      userInput = await input({ message: chalk.bold.cyan(`duo [${currentSession.title}] >`) });
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
      console.log('  /sessions              : Danh sách tất cả các phiên làm việc');
      console.log('  /switch <id|tên>       : Chuyển sang phiên làm việc khác');
      console.log('  /new <tên>             : Tạo một phiên làm việc mới');
      console.log('  /session               : Xem chi tiết tiến độ của phiên hiện tại');
      console.log('  /model, /change_model  : Đổi model cho Architect, Builder, hoặc Auditor');
      console.log('  /plan <nội dung task>  : Lập kế hoạch chi tiết mà không sửa code');
      console.log('  /diff                  : Xem git diff hiện tại');
      console.log('  /undo                  : Rollback thay đổi');
      console.log('  /config                : Hiển thị file config');
      console.log('  /exit, /quit           : Thoát phiên làm việc\n');
      continue;
    }

    if (trimmed === '/sessions') {
      await printSessionsList(sessionManager);
      continue;
    }

    if (trimmed.startsWith('/switch ')) {
      const target = trimmed.replace('/switch ', '').trim();
      try {
        currentSession = await sessionManager.switchSession(target);
        console.log(chalk.green(`\n✔ Đã chuyển sang phiên: ${chalk.bold(currentSession.title)} [${currentSession.id}]\n`));
      } catch (e: any) {
        console.log(chalk.red(`\n✖ ${e.message}\n`));
      }
      continue;
    }

    if (trimmed.startsWith('/new ')) {
      const title = trimmed.replace('/new ', '').trim();
      currentSession = await sessionManager.createSession(title);
      console.log(chalk.green(`\n✔ Đã tạo và kích hoạt phiên mới: ${chalk.bold(currentSession.title)} [${currentSession.id}]\n`));
      continue;
    }

    if (trimmed === '/session') {
      console.log(chalk.bold.yellow(`\n📌 THÔNG TIN PHIÊN: ${currentSession.title}`));
      console.log(chalk.gray(`- ID:        ${currentSession.id}`));
      console.log(chalk.gray(`- Tạo lúc:   ${new Date(currentSession.createdAt).toLocaleString()}`));
      console.log(chalk.gray(`- Cập nhật:  ${new Date(currentSession.updatedAt).toLocaleString()}`));
      console.log(chalk.gray(`- Số tasks:  ${currentSession.records.length}`));
      if (currentSession.records.length > 0) {
        console.log(chalk.yellow('\nCác task đã hoàn thành trong phiên:'));
        currentSession.records.forEach((r, idx) => {
          console.log(`  ${idx + 1}. ${r.goal} (${r.modifiedFiles.join(', ')})`);
        });
      }
      console.log();
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
      await runWorkflow(task, { planOnly: true }, config, sessionManager, currentSession);
      continue;
    }

    // Normal task execution
    await runWorkflow(trimmed, { autoAccept: false }, config, sessionManager, currentSession);
  }
}

program
  .command('monitor')
  .description('Mở màn hình Live Monitor theo dõi trực tiếp hoạt động của Agent và code diff theo thời gian thực')
  .action(async () => {
    await ActivityMonitor.start();
  });

program
  .name('duo')
  .description('Universal Multi-Agent Orchestrator: Architect, Builder, Auditor (Pluggable AI Models)')
  .version('1.0.0')
  .argument('[prompt]', 'Mô tả công việc cần thực hiện')
  .option('-p, --plan-only', 'Chỉ lập kế hoạch, không sửa đổi mã nguồn', false)
  .option('-y, --auto-accept', 'Tự động duyệt kế hoạch và thực thi mà không cần xác nhận', false)
  .option('-d, --dry-run', 'Chạy mô phỏng không ghi đè vào file', false)
  .option('--undo', 'Khôi phục mã nguồn về trạng thái trước khi chạy Duo', false)
  .option('-r, --resume [sessionId]', 'Tiếp tục phiên làm việc trước đó (mặc định là phiên gần nhất)')
  .option('--sessions', 'Hiển thị danh sách tất cả các phiên làm việc đã lưu', false)
  .action(async (promptText, options) => {
    Logger.printBanner();

    const sessionManager = new SessionManager();

    // Handle --sessions command
    if (options.sessions) {
      await printSessionsList(sessionManager);
      return;
    }

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

    // Resolve target session
    let targetSession: SessionData;
    if (typeof options.resume === 'string') {
      targetSession = await sessionManager.switchSession(options.resume);
    } else {
      targetSession = await sessionManager.getActiveSession();
    }

    // If no prompt provided -> Start Interactive REPL Session!
    if (!promptText) {
      await startInteractiveSession(config, targetSession.id);
      return;
    }

    // One-shot CLI command execution
    await runWorkflow(promptText, options, config, sessionManager, targetSession);
  });

program.parse(process.argv);
