import os from 'os';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

import { AppConfig, SessionData, ExecutionOptions } from '../types/index.js';
import { SessionManager } from '../core/session.js';
import { HistoryManager } from '../core/history.js';
import { CodeGraph } from '../core/codegraph.js';
import { promptWithSuggestions } from '../ui/suggest-prompt.js';
import { runWorkflow } from './workflow.js';
import { handleSlashCommand, printSessionsList } from './commands.js';

const execAsync = promisify(exec);

export async function startInteractiveSession(
  initialConfig: AppConfig,
  initialSessionId?: string
): Promise<void> {
  let config = initialConfig;
  const sessionManager = new SessionManager();
  let currentSession: SessionData = initialSessionId
    ? await sessionManager.switchSession(initialSessionId)
    : await sessionManager.getActiveSession();

  const isEn = config.language === 'en';
  const cwd = process.cwd().replace(os.homedir(), '~');
  const costInfo = currentSession.estimatedCostUsd
    ? chalk.green(` · ~$${currentSession.estimatedCostUsd.toFixed(3)} (${((currentSession.totalTokens || 0) / 1000).toFixed(1)}k tokens)`)
    : '';
  console.log(chalk.bold.white('Duo Agent') + chalk.gray(` v1.0.0`) + costInfo);
  const archEffort = config.roles.architect.reasoningEffort ? ` (${config.roles.architect.reasoningEffort})` : '';
  console.log(chalk.gray(`${config.roles.architect.model}${archEffort} · ${config.roles.builder.model} · ${config.roles.auditor.model}`));
  console.log(chalk.gray(cwd) + '\n');

  const history = await HistoryManager.loadHistory();
  let projectFiles = await CodeGraph.scanFiles(process.cwd(), 500);

  while (true) {
    const isCustomSession = currentSession.title && !['default', 'mặc định', 'phiên mới', 'main'].includes(currentSession.title.toLowerCase());
    const costTag = currentSession.estimatedCostUsd ? ` [~$${currentSession.estimatedCostUsd.toFixed(3)}]` : '';
    const promptLabel = isCustomSession ? `duo (${currentSession.title})${costTag} > ` : `duo${costTag} > `;

    let userInput: string;
    try {
      userInput = await promptWithSuggestions({
        message: chalk.bold.cyan(promptLabel),
        isEn,
        history,
        files: projectFiles,
      });
    } catch {
      break;
    }

    let action = userInput.trim();
    if (!action) continue;

    const lowerAction = action.toLowerCase();
    if (
      lowerAction === 'exit' ||
      lowerAction === 'quit' ||
      lowerAction === ':q' ||
      lowerAction === 'q' ||
      lowerAction === 'bye' ||
      lowerAction === '/exit' ||
      lowerAction === '/quit' ||
      lowerAction === '/ex'
    ) {
      console.log(chalk.gray(isEn ? 'Goodbye!' : 'Tạm biệt!'));
      break;
    }

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

    // Execute slash commands
    const cmdResult = await handleSlashCommand({
      action,
      config,
      sessionManager,
      currentSession,
      history,
      runWorkflow: async (text: string, options: ExecutionOptions) => {
        await runWorkflow(text, options, config, sessionManager, currentSession);
      },
    });

    if (cmdResult.handled) {
      if (cmdResult.exit) break;
      if (cmdResult.config) config = cmdResult.config;
      if (cmdResult.session) currentSession = cmdResult.session;
      continue;
    }

    // Normal task execution
    await HistoryManager.append(action);
    history.push(action);
    await runWorkflow(action, { autoAccept: false }, config, sessionManager, currentSession);
    try {
      projectFiles = await CodeGraph.scanFiles(process.cwd(), 500);
    } catch {}
  }
}
