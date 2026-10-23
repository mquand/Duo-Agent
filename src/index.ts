#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';

import { ConfigManager } from './config/manager.js';
import { ProjectDetector } from './detector/project.js';
import { GitGuard } from './core/git-guard.js';
import { SessionManager } from './core/session.js';
import { ActivityMonitor } from './core/monitor.js';
import { HistoryManager } from './core/history.js';
import { BenchmarkRunner } from './core/benchmark.js';
import { i18n } from './ui/i18n.js';
import { THEMES } from './ui/theme.js';
import { Logger } from './ui/logger.js';
import { SecurityPrompts } from './ui/prompts.js';
import { SessionData } from './types/index.js';

import { runWorkflow } from './cli/workflow.js';
import { startInteractiveSession } from './cli/repl.js';
import { printSessionsList } from './cli/commands.js';
import { runDoctor } from './cli/doctor.js';

const program = new Command();

// Gracefully exit on Ctrl+C / SIGINT without unhandled Inquirer rejection dump
process.on('SIGINT', () => {
  console.log();
  process.exit(0);
});

process.on('uncaughtException', (err: any) => {
  if (err?.name === 'ExitPromptError' || err?.message?.includes('force closed the prompt')) {
    console.log();
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  if (reason?.name === 'ExitPromptError' || reason?.message?.includes('force closed the prompt')) {
    console.log();
    process.exit(0);
  }
  console.error(reason);
  process.exit(1);
});

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
  .command('rules [action]')
  .description('View or initialize repository rules (.duorules)')
  .action(async (action) => {
    const isInit = action === 'init' || action === 'create';
    const detected = await ProjectDetector.detect(process.cwd());
    if (isInit || !detected.ruleFile) {
      const initRes = await ProjectDetector.initRules(process.cwd(), isInit);
      if (initRes.created) {
        console.log(chalk.green(`\n+ Created ${initRes.file} tailored for ${detected.type.toUpperCase()} project.\n`));
      } else {
        console.log(chalk.yellow(`\nNotice: ${initRes.file} already exists. Pass 'duo rules init' to overwrite.\n`));
      }
      return;
    }

    console.log(chalk.white.bold('\nActive Project Rules:'));
    console.log(chalk.cyan(`Source: ${detected.ruleFile}`) + chalk.gray(` (~${Math.round((detected.ruleContent || '').length / 4)} tokens)\n`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(detected.ruleContent);
    console.log(chalk.gray('─'.repeat(60) + '\n'));
  });

program
  .command('init')
  .description('Initialize Duo in current repo (generate .duorules tailored to project stack)')
  .action(async () => {
    const detected = await ProjectDetector.detect(process.cwd());
    const initRes = await ProjectDetector.initRules(process.cwd(), false);
    if (initRes.created) {
      console.log(chalk.green(`\n+ Initialized ${initRes.file} for ${detected.type.toUpperCase()} project.`));
    } else {
      console.log(chalk.yellow(`\nNotice: Existing rules file (${detected.ruleFile}) detected. Repository is already initialized.`));
    }
    console.log(chalk.gray(`- Run 'duo' to start interactive session.\n`));
  });

program
  .command('clean')
  .description('Wipe all local prompt history, logs, and sessions in current repo')
  .action(async () => {
    await HistoryManager.clear(process.cwd());
    console.log(chalk.green('\n+ Cleared all local history, logs, and sessions (.duo).\n'));
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
  .command('key')
  .alias('keys')
  .description('Manage, update, or remove API keys for AI models')
  .action(async () => {
    let config = await ConfigManager.loadConfig();
    config = await SecurityPrompts.promptKeyManagement(config);
    await ConfigManager.saveConfig(config);
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
  .command('doctor')
  .description('Run self-diagnostic health check & test suite')
  .action(async () => {
    await runDoctor();
  });

program
  .command('benchmark')
  .description('Run empirical benchmark comparing Sandwich vs Monolith agent architectures')
  .action(async () => {
    const config = await ConfigManager.loadConfig();
    await BenchmarkRunner.run(config);
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
  .option('--worktree', 'Execute parallel tasks in isolated Git worktrees', false)
  .option('-e, --effort <level>', 'Set reasoning effort: low, medium, high, off')
  .option('-r, --resume [sessionId]', 'Resume previous session (default: latest)')
  .option('--sessions', 'List all saved sessions', false)
  .action(async (promptText, options) => {
    // Load Configuration
    let config = await ConfigManager.loadConfig();
    if (options.effort && ['low', 'medium', 'high', 'off'].includes(options.effort.toLowerCase())) {
      const eff = options.effort.toLowerCase() as 'low' | 'medium' | 'high' | 'off';
      config.roles.architect.reasoningEffort = eff;
      config.roles.builder.reasoningEffort = eff;
      config.roles.auditor.reasoningEffort = eff;
    }
    i18n.setLanguage(config.language || 'vi');

    Logger.printBanner(config.theme);

    const sessionManager = new SessionManager();

    // Handle --sessions command
    if (options.sessions) {
      await printSessionsList(sessionManager, config.language === 'en');
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

    const hasConfig = await ConfigManager.hasExistingConfig();

    if (!hasConfig) {
      const newConfig = await SecurityPrompts.promptOnboarding();
      config = { ...config, roles: { ...config.roles, ...newConfig.roles } };
      await ConfigManager.saveConfig(config);
      console.log(chalk.green('+ Saved configuration at ~/.duo/config.json\n'));
    } else {
      const missingKeys = ConfigManager.getMissingKeys(config, config.language === 'en');
      if (missingKeys.length > 0) {
        console.log(chalk.yellow(`Notice: ${missingKeys.join(', ')}`));
        const newConfig = await SecurityPrompts.promptOnboarding();
        config = { ...config, roles: { ...config.roles, ...newConfig.roles } };
        await ConfigManager.saveConfig(config);
        console.log(chalk.green('+ Saved configuration at ~/.duo/config.json\n'));
      }
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
