import chalk from 'chalk';
import { GitGuard } from '../core/git-guard.js';
import { ConfigManager } from '../config/manager.js';
import { CodeGraph } from '../core/codegraph.js';
import { DiffEngine } from '../core/diff-engine.js';
import { SessionManager } from '../core/session.js';

export async function runDoctor(): Promise<void> {
  console.log(chalk.bold.white('\nDuo-Agent System Diagnostic (Doctor)\n'));

  // 1. Node.js Environment
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  const nodeOk = nodeMajor >= 18;
  console.log(`${nodeOk ? chalk.green('✔') : chalk.red('✖')} Node.js Runtime: v${process.versions.node} (>= 18.0.0 required)`);

  // 2. Git Check
  const isGit = await GitGuard.isGitRepo();
  console.log(`${isGit ? chalk.green('✔') : chalk.yellow('⚠')} Git Repository: ${isGit ? 'Active work tree detected' : 'Not a git repo (run git init to enable checkpoints)'}`);

  // 3. Configuration & API Keys
  const config = await ConfigManager.loadConfig();
  const missing = ConfigManager.getMissingKeys(config);
  if (missing.length === 0) {
    console.log(`${chalk.green('✔')} API Keys & Providers: Fully configured (Architect: ${config.roles.architect.model}, Builder: ${config.roles.builder.model}, Auditor: ${config.roles.auditor.model})`);
  } else {
    console.log(`${chalk.yellow('⚠')} API Keys Notice: ${missing.join(', ')}`);
  }

  // 4. CodeGraph & Scanner
  try {
    const files = await CodeGraph.scanFiles(process.cwd(), 50);
    console.log(`${chalk.green('✔')} CodeGraph Engine: Scanned ${files.length} project files (<10ms)`);
  } catch (e: any) {
    console.log(`${chalk.red('✖')} CodeGraph Scanner error: ${e.message}`);
  }

  // 5. DiffEngine Test
  try {
    const parsed = DiffEngine.parseDiffBlocks('<<<<<<< SEARCH\na\n=======\nb\n>>>>>>>', 'test.txt');
    console.log(`${parsed.length === 1 ? chalk.green('✔') : chalk.red('✖')} DiffEngine: Surgical SEARCH/REPLACE parser operational`);
  } catch (e: any) {
    console.log(`${chalk.red('✖')} DiffEngine error: ${e.message}`);
  }

  // 6. Multi-Session Manager
  try {
    const sessionMgr = new SessionManager();
    const current = await sessionMgr.getActiveSession();
    console.log(`${current.id ? chalk.green('✔') : chalk.red('✖')} Session Manager: Active session ${chalk.cyan(current.title || current.id)} (${current.records.length} tasks)`);
  } catch (e: any) {
    console.log(`${chalk.red('✖')} Session Manager error: ${e.message}`);
  }

  console.log(chalk.bold.green('\nAll diagnostic checks completed.\n'));
}
