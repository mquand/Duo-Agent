import path from 'path';
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';

import { ConfigManager, PRESETS } from './config/manager.js';
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
  .option('--preset <presetName>', 'Use predefined model preset (offline, claude, openai, gemini, deepseek, hybrid, fast, codestral)')
  .option('-m, --model <modelName>', 'Override all 3 roles with a single specified model')
  .option('--architect <modelName>', 'Override Architect model')
  .option('--builder <modelName>', 'Override Builder model')
  .option('--auditor <modelName>', 'Override Auditor model')
  .option('-r, --resume [sessionId]', 'Resume previous session (default: latest)')
  .option('--sessions', 'List all saved sessions', false)
  .action(async (promptText, options) => {
    // Load Configuration
    let config = await ConfigManager.loadConfig();

    // 1. Preset override
    if (options.preset) {
      const presetRoles = ConfigManager.getPreset(options.preset);
      if (presetRoles) {
        config.roles = { ...config.roles, ...presetRoles };
      } else {
        console.log(chalk.yellow(`Notice: Unknown preset '${options.preset}'. Available presets: ${Object.keys(PRESETS).join(', ')}`));
      }
    }

    // 2. Single model override (all 3 roles)
    if (options.model) {
      const singleRole = ConfigManager.resolveRole(options.model);
      config.roles.architect = { ...singleRole, reasoningEffort: 'medium' };
      config.roles.builder = { ...singleRole, reasoningEffort: 'off' };
      config.roles.auditor = { ...singleRole, reasoningEffort: 'medium' };
    }

    // 3. Granular role overrides
    if (options.architect) {
      config.roles.architect = ConfigManager.resolveRole(options.architect, 'medium');
    }
    if (options.builder) {
      config.roles.builder = ConfigManager.resolveRole(options.builder, 'off');
    }
    if (options.auditor) {
      config.roles.auditor = ConfigManager.resolveRole(options.auditor, 'medium');
    }

    // 4. Effort override
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
      const newConfig = await SecurityPrompts.promptOnboarding(config);
      config = { ...config, roles: { ...config.roles, ...newConfig.roles } };
      await ConfigManager.saveConfig(config);
      console.log(chalk.green(config.language === 'en' ? '+ Saved configuration at ~/.duo/config.json\n' : '+ Đã lưu cấu hình tại ~/.duo/config.json\n'));
    } else {
      const isEn = config.language === 'en';
      const missingKeys = ConfigManager.getMissingKeys(config, isEn);
      if (missingKeys.length > 0) {
        console.log(chalk.yellow(`\n[!] ${isEn ? 'Notice - Missing API Keys:' : 'Lưu ý - Chưa cấu hình đầy đủ API Key:'}`));
        for (const k of missingKeys) {
          console.log(chalk.yellow(`   • ${k}`));
        }
        console.log(chalk.gray(isEn
          ? `   -> Type ${chalk.cyan('/key')} to enter API key(s).\n   -> Or type ${chalk.cyan('/model')} to switch to Local Offline (Ollama - 100% Free).\n`
          : `   -> Gõ ${chalk.cyan('/key')} để bổ sung API key.\n   -> Hoặc gõ ${chalk.cyan('/model')} để chuyển sang Local Offline (Ollama miễn phí 100%).\n`
        ));
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


// ============================================================================
// NEW SUBCOMMANDS: inspect, plan, auth
// ============================================================================

program
  .command('inspect [directory]')
  .description('All-in-one Codebase Survey: AST CodeGraph (<10ms), Stack/Rules detection, and Git Checkpoint')
  .option('--no-checkpoint', 'Skip creating git safety checkpoint')
  .option('--max-files <number>', 'Maximum files to scan in CodeGraph', '200')
  .action(async (dirArg, opts) => {
    const { Inspector } = await import('./core/inspector.js');
    const targetDir = dirArg ? path.resolve(dirArg) : process.cwd();
    const spinner = ora('Inspecting repository and establishing safety guard...').start();
    try {
      const res = await Inspector.inspectAndGuard({
        directory: targetDir,
        maxFiles: parseInt(opts.maxFiles, 10),
        checkpoint: opts.checkpoint,
      });
      spinner.succeed(chalk.green('Inspection & Safety Checkpoint completed!'));

      console.log(chalk.white.bold('\n📁 Project Stack:'));
      console.log(chalk.cyan(`  • Framework/Type: ${res.stack.type.toUpperCase()}`));
      console.log(chalk.cyan(`  • Language: ${res.stack.language}`));
      if (res.stack.testCommand) console.log(chalk.gray(`  • Test command: ${res.stack.testCommand}`));
      if (res.stack.ruleFile) console.log(chalk.gray(`  • Convention rules: ${res.stack.ruleFile}`));

      if (res.checkpointRef) {
        console.log(chalk.white.bold('\n🛡️ Git Safety Checkpoint:'));
        console.log(chalk.green(`  • Checkpoint Ref: ${res.checkpointRef}`));
        console.log(chalk.gray('  • Rollback command anytime: duo --undo'));
      }

      console.log(chalk.white.bold(`\n🌳 CodeGraph Skeleton (${res.filesScanned} files):\n`));
      console.log(res.skeleton);
    } catch (err: any) {
      spinner.fail(chalk.red(`Inspection failed: ${err.message}`));
    }
  });

program
  .command('plan [action] [stepId]')
  .description('Manage & collaborate on handoff execution plan (PLAN.md)')
  .option('-d, --dir <directory>', 'Target directory', process.cwd())
  .action(async (action, stepId, opts) => {
    const { HandoffManager } = await import('./core/handoff.js');
    const { Inspector } = await import('./core/inspector.js');
    const cwd = path.resolve(opts.dir);

    if (action === 'execute' || action === 'exec') {
      const sid = stepId ? parseInt(stepId, 10) : undefined;
      const spinner = ora('Activating plan step and safety guard...').start();
      try {
        const payload = await Inspector.startPlanExecution({ directory: cwd, stepId: sid });
        spinner.succeed(chalk.green(`Activated Step ${payload.currentStep.id}: ${payload.currentStep.title}`));
        console.log(chalk.white.bold('\n🎯 Step Instructions:'));
        console.log(chalk.yellow(payload.currentStep.instruction));
        if (payload.currentStep.files.length) {
          console.log(chalk.cyan(`Files: ${payload.currentStep.files.join(', ')}`));
        }
        if (payload.currentStep.verification) {
          console.log(chalk.gray(`Verification: ${payload.currentStep.verification}`));
        }
      } catch (e: any) {
        spinner.fail(chalk.red(e.message));
      }
      return;
    }

    if (action === 'status' && stepId) {
      const statusArg = process.argv[5] || 'completed';
      const sid = parseInt(stepId, 10);
      try {
        await HandoffManager.updateStepStatus({
          directory: cwd,
          stepId: sid,
          status: statusArg as any,
        });
        console.log(chalk.green(`+ Updated Step ${sid} to status: ${statusArg}`));
      } catch (e: any) {
        console.log(chalk.red(`Failed to update status: ${e.message}`));
      }
      return;
    }

    // Default: view active plan
    const plan = await HandoffManager.getPlan(cwd);
    if (!plan) {
      console.log(chalk.yellow(`No active handoff plan (PLAN.md) found in ${cwd}`));
      return;
    }
    console.log(chalk.white.bold(`\n📋 Plan: ${plan.title}`));
    console.log(chalk.gray(`Task: ${plan.task}\n`));
    for (const s of plan.steps) {
      const icon = s.status === 'completed' ? chalk.green('✓ [x]') : s.status === 'in_progress' ? chalk.yellow('▶ [/]') : chalk.gray('○ [ ]');
      console.log(`${icon} Step ${s.id}: ${s.title} (${s.status})`);
    }
    console.log(chalk.gray(`\nFull checklist in: ${path.join(cwd, 'PLAN.md')}\n`));
  });

program
  .command('auth [action] [provider] [token]')
  .description('Check or configure API Key and OAuth / g2auth credentials')
  .action(async (action, provider, token) => {
    const { AuthManager } = await import('./auth/oauth.js');
    if (action === 'set' && provider && token) {
      if (provider !== 'google' && provider !== 'anthropic') {
        console.log(chalk.red("Provider must be 'google' or 'anthropic'"));
        return;
      }
      await AuthManager.saveOAuthToken(provider, token);
      console.log(chalk.green(`+ Stored OAuth token for ${provider} in ~/.duo/oauth.json`));
      return;
    }

    const report = AuthManager.getAuthStatusReport();
    console.log(chalk.white.bold('\n🔐 Duo-Agent Authentication Status:'));

    console.log(
      report.google.authenticated
        ? chalk.green(`  • Google (Gemini): ACTIVE [${report.google.authType}] - ${report.google.details}`)
        : chalk.yellow(`  • Google (Gemini): MISSING - ${report.google.details}`)
    );

    console.log(
      report.anthropic.authenticated
        ? chalk.green(`  • Anthropic (Claude): ACTIVE [${report.anthropic.authType}] - ${report.anthropic.details}`)
        : chalk.yellow(`  • Anthropic (Claude): MISSING - ${report.anthropic.details}`)
    );

    console.log(chalk.cyan(`  • OpenAI Compatible: ${report.openaiCompatible.details}`));
    console.log(chalk.gray('\nTips: Use \'duo key\' for API keys, or \'duo auth set google <token>\' for g2auth/OAuth.\n'));
  });

program.parse(process.argv);
