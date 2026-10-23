import readline from 'readline';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { select, confirm } from '@inquirer/prompts';

import { AppConfig, ExecutionOptions, SessionData } from '../types/index.js';
import { SessionManager } from '../core/session.js';
import { HistoryManager } from '../core/history.js';
import { GitGuard } from '../core/git-guard.js';
import { CodeGraph } from '../core/codegraph.js';
import { ActivityLogger } from '../core/monitor.js';
import { BenchmarkRunner } from '../core/benchmark.js';
import { ProjectDetector } from '../detector/project.js';
import { ConfigManager } from '../config/manager.js';
import { SecurityPrompts } from '../ui/prompts.js';
import { ProviderFactory } from '../providers/factory.js';
import { Logger } from '../ui/logger.js';
import { i18n } from '../ui/i18n.js';

const execAsync = promisify(exec);

export const SLASH_COMMANDS_LIST = [
  '/help',
  '/model',
  '/key',
  '/keys',
  '/rules',
  '/effort',
  '/benchmark',
  '/theme',
  '/lang',
  '/cost',
  '/commit',
  '/add',
  '/paste',
  '/compact',
  '/sessions',
  '/switch',
  '/new',
  '/session',
  '/plan',
  '/diff',
  '/undo',
  '/config',
  '/clear',
  '/clear-history',
  '/exit',
  '/quit',
];

export function slashCompleter(line: string): [string[], string] {
  if (line.startsWith('/theme ')) {
    const sub = line.slice(7);
    const themes = ['cyber', 'dracula', 'nord', 'monokai', 'matrix', 'sunset'];
    const hits = themes.filter((t) => t.startsWith(sub)).map((t) => `/theme ${t}`);
    return [hits.length ? hits : themes.map((t) => `/theme ${t}`), line];
  }

  if (line.startsWith('/lang ')) {
    const sub = line.slice(6);
    const langs = ['en', 'vi'];
    const hits = langs.filter((l) => l.startsWith(sub)).map((l) => `/lang ${l}`);
    return [hits.length ? hits : langs.map((l) => `/lang ${l}`), line];
  }

  if (line.startsWith('/')) {
    const hits = SLASH_COMMANDS_LIST.filter((cmd) => cmd.startsWith(line));
    return [hits.length ? hits : SLASH_COMMANDS_LIST, line];
  }

  if (line.startsWith('!')) {
    const sysCmds = ['! git status', '! git diff', '! git log', '! ls', '! npm test', '! mix test'];
    const hits = sysCmds.filter((c) => c.startsWith(line));
    return [hits.length ? hits : sysCmds, line];
  }

  return [[], line];
}

