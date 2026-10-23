#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

import { ConfigManager } from './config/manager.js';
import { ProjectDetector } from './detector/project.js';
import { GitGuard } from './core/git-guard.js';
import { CodeGraph } from './core/codegraph.js';
import { Blackboard } from './core/blackboard.js';
import { DAGScheduler } from './core/scheduler.js';
import { SessionManager } from './core/session.js';
import { ActivityLogger, ActivityMonitor } from './core/monitor.js';
import { i18n } from './ui/i18n.js';
import { THEMES } from './ui/theme.js';
import { ProviderFactory } from './providers/factory.js';
import { ArchitectAgent } from './agents/architect.js';
import { BuilderAgent } from './agents/builder.js';
import { AuditorAgent } from './agents/auditor.js';
import { Logger } from './ui/logger.js';
import { SecurityPrompts } from './ui/prompts.js';
import { AppConfig, ExecutionOptions, SessionData } from './types/index.js';

const execAsync = promisify(exec);
const program = new Command();

function promptUser(promptText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });

    rl.on('SIGINT', () => {
      rl.close();
      console.log();
      process.exit(0);
    });
  });
}

async function runWorkflow(
  promptText: string,
  options: ExecutionOptions,
  config: AppConfig,
  sessionManager: SessionManager,
  session: SessionData
): Promise<void> {
  const isEn = config.language === 'en';

  // 1. Detect Project Stack & Rules
  const project = await ProjectDetector.detect();
  Logger.printInfo(
    `${isEn ? 'Detected project:' : 'Phát hiện dự án:'} ${chalk.bold(project.type.toUpperCase())} (${project.language})` +
      (project.ruleFile ? ` | ${isEn ? 'Rules:' : 'Quy ước:'} ${chalk.cyan(project.ruleFile)}` : '')
  );

  // 2. Create Safety Checkpoint
  const checkpointRef = await GitGuard.createCheckpoint();
  if (checkpointRef) {
    Logger.printInfo(`${isEn ? 'Safety checkpoint created' : 'Checkpoint an toàn'}: [${checkpointRef.slice(0, 7)}]`);
  }

  // 3. Build CodeGraph Skeleton
  const spinner = ora(isEn ? 'Extracting CodeGraph skeleton...' : 'Đang phân tích cấu trúc mã nguồn (CodeGraph)...').start();
  const codeSkeleton = await CodeGraph.generateSkeleton();
  spinner.succeed(chalk.green(isEn ? 'CodeGraph skeleton ready' : 'Đã phân tích xong CodeGraph'));

  // 4. Architect Phase (Reasoning Model)
  spinner.start(isEn ? `Architect (${config.roles.architect.model}): Planning...` : `Architect (${config.roles.architect.model}): Đang lập kế hoạch...`);
  const architectProvider = ProviderFactory.create(config.roles.architect);
  const architect = new ArchitectAgent(architectProvider);

  let plan;
  try {
    plan = await architect.plan(promptText, codeSkeleton, project.ruleContent);
    spinner.succeed(chalk.green(isEn ? 'Architect: Plan ready' : 'Architect: Kế hoạch hoàn tất'));
    await ActivityLogger.log('architect', `Kế hoạch: ${plan.goal}`, plan.summary);
  } catch (err: any) {
    spinner.fail(chalk.red(`${isEn ? 'Planning error:' : 'Lỗi lập kế hoạch:'} ${err.message}`));
    await ActivityLogger.log('architect', `Lỗi lập kế hoạch: ${err.message}`);
    return;
  }

  // 5. Handle --plan-only
  if (options.planOnly) {
    await fs.ensureDir('.duo');
    await fs.writeFile(
      path.join('.duo', 'plan.md'),
      `# Plan: ${plan.goal}\n\n${plan.summary}\n\n` +
        plan.dag
          .map(
            (s) =>
              `### [${s.id}] ${s.title}\n- Files: ${s.target_files.join(', ')}\n- Instructions: ${s.instructions}\n- Test: ${s.verification_cmd || 'N/A'}`
          )
          .join('\n\n')
    );
    console.log(
      chalk.green(
        isEn
          ? `\n+ Plan saved to .duo/plan.md (Plan-Only mode). Source code untouched.`
          : `\n+ Đã lưu kế hoạch vào .duo/plan.md (Chế độ Plan-Only). Mã nguồn không đổi.`
      )
    );
    return;
  }

  // 6. Human-in-the-Loop Gate (Plan Approval)
  if (!options.autoAccept) {
    const decision = await SecurityPrompts.promptPlanApproval(plan);
    if (decision === 'abort') {
      console.log(chalk.gray(isEn ? '\nExecution aborted.' : '\nĐã hủy bỏ thực thi.'));
      return;
    }
  }

  // 7. Builder Phase (Concurrent Execution via DAG Scheduler)
  console.log(
    chalk.cyan(
      `\nBuilder (${config.roles.builder.model}): ${isEn ? 'Executing tasks...' : 'Thực thi nhiệm vụ...'}\n`
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
      stepSpinners[step.id] = ora(`[${step.id}] ${step.title}`).start();
      ActivityLogger.log('builder', `[${step.id}] Bắt đầu: ${step.title}`, step.instructions);
    },
    onStepComplete: (step, res) => {
      if (stepSpinners[step.id]) {
        stepSpinners[step.id].succeed(
          chalk.green(`[${step.id}] ${step.title} (${res.modifiedFiles.join(', ')})`)
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
    Logger.printError(isEn ? 'Execution paused due to errors.' : 'Một số bước bị lỗi. Tạm dừng thực thi.');
    console.log(chalk.gray(isEn ? "Run 'duo --undo' or use '/undo' to rollback." : "Gõ 'duo --undo' hoặc dùng '/undo' để khôi phục."));
    return;
  }

  // 8. Chief Auditor Phase (Final Review & Last-Mile Polish)
  const auditorSpinner = ora(
    isEn
      ? `Auditor (${config.roles.auditor.model}): Reviewing git diff...`
      : `Auditor (${config.roles.auditor.model}): Đang duyệt Git diff...`
  ).start();
  const auditorProvider = ProviderFactory.create(config.roles.auditor);
  const auditor = new AuditorAgent(auditorProvider);

  const accumulatedDiff = await GitGuard.getDiff(checkpointRef || 'HEAD');
  const reviewResult = await auditor.review(plan.goal, accumulatedDiff, project.ruleContent);

  if (reviewResult.approved) {
    auditorSpinner.succeed(chalk.green(isEn ? 'Auditor: Quality approved (Pass)' : 'Auditor: Phê duyệt (Pass)'));
    if (reviewResult.critique) {
      console.log(chalk.gray(`Critique: ${reviewResult.critique}`));
    }
    await ActivityLogger.log('auditor', 'Auditor: Phê duyệt (Pass)', reviewResult.critique);
    if (reviewResult.polishDiffs && reviewResult.polishDiffs.length > 0) {
      console.log(
        chalk.green(
          isEn
            ? `+ Auditor polished ${reviewResult.polishDiffs.length} edge details.`
            : `+ Auditor đã hoàn thiện ${reviewResult.polishDiffs.length} chi tiết biên.`
        )
      );
      await ActivityLogger.log('auditor', `Tự động vá ${reviewResult.polishDiffs.length} chi tiết biên`);
    }
  } else {
    auditorSpinner.warn(chalk.yellow(isEn ? 'Auditor advisory:' : 'Auditor lưu ý:'));
    console.log(chalk.gray(`Critique: ${reviewResult.critique}`));
    await ActivityLogger.log('auditor', 'Auditor: Lưu ý', reviewResult.critique);
  }

  // 9. Auto Format Code
  if (project.formatCommand) {
    try {
      const fmtSpinner = ora(isEn ? 'Formatting code...' : 'Đang định dạng mã nguồn...').start();
      await execAsync(project.formatCommand);
      fmtSpinner.succeed(chalk.green(isEn ? 'Code formatted' : 'Đã định dạng mã nguồn'));
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
  Logger.printSuccess(isEn ? 'Execution completed successfully' : 'Hoàn tất thành công');

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

  console.log(chalk.white.bold('\nSessions:'));
  if (sessions.length === 0) {
    console.log(chalk.gray('  No saved sessions found.'));
    return;
  }

  for (const s of sessions) {
    const isActive = s.id === activeId;
    const marker = isActive ? chalk.green('* ') : chalk.gray('  ');
    const title = isActive ? chalk.bold.white(s.title) : chalk.white(s.title);
    const date = new Date(s.updatedAt).toLocaleString();
    console.log(`${marker}${chalk.cyan(`[${s.id}]`)} ${title}`);
    console.log(
      chalk.gray(`     ${s.records.length} tasks • Updated: ${date}`)
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

  const isEn = config.language === 'en';
  console.log(chalk.gray(`\nDuo Shell (v1.0.0)`));
  console.log(chalk.gray(isEn 
    ? 'Type your prompt directly, or /help for commands.\n' 
    : 'Nhập yêu cầu trực tiếp, hoặc gõ /help để xem trợ giúp.\n'
  ));

  while (true) {
    const isCustomSession = currentSession.title && !['default', 'mặc định', 'phiên mới', 'main'].includes(currentSession.title.toLowerCase());
    const promptLabel = isCustomSession ? `duo (${currentSession.title}) > ` : 'duo > ';

    let userInput: string;
    try {
      userInput = await promptUser(chalk.bold.cyan(promptLabel));
    } catch {
      break;
    }

    let action = userInput.trim();
    if (!action) continue;

    // Run direct system shell command with ! prefix
    if (action.startsWith('!')) {
      const shCmd = action.slice(1).trim();
      if (shCmd) {
        try {
          const { stdout, stderr } = await execAsync(shCmd);
          if (stdout) console.log(stdout.trimEnd());
          if (stderr) console.error(chalk.yellow(stderr.trimEnd()));
        } catch (err: any) {
          console.error(chalk.red(err.message));
        }
      }
      continue;
    }

    // Auto-normalize if user enters terminal commands starting with 'duo' inside the shell
    if (action.startsWith('duo ') || action === 'duo') {
      const duoArg = action.replace(/^duo\s*/, '').trim();
      if (duoArg === '--undo' || duoArg === 'undo') {
        action = '/undo';
      } else if (duoArg === '--sessions' || duoArg === 'sessions') {
        action = '/sessions';
      } else if (duoArg === 'help' || duoArg === '--help' || duoArg === '-h') {
        action = '/help';
      } else if (duoArg.startsWith('-p ') || duoArg.startsWith('--plan-only ')) {
        action = '/plan ' + duoArg.replace(/^(-p|--plan-only)\s+/, '').replace(/^["']|["']$/g, '');
      } else if (duoArg) {
        action = duoArg.replace(/^["']|["']$/g, '');
      } else {
        continue;
      }
    }

    if (action === '/exit' || action === '/quit') {
      console.log(chalk.gray(isEn ? 'Goodbye!' : 'Tạm biệt!'));
      break;
    }

    if (action === '/clear') {
      console.clear();
      continue;
    }

    if (action === '/help') {
      i18n.printHelp();
      continue;
    }

    if (action === '/lang' || action === '/language') {
      config = await SecurityPrompts.promptSelectLanguage(config);
      i18n.setLanguage(config.language || 'vi');
      await ConfigManager.saveConfig(config);
      continue;
    }

    if (action === '/theme') {
      config = await SecurityPrompts.promptSelectTheme(config);
      await ConfigManager.saveConfig(config);
      Logger.printBanner(config.theme);
      continue;
    }

    if (action === '/sessions') {
      await printSessionsList(sessionManager);
      continue;
    }

    if (action.startsWith('/switch ')) {
      const target = action.replace('/switch ', '').trim();
      try {
        currentSession = await sessionManager.switchSession(target);
        console.log(chalk.green(`\n+ Switched to session: ${currentSession.title} [${currentSession.id}]\n`));
      } catch (e: any) {
        console.log(chalk.red(`\n! ${e.message}\n`));
      }
      continue;
    }

    if (action.startsWith('/new ')) {
      const title = action.replace('/new ', '').trim();
      currentSession = await sessionManager.createSession(title);
      console.log(chalk.green(`\n+ Created session: ${currentSession.title} [${currentSession.id}]\n`));
      continue;
    }

    if (action === '/session') {
      console.log(chalk.white.bold(`\nSession: ${currentSession.title}`));
      console.log(chalk.gray(`- ID:        ${currentSession.id}`));
      console.log(chalk.gray(`- Created:   ${new Date(currentSession.createdAt).toLocaleString()}`));
      console.log(chalk.gray(`- Updated:   ${new Date(currentSession.updatedAt).toLocaleString()}`));
      console.log(chalk.gray(`- Tasks:     ${currentSession.records.length}`));
      if (currentSession.records.length > 0) {
        console.log(chalk.gray('\nCompleted tasks:'));
        currentSession.records.forEach((r, idx) => {
          console.log(chalk.gray(`  ${idx + 1}. ${r.goal} (${r.modifiedFiles.join(', ')})`));
        });
      }
      console.log();
      continue;
    }

    if (action === '/model' || action === '/change_model') {
      config = await SecurityPrompts.promptChangeModel(config);
      await ConfigManager.saveConfig(config);
      continue;
    }

    if (action === '/config') {
      console.log(chalk.white.bold('\nConfig:'));
      console.log(chalk.gray(JSON.stringify(config, null, 2)) + '\n');
      continue;
    }

    if (action === '/undo') {
      const spinner = ora(isEn ? 'Rolling back changes...' : 'Đang khôi phục mã nguồn...').start();
      const ok = await GitGuard.rollback();
      if (ok) {
        spinner.succeed(chalk.green(isEn ? 'Rollback completed\n' : 'Đã khôi phục thành công!\n'));
      } else {
        spinner.fail(chalk.red(isEn ? 'Rollback failed\n' : 'Không thể rollback.\n'));
      }
      continue;
    }

    if (action === '/diff') {
      const diffText = await GitGuard.getDiff();
      console.log(diffText ? chalk.cyan(diffText) : chalk.gray(isEn ? 'No uncommitted changes.\n' : 'Không có thay đổi nào trong git.\n'));
      continue;
    }

    if (action.startsWith('/plan ')) {
      const task = action.replace('/plan ', '').trim();
      await runWorkflow(task, { planOnly: true }, config, sessionManager, currentSession);
      continue;
    }

    // Normal task execution
    await runWorkflow(action, { autoAccept: false }, config, sessionManager, currentSession);
  }
}

program
  .command('monitor')
  .description('Live Monitor activity & diff watcher')
  .action(async () => {
    await ActivityMonitor.start();
  });

program
  .command('lang [language]')
  .description('Set or switch interface language (en / vi)')
  .action(async (langArg) => {
    let config = await ConfigManager.loadConfig();
    if (langArg === 'en' || langArg === 'vi') {
      config.language = langArg;
      await ConfigManager.saveConfig(config);
      console.log(
        chalk.green(
          langArg === 'en'
            ? '+ Interface language set to English'
            : '+ Đã thiết lập ngôn ngữ giao diện sang Tiếng Việt'
        )
      );
    } else {
      config = await SecurityPrompts.promptSelectLanguage(config);
      await ConfigManager.saveConfig(config);
    }
  });

program
  .command('help')
  .description('Display command reference and help guide')
  .action(async () => {
    const config = await ConfigManager.loadConfig();
    i18n.setLanguage(config.language || 'vi');
    i18n.printHelp();
  });

program
  .command('theme [themeName]')
  .description('Terminal theme: cyber, dracula, nord, monokai, matrix, sunset')
  .action(async (themeArg) => {
    let config = await ConfigManager.loadConfig();
    if (themeArg && THEMES[themeArg]) {
      config.theme = themeArg;
      await ConfigManager.saveConfig(config);
      Logger.printBanner(config.theme);
      console.log(chalk.green(`+ Theme set to: ${THEMES[themeArg].name}`));
    } else {
      config = await SecurityPrompts.promptSelectTheme(config);
      await ConfigManager.saveConfig(config);
      Logger.printBanner(config.theme);
    }
  });

program
  .name('duo')
  .description('Universal Multi-Agent Orchestrator: Architect, Builder, Auditor')
  .version('1.0.0')
  .argument('[prompt]', 'Task description to execute')
  .option('-p, --plan-only', 'Generate plan only without modifying code', false)
  .option('-y, --auto-accept', 'Autonomous execution without plan confirmation', false)
  .option('-d, --dry-run', 'Simulation mode without writing files', false)
  .option('--undo', 'Rollback working tree to initial checkpoint', false)
  .option('-r, --resume [sessionId]', 'Resume previous session (default: latest)')
  .option('--sessions', 'List all saved sessions', false)
  .action(async (promptText, options) => {
    // Load Configuration
    let config = await ConfigManager.loadConfig();
    i18n.setLanguage(config.language || 'vi');

    Logger.printBanner(config.theme);

    const sessionManager = new SessionManager();

    // Handle --sessions command
    if (options.sessions) {
      await printSessionsList(sessionManager);
      return;
    }

    // Handle --undo
    if (options.undo) {
      const isEn = config.language === 'en';
      const spinner = ora(isEn ? 'Rolling back changes...' : 'Đang khôi phục mã nguồn về checkpoint...').start();
      const ok = await GitGuard.rollback();
      if (ok) {
        spinner.succeed(chalk.green(isEn ? 'Rollback completed' : 'Đã khôi phục thành công!'));
      } else {
        spinner.fail(chalk.red(isEn ? 'Rollback failed' : 'Không thể rollback. Đảm bảo thư mục hiện tại là git repo.'));
      }
      return;
    }

    const missingKeys = ConfigManager.getMissingKeys(config);

    if (missingKeys.length > 0) {
      console.log(chalk.yellow(`Notice: ${missingKeys.join(', ')}`));
      const newConfig = await SecurityPrompts.promptOnboarding();
      config = { ...config, roles: { ...config.roles, ...newConfig.roles } };
      await ConfigManager.saveConfig(config);
      console.log(chalk.green('+ Saved configuration at ~/.duo/config.json\n'));
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
