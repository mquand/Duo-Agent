import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export class GitGuard {
  private static initialUntrackedFiles: Set<string> = new Set();

  static async isGitRepo(cwd: string = process.cwd()): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd });
      return true;
    } catch {
      return false;
    }
  }

  static async hasUncommittedChanges(cwd: string = process.cwd()): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  static async createCheckpoint(cwd: string = process.cwd()): Promise<string | null> {
    if (!(await this.isGitRepo(cwd))) return null;
    try {
      // Record initial untracked files to protect user's uncommitted work
      try {
        const { stdout: untrackedRaw } = await execAsync('git ls-files --others --exclude-standard', { cwd });
        this.initialUntrackedFiles = new Set(untrackedRaw.split('\n').filter(Boolean));
      } catch {}

      // Create a stash commit without modifying working tree
      const { stdout } = await execAsync('git stash create "duo-checkpoint"', { cwd });
      const ref = stdout.trim();
      return ref || 'HEAD';
    } catch {
      return 'HEAD';
    }
  }

  static async getDiff(sinceRef: string = 'HEAD', cwd: string = process.cwd()): Promise<string> {
    if (!(await this.isGitRepo(cwd))) return '';
    try {
      const { stdout } = await execAsync(`git diff ${sinceRef}`, { cwd });
      return stdout;
    } catch {
      try {
        const { stdout } = await execAsync('git diff', { cwd });
        return stdout;
      } catch {
        return '';
      }
    }
  }

  static async rollback(checkpointRef?: string | null, cwd: string = process.cwd()): Promise<boolean> {
    if (!(await this.isGitRepo(cwd))) return false;
    try {
      if (checkpointRef && checkpointRef !== 'HEAD') {
        await execAsync(`git reset --hard ${checkpointRef}`, { cwd });
      } else {
        await execAsync('git checkout .', { cwd });
      }

      // Selectively clean only untracked files generated during execution, preserving pre-existing user files
      try {
        const { stdout: currentUntrackedRaw } = await execAsync('git ls-files --others --exclude-standard', { cwd });
        const currentUntracked = currentUntrackedRaw.split('\n').filter(Boolean);
        for (const file of currentUntracked) {
          if (!this.initialUntrackedFiles.has(file)) {
            await fs.remove(path.join(cwd, file));
          }
        }
      } catch {}

      return true;
    } catch (e) {
      return false;
    }
  }

  static async createCommit(message: string, cwd: string = process.cwd()): Promise<boolean> {
    if (!(await this.isGitRepo(cwd))) return false;
    try {
      await execAsync('git add -A', { cwd });
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd });
      return true;
    } catch {
      return false;
    }
  }
}