export function promptUser(promptText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: slashCompleter,
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

export async function printSessionsList(sessionManager: SessionManager, isEn: boolean = false): Promise<void> {
  const sessions = await sessionManager.listSessions();
  const activeId = await sessionManager.getActiveId();

  console.log(chalk.white.bold(isEn ? '\nSessions:' : '\nDanh sách phiên làm việc:'));
  if (sessions.length === 0) {
    console.log(chalk.gray(isEn ? '  No saved sessions found.' : '  Chưa có phiên làm việc nào được lưu.'));
    return;
  }

  for (const s of sessions) {
    const isActive = s.id === activeId;
    const marker = isActive ? chalk.green('* ') : chalk.gray('  ');
    const title = isActive ? chalk.bold.white(s.title) : chalk.white(s.title);
    const date = new Date(s.updatedAt).toLocaleString();
    console.log(`${marker}${chalk.cyan(`[${s.id}]`)} ${title}`);
    console.log(
      chalk.gray(`     ${s.records.length} ${isEn ? 'tasks • Updated:' : 'tasks • Cập nhật:'} ${date}`)
    );
  }
  console.log();
}

export interface CommandContext {
  action: string;
  config: AppConfig;
  sessionManager: SessionManager;
  currentSession: SessionData;
  history: string[];
  runWorkflow: (promptText: string, options: ExecutionOptions) => Promise<void>;
}

export interface CommandResult {
  handled: boolean;
  exit?: boolean;
  config?: AppConfig;
  session?: SessionData;
}

export async function handleSlashCommand(context: CommandContext): Promise<CommandResult> {
  let { action, config, sessionManager, currentSession, history, runWorkflow } = context;
  const isEn = config.language === 'en';

  // Interactive Slash Command Picker when user enters '/' alone
  if (action === '/') {
    const chosen = await select({
      message: isEn ? 'Select a command:' : 'Chọn lệnh cần dùng:',
      choices: [
        { name: `${chalk.cyan('/help')}      ${chalk.gray(isEn ? 'Display command reference' : 'Xem trợ giúp tra cứu lệnh')}`, value: '/help' },
        { name: `${chalk.cyan('/model')}     ${chalk.gray(isEn ? 'Switch AI models (Claude 5.5, GPT-6...)' : 'Đổi AI model cho từng vai trò')}`, value: '/model' },
        { name: `${chalk.cyan('/key')}       ${chalk.gray(isEn ? 'Manage, update or remove API keys' : 'Quản lý, đổi hoặc xóa API Key')}`, value: '/key' },
        { name: `${chalk.cyan('/rules')}     ${chalk.gray(isEn ? 'View or configure repo guidelines (.duorules)' : 'Xem hoặc cấu hình quy ước repo (.duorules)')}`, value: '/rules' },
        { name: `${chalk.cyan('/theme')}     ${chalk.gray(isEn ? 'Select terminal color theme' : 'Đổi giao diện màu sắc Terminal')}`, value: '/theme' },
        { name: `${chalk.cyan('/lang')}      ${chalk.gray(isEn ? 'Switch interface language' : 'Đổi ngôn ngữ giao diện (en / vi)')}`, value: '/lang' },
        { name: `${chalk.cyan('/cost')}      ${chalk.gray(isEn ? 'Display cumulative token usage & cost' : 'Thống kê chi phí & tokens của phiên')}`, value: '/cost' },
        { name: `${chalk.cyan('/commit')}    ${chalk.gray(isEn ? 'Auto-generate commit message & commit git' : 'Tự động tạo commit message & commit git')}`, value: '/commit' },
        { name: `${chalk.cyan('/add')}       ${chalk.gray(isEn ? 'Pin file into agent context' : 'Ghim file hoặc thư mục vào ngữ cảnh')}`, value: '/add' },
        { name: `${chalk.cyan('/paste')}     ${chalk.gray(isEn ? 'Enter multi-line paste mode' : 'Chế độ dán nhiều dòng (multiline log/spec)')}`, value: '/paste' },
        { name: `${chalk.cyan('/compact')}   ${chalk.gray(isEn ? 'Summarize past tasks to compress context' : 'Nén và tóm tắt lịch sử task của phiên')}`, value: '/compact' },
        { name: `${chalk.cyan('/sessions')}  ${chalk.gray(isEn ? 'List all saved sessions' : 'Xem danh sách các phiên làm việc')}`, value: '/sessions' },
        { name: `${chalk.cyan('/new')}       ${chalk.gray(isEn ? 'Create a clean session' : 'Tạo phiên làm việc mới')}`, value: '/new' },
        { name: `${chalk.cyan('/switch')}    ${chalk.gray(isEn ? 'Switch to another session' : 'Chuyển sang phiên làm việc khác')}`, value: '/switch' },
        { name: `${chalk.cyan('/session')}   ${chalk.gray(isEn ? 'View active session details' : 'Xem chi tiết phiên hiện tại')}`, value: '/session' },
        { name: `${chalk.cyan('/plan')}      ${chalk.gray(isEn ? 'Generate architectural plan only' : 'Chỉ lập kế hoạch, không sửa file')}`, value: '/plan' },
        { name: `${chalk.cyan('/diff')}      ${chalk.gray(isEn ? 'Preview uncommitted git changes' : 'Xem các thay đổi git hiện tại')}`, value: '/diff' },
        { name: `${chalk.cyan('/undo')}      ${chalk.gray(isEn ? 'Rollback working tree to checkpoint' : 'Khôi phục code về checkpoint an toàn')}`, value: '/undo' },
        { name: `${chalk.cyan('/config')}    ${chalk.gray(isEn ? 'Display active configuration' : 'Xem cấu hình hiện tại')}`, value: '/config' },
        { name: `${chalk.cyan('/clear')}     ${chalk.gray(isEn ? 'Clear terminal screen' : 'Xóa sạch màn hình')}`, value: '/clear' },
        { name: `${chalk.cyan('/clear-history')} ${chalk.gray(isEn ? 'Wipe local history, logs & sessions' : 'Xóa sạch lịch sử lệnh, logs & sessions')}`, value: '/clear-history' },
        { name: `${chalk.cyan('/exit')}      ${chalk.gray(isEn ? 'Exit Duo shell' : 'Thoát chương trình')}`, value: '/exit' },
      ],
    });

    if (chosen === '/plan') {
      const planTask = await promptUser(chalk.bold.cyan(isEn ? 'Enter task for plan-only > ' : 'Nhập yêu cầu chỉ lập kế hoạch > '));
      if (planTask.trim()) {
        await runWorkflow(planTask.trim(), { planOnly: true });
      }
      return { handled: true };
    }

    if (chosen === '/new') {
      const sessionName = await promptUser(chalk.bold.cyan(isEn ? 'New session name > ' : 'Tên phiên mới > '));
      if (sessionName.trim()) {
        action = `/new ${sessionName.trim()}`;
      } else {
        return { handled: true };
      }
    } else if (chosen === '/switch') {
      await printSessionsList(sessionManager, isEn);
      const switchTarget = await promptUser(chalk.bold.cyan(isEn ? 'Switch to session ID or name > ' : 'Nhập ID hoặc tên phiên cần chuyển > '));
      if (switchTarget.trim()) {
        action = `/switch ${switchTarget.trim()}`;
      } else {
        return { handled: true };
      }
    } else if (chosen === '/add') {
      const addTarget = await promptUser(chalk.bold.cyan(isEn ? 'File path to pin > ' : 'Đường dẫn file cần ghim > '));
      if (addTarget.trim()) {
        action = `/add ${addTarget.trim()}`;
      } else {
        return { handled: true };
      }
    } else {
      action = chosen;
    }
  }

  // Fuzzy command suggestion for unrecognized slash command
  if (action.startsWith('/') && !SLASH_COMMANDS_LIST.includes(action.split(' ')[0])) {
    const typedCmd = action.split(' ')[0];
    const match = SLASH_COMMANDS_LIST.find((c) => c.startsWith(typedCmd) || c.includes(typedCmd.replace('/', '')));
    if (match) {
      console.log(chalk.yellow(isEn 
        ? `Unknown command '${typedCmd}'. Did you mean: ${chalk.bold.cyan(match)}?` 
        : `Lệnh '${typedCmd}' không đúng. Có phải bạn muốn gõ: ${chalk.bold.cyan(match)}?`
      ));
    } else {
      console.log(chalk.gray(isEn 
        ? `Type ${chalk.cyan('/')} or press ${chalk.cyan('Tab')} to view available commands.` 
        : `Gõ ${chalk.cyan('/')} hoặc nhấn ${chalk.cyan('Tab')} để xem danh sách lệnh gợi ý.`
      ));
    }
    return { handled: true };
  }

  if (action === '/exit' || action === '/quit') {
    console.log(chalk.gray(isEn ? 'Goodbye!' : 'Tạm biệt!'));
    return { handled: true, exit: true };
  }

  if (action === '/clear') {
    console.clear();
    return { handled: true };
  }

  if (action === '/clear-history') {
    const ok = await confirm({
      message: isEn ? 'Delete all local prompt history, logs, and sessions in .duo?' : 'Xóa sạch toàn bộ lịch sử prompt, logs và sessions trong .duo?',
      default: true,
    });
    if (ok) {
      await HistoryManager.clear(process.cwd());
      currentSession = await sessionManager.getActiveSession();
      history.length = 0;
      console.log(chalk.green(isEn ? '\n+ Cleared all local history and sessions.\n' : '\n+ Đã xóa sạch toàn bộ lịch sử và sessions cục bộ.\n'));
      return { handled: true, session: currentSession };
    }
    return { handled: true };
  }

  if (action === '/help') {
    i18n.printHelp();
    return { handled: true };
  }

  if (action === '/cost') {
    const tokens = currentSession.totalTokens || 0;
    const cost = currentSession.estimatedCostUsd || 0;
    console.log(chalk.white.bold(isEn ? '\nSession Usage & Cost Report:' : '\nBáo cáo chi phí phiên làm việc:'));
    console.log(chalk.gray(`- ${isEn ? 'Total Tokens' : 'Tổng số Tokens'}:       ${tokens.toLocaleString()} tokens`));
    console.log(chalk.green(`- ${isEn ? 'Estimated Cost' : 'Chi phí ước tính'}:     ~$${cost.toFixed(4)} USD`));
    console.log(chalk.gray(`- ${isEn ? 'Tasks Completed' : 'Số task đã xong'}:     ${currentSession.records.length}`));
    console.log(chalk.gray(`- ${isEn ? 'Estimated Savings' : 'Mức tiết kiệm token'}: ~85% - 90% (Sandwich + Slicer)`));
    if (currentSession.pinnedFiles && currentSession.pinnedFiles.length > 0) {
      console.log(chalk.gray(`- ${isEn ? 'Pinned Files' : 'Files đang ghim'}:        ${currentSession.pinnedFiles.join(', ')}`));
    }
    console.log();
    return { handled: true };
  }

  if (action.startsWith('/commit')) {
    const userMsg = action.replace('/commit', '').trim();
    const diff = await GitGuard.getDiff();
    if (!diff || diff.trim().length === 0) {
      console.log(chalk.gray(isEn ? '\nNo uncommitted git changes to commit.\n' : '\nKhông có thay đổi mã nguồn nào để commit.\n'));
      return { handled: true };
    }

    let commitMsg = userMsg;
    if (!commitMsg) {
      const spinner = ora(isEn ? 'Generating conventional commit message...' : 'Đang tạo commit message theo quy chuẩn...').start();
      try {
        const provider = ProviderFactory.create(config.roles.architect);
        const resp = await provider.generate([
          {
            role: 'system',
            content:
              'Generate a single-line conventional git commit message (e.g. feat(auth): add jwt middleware, fix(db): resolve pool leak). Return ONLY the 1-line message, no quotes, no markdown.',
          },
          { role: 'user', content: `GIT DIFF:\n${diff.slice(0, 5000)}` },
        ]);
        commitMsg = resp.text.trim().replace(/^["']|["']$/g, '');
        spinner.succeed(chalk.green(isEn ? `Generated: ${commitMsg}` : `Commit message: ${commitMsg}`));
      } catch {
        commitMsg = `chore: update codebase with Duo Agent`;
        spinner.stop();
      }
    }

    try {
      await execAsync('git add -A');
      const { stdout } = await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
      console.log(
        chalk.green(isEn ? '\n+ Git commit successful:\n' : '\n+ Đã commit vào Git thành công:\n') +
          chalk.gray(stdout.trim()) +
          '\n'
      );
      await ActivityLogger.log('session', `Git Commit: ${commitMsg}`);
    } catch (err: any) {
      console.log(chalk.red(`\n! Git commit failed: ${err.message}\n`));
    }
    return { handled: true };
  }

  if (action.startsWith('/add ') || action === '/add') {
    const fileArg = action.replace('/add', '').trim();
    if (!fileArg) {
      console.log(chalk.gray(isEn ? 'Usage: /add <file_path>' : 'Cú pháp: /add <đường_dẫn_file> (ví dụ /add lib/auth.ts)'));
      return { handled: true };
    }
    const absPath = path.resolve(process.cwd(), fileArg);
    if (await fs.pathExists(absPath)) {
      currentSession.pinnedFiles = currentSession.pinnedFiles || [];
      if (!currentSession.pinnedFiles.includes(fileArg)) {
        currentSession.pinnedFiles.push(fileArg);
        await sessionManager.saveSession(currentSession);
      }
      console.log(chalk.green(isEn ? `\n+ Pinned file: ${fileArg} to session context\n` : `\n+ Đã ghim file: ${fileArg} vào ngữ cảnh phiên\n`));
    } else {
      console.log(chalk.red(isEn ? `\n! File not found: ${fileArg}\n` : `\n! Không tìm thấy file: ${fileArg}\n`));
    }
    return { handled: true, session: currentSession };
  }

  if (action === '/paste') {
    console.log(
      chalk.cyan(
        isEn
          ? '\nEnter multi-line text (type END on a single line to finish):\n'
          : '\nNhập nội dung nhiều dòng (gõ END trên dòng riêng để kết thúc):\n'
      )
    );
    const lines: string[] = [];
    while (true) {
      let line: string;
      try {
        line = await promptUser('');
      } catch {
        break;
      }
      if (line.trim() === 'END') break;
      lines.push(line);
    }
    const fullPrompt = lines.join('\n').trim();
    if (fullPrompt) {
      await HistoryManager.append(fullPrompt);
      history.push(fullPrompt);
      await runWorkflow(fullPrompt, { autoAccept: false });
    }
    return { handled: true };
  }

  if (action === '/compact') {
    if (currentSession.records.length === 0) {
      console.log(chalk.gray(isEn ? '\nNo completed tasks in session to compact.\n' : '\nChưa có task nào trong phiên để nén.\n'));
      return { handled: true };
    }
    const spinner = ora(isEn ? 'Compacting session context...' : 'Đang nén và tóm tắt ngữ cảnh phiên...').start();
    try {
      const provider = ProviderFactory.create(config.roles.architect);
      const taskSummary = currentSession.records
        .map((r, i) => `${i + 1}. Goal: ${r.goal} | Modified: ${r.modifiedFiles.join(', ')}`)
        .join('\n');
      const resp = await provider.generate([
        {
          role: 'system',
          content:
            'Summarize the completed engineering tasks and architectural state into a concise paragraph (3-5 sentences) for context continuity. Output plain text only.',
        },
        { role: 'user', content: `COMPLETED TASKS:\n${taskSummary}` },
      ]);
      currentSession.summary = resp.text.trim();
      currentSession.records = []; // Compacted
      await sessionManager.saveSession(currentSession);
      spinner.succeed(chalk.green(isEn ? 'Session context compacted successfully!' : 'Đã nén ngữ cảnh phiên thành công!'));
      console.log(chalk.gray(`\n${currentSession.summary}\n`));
    } catch (err: any) {
      spinner.fail(chalk.red(`Compaction failed: ${err.message}`));
    }
    return { handled: true, session: currentSession };
  }

  if (action === '/lang' || action === '/language') {
    config = await SecurityPrompts.promptSelectLanguage(config);
    i18n.setLanguage(config.language || 'vi');
    await ConfigManager.saveConfig(config);
    return { handled: true, config };
  }

  if (action === '/rules' || action === '/rule') {
    const detected = await ProjectDetector.detect(process.cwd());
    if (detected.ruleFile && detected.ruleContent) {
      console.log(chalk.white.bold(isEn ? '\nActive Project Rules:' : '\nQuy ước dự án hiện tại:'));
      console.log(chalk.cyan(`Source: ${detected.ruleFile}`) + chalk.gray(` (${detected.ruleContent.length} chars, ~${Math.round(detected.ruleContent.length / 4)} tokens)`));
      console.log(chalk.gray('─'.repeat(60)));
      const previewLines = detected.ruleContent.split('\n').slice(0, 18).join('\n');
      console.log(previewLines);
      if (detected.ruleContent.split('\n').length > 18) {
        console.log(chalk.gray(`... [${detected.ruleContent.split('\n').length - 18} ${isEn ? 'more lines omitted]' : 'dòng khác đã ẩn]'}`));
      }
      console.log(chalk.gray('─'.repeat(60) + '\n'));
    } else {
      console.log(chalk.yellow(isEn ? '\nNo repository rules file detected.' : '\nChưa phát hiện file quy ước trong dự án.'));
      console.log(chalk.gray(isEn
        ? 'Supported rule files: .duorules, .duo/rules.md, CLAUDE.md, .cursorrules, AGENTS.md'
        : 'Hỗ trợ các file: .duorules, .duo/rules.md, CLAUDE.md, .cursorrules, AGENTS.md'
      ));
      const shouldCreate = await confirm({
        message: isEn ? `Create recommended .duorules for ${detected.type} project?` : `Tạo file .duorules chuẩn cho dự án ${detected.type}?`,
        default: true,
      });
      if (shouldCreate) {
        const initRes = await ProjectDetector.initRules(process.cwd(), true);
        console.log(chalk.green(isEn ? `\n+ Created ${initRes.file} successfully! You can customize it anytime.\n` : `\n+ Đã tạo ${initRes.file} thành công! Bạn có thể tùy chỉnh file này bất kỳ lúc nào.\n`));
      }
    }
    return { handled: true };
  }

  if (action === '/theme') {
    config = await SecurityPrompts.promptSelectTheme(config);
    await ConfigManager.saveConfig(config);
    Logger.printBanner(config.theme);
    return { handled: true, config };
  }

  if (action === '/sessions') {
    await printSessionsList(sessionManager, isEn);
    return { handled: true };
  }

  if (action.startsWith('/switch ')) {
    const target = action.replace('/switch ', '').trim();
    try {
      currentSession = await sessionManager.switchSession(target);
      console.log(chalk.green(`\n+ Switched to session: ${currentSession.title} [${currentSession.id}]\n`));
      return { handled: true, session: currentSession };
    } catch (e: any) {
      console.log(chalk.red(`\n! ${e.message}\n`));
      return { handled: true };
    }
  }

  if (action.startsWith('/new ')) {
    const title = action.replace('/new ', '').trim();
    currentSession = await sessionManager.createSession(title);
    console.log(chalk.green(`\n+ Created session: ${currentSession.title} [${currentSession.id}]\n`));
    return { handled: true, session: currentSession };
  }

  if (action === '/session') {
    console.log(chalk.white.bold(isEn ? `\nSession: ${currentSession.title}` : `\nThông tin phiên: ${currentSession.title}`));
    console.log(chalk.gray(`- ${isEn ? 'ID:' : 'Mã:'}        ${currentSession.id}`));
    console.log(chalk.gray(`- ${isEn ? 'Created:' : 'Khởi tạo:'}   ${new Date(currentSession.createdAt).toLocaleString()}`));
    console.log(chalk.gray(`- ${isEn ? 'Updated:' : 'Cập nhật:'}   ${new Date(currentSession.updatedAt).toLocaleString()}`));
    console.log(chalk.gray(`- ${isEn ? 'Tasks:' : 'Nhiệm vụ:'}     ${currentSession.records.length}`));
    if (currentSession.records.length > 0) {
      console.log(chalk.gray(isEn ? '\nCompleted tasks:' : '\nCác task đã hoàn tất:'));
      currentSession.records.forEach((r, idx) => {
        console.log(chalk.gray(`  ${idx + 1}. ${r.goal} (${r.modifiedFiles.join(', ')})`));
      });
    }
    console.log();
    return { handled: true };
  }

  if (action === '/model' || action === '/change_model') {
    config = await SecurityPrompts.promptChangeModel(config);
    await ConfigManager.saveConfig(config);
    return { handled: true, config };
  }

  if (action === '/key' || action === '/keys') {
    config = await SecurityPrompts.promptKeyManagement(config);
    await ConfigManager.saveConfig(config);
    return { handled: true, config };
  }

  if (action.startsWith('/effort')) {
    const parts = action.split(' ').map((s) => s.trim()).filter(Boolean);
    const arg = parts[1]?.toLowerCase();
    if (arg && ['low', 'medium', 'high', 'off'].includes(arg)) {
      const effort = arg as 'low' | 'medium' | 'high' | 'off';
      config.roles.architect.reasoningEffort = effort;
      config.roles.builder.reasoningEffort = effort;
      config.roles.auditor.reasoningEffort = effort;
      await ConfigManager.saveConfig(config);
      console.log(chalk.green(`+ Set reasoning effort to: ${effort}\n`));
    } else {
      config = await SecurityPrompts.promptSelectEffort(config);
      await ConfigManager.saveConfig(config);
    }
    return { handled: true, config };
  }

  if (action === '/benchmark') {
    await BenchmarkRunner.run(config);
    return { handled: true };
  }

  if (action === '/config') {
    console.log(chalk.white.bold('\nConfig:'));
    console.log(chalk.gray(JSON.stringify(config, null, 2)) + '\n');
    return { handled: true };
  }

  if (action === '/undo') {
    const spinner = ora(isEn ? 'Rolling back changes...' : 'Đang khôi phục mã nguồn...').start();
    const ok = await GitGuard.rollback();
    CodeGraph.invalidateCache(process.cwd());
    if (ok) {
      spinner.succeed(chalk.green(isEn ? 'Rollback completed\n' : 'Đã khôi phục thành công!\n'));
    } else {
      spinner.fail(chalk.red(isEn ? 'Rollback failed\n' : 'Không thể rollback.\n'));
    }
    return { handled: true };
  }

  if (action === '/diff') {
    const diffText = await GitGuard.getDiff();
    console.log(diffText ? chalk.cyan(diffText) : chalk.gray(isEn ? 'No uncommitted changes.\n' : 'Không có thay đổi nào trong git.\n'));
    return { handled: true };
  }

  if (action.startsWith('/plan ')) {
    const task = action.replace('/plan ', '').trim();
    await runWorkflow(task, { planOnly: true });
    return { handled: true };
  }

  return { handled: false };
}
