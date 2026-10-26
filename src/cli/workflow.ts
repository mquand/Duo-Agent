import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import { ProjectDetector } from '../detector/project.js';
import { GitGuard } from '../core/git-guard.js';
import { CodeGraph } from '../core/codegraph.js';
import { Blackboard } from '../core/blackboard.js';
import { DAGScheduler } from '../core/scheduler.js';
import { SessionManager } from '../core/session.js';
import { ActivityLogger } from '../core/monitor.js';
import { ProviderFactory } from '../providers/factory.js';
import { ArchitectAgent } from '../agents/architect.js';
import { BuilderAgent } from '../agents/builder.js';
import { AuditorAgent } from '../agents/auditor.js';
import { Logger } from '../ui/logger.js';
import { SecurityPrompts } from '../ui/prompts.js';
import { ConfigManager } from '../config/manager.js';
import { WorktreeManager } from '../core/worktree.js';
import { IntegrationManager } from '../core/integration.js';
import { AppConfig, ExecutionOptions, SessionData } from '../types/index.js';

const execAsync = promisify(exec);

export async function runWorkflow(
  promptText: string,
  options: ExecutionOptions,
  config: AppConfig,
  sessionManager: SessionManager,
  session: SessionData
): Promise<void> {
  const isEn = config.language === 'en';

  // 0. Pre-Flight Validation of API Keys
  const missingKeys = ConfigManager.getMissingKeys(config, isEn);
  if (missingKeys.length > 0) {
    console.log(chalk.red.bold(`\n✖ ${isEn ? 'Missing API Key configuration:' : 'Chưa cấu hình API Key đầy đủ:'}`));
    for (const msg of missingKeys) {
      console.log(chalk.red(`  • ${msg}`));
    }
    console.log(chalk.gray(isEn
      ? `\n  -> Type ${chalk.cyan('/key')} to enter your API key(s).\n  -> Or type ${chalk.cyan('/model')} to switch to Local Offline (Ollama - 100% Free).\n  -> Or add missing key(s) into ~/.duo/.env.\n`
      : `\n  -> Gõ ${chalk.cyan('/key')} để nhập API key.\n  -> Hoặc gõ ${chalk.cyan('/model')} để chuyển sang Local Offline (Ollama miễn phí).\n  -> Hoặc thêm key vào file ~/.duo/.env.\n`
    ));
    return;
  }

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

  // Detect @file references in prompt and pinned session files
  let augmentedPrompt = promptText;
  const pinnedRegex = /@([a-zA-Z0-9_./\\-]+)/g;
  const matches = [...promptText.matchAll(pinnedRegex)];
  const filesToRead = new Set<string>();

  for (const m of matches) {
    filesToRead.add(m[1]);
  }
  if (session.pinnedFiles) {
    for (const pf of session.pinnedFiles) {
      filesToRead.add(pf);
    }
  }

  let pinnedContent = '';
  for (const relFile of filesToRead) {
    const absPath = path.resolve(process.cwd(), relFile);
    if (await fs.pathExists(absPath)) {
      try {
        const fc = await fs.readFile(absPath, 'utf-8');
        pinnedContent += `\n\n--- [PINNED CONTEXT FILE: ${relFile}] ---\n${fc.slice(0, 6000)}\n--- [END PINNED FILE] ---\n`;
        Logger.printInfo(`${isEn ? 'Pinned context from:' : 'Đã nạp file ngữ cảnh ưu tiên:'} ${chalk.cyan(relFile)}`);
      } catch {}
    }
  }

  if (session.summary) {
    pinnedContent += `\n\n--- [PAST ARCHITECTURAL MEMORY] ---\n${session.summary}\n`;
  }

  if (pinnedContent) {
    augmentedPrompt += pinnedContent;
  }

  // 4. Architect Phase (Reasoning Model)
  spinner.start(isEn ? `Architect (${config.roles.architect.model}): Planning...` : `Architect (${config.roles.architect.model}): Đang lập kế hoạch...`);
  const architectProvider = ProviderFactory.create(config.roles.architect);
  const architect = new ArchitectAgent(architectProvider);

  let plan;
  try {
    plan = await architect.plan(augmentedPrompt, codeSkeleton, project.ruleContent);
    spinner.succeed(chalk.green(isEn ? 'Architect: Plan ready' : 'Architect: Kế hoạch hoàn tất'));
    await ActivityLogger.log('architect', isEn ? `Plan: ${plan.goal}` : `Kế hoạch: ${plan.goal}`, plan.summary);
  } catch (err: any) {
    spinner.fail(chalk.red(`${isEn ? 'Planning error:' : 'Lỗi lập kế hoạch:'} ${err.message}`));
    await ActivityLogger.log('architect', isEn ? `Planning error: ${err.message}` : `Lỗi lập kế hoạch: ${err.message}`);
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
    const decision = await SecurityPrompts.promptPlanApproval(plan, isEn);
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
  const executionResult = await scheduler.executePlan(
    plan,
    {
      onStepStart: (step) => {
        stepSpinners[step.id] = ora(`[${step.id}] ${step.title}`).start();
        ActivityLogger.log('builder', isEn ? `[${step.id}] Start: ${step.title}` : `[${step.id}] Bắt đầu: ${step.title}`, step.instructions);
      },
      onStepComplete: (step, res) => {
        if (stepSpinners[step.id]) {
          stepSpinners[step.id].succeed(
            chalk.green(`[${step.id}] ${step.title} (${res.modifiedFiles.join(', ')})`)
          );
        }
        ActivityLogger.log('builder', isEn ? `[${step.id}] Completed: ${step.title}` : `[${step.id}] Hoàn thành: ${step.title}`, res.findings);
      },
      onStepError: (step, err) => {
        if (stepSpinners[step.id]) {
          stepSpinners[step.id].fail(chalk.red(`[${step.id}] ${isEn ? 'Error:' : 'Lỗi:'} ${err}`));
        }
        ActivityLogger.log('builder', `[${step.id}] ${isEn ? 'Error:' : 'Lỗi:'} ${err}`);
      },
    },
    process.cwd(),
    project.ruleContent
  );

  if (!executionResult.success) {
    Logger.printError(isEn ? 'Execution paused due to errors.' : 'Một số bước bị lỗi. Tạm dừng thực thi.');
    console.log(chalk.gray(isEn ? "Run 'duo --undo' or use '/undo' to rollback." : "Gõ 'duo --undo' hoặc dùng '/undo' để khôi phục."));
    return;
  }

  // 8. Chief Auditor Phase (Final Review & Last-Mile Polish)
  let testResults: { passed: boolean; output: string } | undefined;
  if (project.testCommand) {
    const testSpinner = ora(
      isEn
        ? `Auditor: Running project test suite (${project.testCommand})...`
        : `Auditor: Đang chạy kiểm thử tự động (${project.testCommand})...`
    ).start();
    try {
      const { stdout, stderr } = await execAsync(project.testCommand, { cwd: process.cwd() });
      testResults = { passed: true, output: (stdout || stderr || '').trim() };
      testSpinner.succeed(chalk.green(isEn ? 'Auditor: Tests verified (PASS)' : 'Auditor: Kiểm thử thành công (PASS)'));
    } catch (cmdErr: any) {
      const errOut = (cmdErr.stdout || cmdErr.stderr || cmdErr.message || '').trim();
      testResults = { passed: false, output: errOut };
      testSpinner.warn(chalk.yellow(isEn ? 'Auditor: Tests failed (Regressions detected)' : 'Auditor: Kiểm thử thất bại (Phát hiện lỗi)'));
    }
  }

  const auditorSpinner = ora(
    isEn
      ? `Auditor (${config.roles.auditor.model}): Reviewing git diff & test results...`
      : `Auditor (${config.roles.auditor.model}): Đang duyệt Git diff & kết quả kiểm thử...`
  ).start();
  const auditorProvider = ProviderFactory.create(config.roles.auditor);
  const auditor = new AuditorAgent(auditorProvider);

  const accumulatedDiff = await GitGuard.getDiff(checkpointRef || 'HEAD');
  const reviewResult = await auditor.review(
    plan.goal,
    accumulatedDiff,
    project.ruleContent,
    process.cwd(),
    testResults
  );

  if (reviewResult.approved) {
    if (reviewResult.polishDiffs && reviewResult.polishDiffs.length > 0) {
      console.log(
        chalk.green(
          isEn
            ? `+ Auditor polished ${reviewResult.polishDiffs.length} edge details.`
            : `+ Auditor đã hoàn thiện ${reviewResult.polishDiffs.length} chi tiết biên.`
        )
      );
      await ActivityLogger.log('auditor', isEn ? `Auto-polished ${reviewResult.polishDiffs.length} edge details` : `Tự động vá ${reviewResult.polishDiffs.length} chi tiết biên`);

      // Critical ground truth: If Auditor modified code, re-run project test suite!
      if (project.testCommand) {
        try {
          await execAsync(project.testCommand, { cwd: process.cwd() });
          console.log(chalk.green(isEn ? '✔ Post-polish tests re-verified (PASS)' : '✔ Đã kiểm thử lại sau khi vá (PASS)'));
        } catch (reTestErr: any) {
          reviewResult.approved = false;
          reviewResult.critique = isEn
            ? `Auditor polish patch caused test regressions: ${(reTestErr.stderr || reTestErr.message).slice(0, 500)}`
            : `Bản vá polish của Auditor gây lỗi hồi quy test: ${(reTestErr.stderr || reTestErr.message).slice(0, 500)}`;
          console.log(chalk.red(isEn ? '✖ Post-polish test failure! Approval revoked.' : '✖ Bản vá của Auditor làm hỏng test! Thu hồi phê duyệt.'));
        }
      }
    }

    if (reviewResult.approved) {
      auditorSpinner.succeed(chalk.green(isEn ? 'Auditor: Quality approved (Pass)' : 'Auditor: Phê duyệt (Pass)'));
    } else {
      auditorSpinner.fail(chalk.red(isEn ? 'Auditor: Rejected due to post-polish regression' : 'Auditor: Từ chối do lỗi hồi quy sau khi vá'));
    }

    if (reviewResult.critique) {
      console.log(chalk.gray(`Critique: ${reviewResult.critique}`));
    }
    await ActivityLogger.log('auditor', isEn ? 'Auditor: Approved (Pass)' : 'Auditor: Phê duyệt (Pass)', reviewResult.critique);
  } else {
    auditorSpinner.warn(chalk.yellow(isEn ? 'Auditor advisory:' : 'Auditor lưu ý:'));
    console.log(chalk.gray(`Critique: ${reviewResult.critique}`));
    await ActivityLogger.log('auditor', isEn ? 'Auditor: Advisory note' : 'Auditor: Lưu ý', reviewResult.critique);
  }

  if (!project.testCommand) {
    console.log(chalk.yellow(isEn ? 'Notice: No automated test command detected in workspace. Verification status: UNVERIFIED.' : 'Lưu ý: Không tìm thấy lệnh test tự động trong dự án. Trạng thái kiểm thử: UNVERIFIED.'));
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

  // Invalidate CodeGraph cache after code modifications
  CodeGraph.invalidateCache(process.cwd());

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

  const stepCount = plan.dag.length;
  const taskTokens = 2000 + stepCount * 1200 + 1000;
  const taskCost = 0.015 * stepCount + 0.005;

  session.totalTokens = (session.totalTokens || 0) + taskTokens;
  session.estimatedCostUsd = (session.estimatedCostUsd || 0) + taskCost;
  await sessionManager.saveSession(session);

  await ActivityLogger.log(
    'cost',
    isEn ? `Current session: ~$${session.estimatedCostUsd.toFixed(4)} USD` : `Phiên hiện tại: ~$${session.estimatedCostUsd.toFixed(4)} USD`,
    `${session.totalTokens.toLocaleString()} tokens`
  );

  Logger.printCostReport({
    architectCalls: 1,
    builderCalls: stepCount,
    auditorCalls: 1,
    estimatedCostUsd: taskCost,
  }, isEn);
}
