import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs-extra';
import { GitGuard } from './git-guard.js';

const execAsync = promisify(exec);

export interface WorktreeInfo {
  taskId: string;
  branch: string;
  worktreePath: string;
  baseCommit: string;
}

export class WorktreeManager {
  private cwd: string;
  private worktreesDir: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.worktreesDir = path.join(cwd, '.duo', 'worktrees');
  }

  async isSupported(): Promise<boolean> {
    return await GitGuard.isGitRepo(this.cwd);
  }

  async create(taskId: string, baseCommit: string = 'HEAD'): Promise<WorktreeInfo> {
    const isGit = await this.isSupported();
    if (!isGit) {
      throw new Error('Git worktree yêu cầu thư mục hiện tại phải là một Git repository.');
    }

    await fs.ensureDir(this.worktreesDir);

    const sanitizedId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const branch = `duo/task-${sanitizedId}`;
    const worktreePath = path.join(this.worktreesDir, sanitizedId);

    // If worktree already exists from a previous aborted run, clean it up
    if (await fs.pathExists(worktreePath)) {
      await this.cleanup(taskId);
    }

    // Delete pre-existing branch with the same name if any
    try {
      await execAsync(`git branch -D ${branch}`, { cwd: this.cwd });
    } catch {}

    // Create isolated git worktree with dedicated branch
    await execAsync(`git worktree add -b ${branch} "${worktreePath}" ${baseCommit}`, { cwd: this.cwd });

    // Link shared heavy dependencies (node_modules, .venv, deps, _build) to save disk & time
    await this.linkDependencies(worktreePath);

    return {
      taskId,
      branch,
      worktreePath,
      baseCommit,
    };
  }

  private async linkDependencies(worktreePath: string): Promise<void> {
    const commonDependencyFolders = ['node_modules', 'deps', '_build', '.venv', 'vendor'];
    for (const folder of commonDependencyFolders) {
      const mainPath = path.join(this.cwd, folder);
      const targetPath = path.join(worktreePath, folder);

      if ((await fs.pathExists(mainPath)) && !(await fs.pathExists(targetPath))) {
        try {
          await fs.ensureSymlink(mainPath, targetPath);
        } catch {
          // If symlink is unsupported on filesystem, continue gracefully
        }
      }
    }
  }

  async commitWorktree(worktreePath: string, message: string): Promise<boolean> {
    try {
      await execAsync('git add -A', { cwd: worktreePath });
      await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: worktreePath });
      return true;
    } catch {
      return false;
    }
  }

  async cleanup(taskId: string, deleteBranch: boolean = true): Promise<void> {
    const sanitizedId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const worktreePath = path.join(this.worktreesDir, sanitizedId);
    const branch = `duo/task-${sanitizedId}`;

    try {
      await execAsync(`git worktree remove --force "${worktreePath}"`, { cwd: this.cwd });
    } catch {
      if (await fs.pathExists(worktreePath)) {
        await fs.remove(worktreePath);
      }
      try {
        await execAsync('git worktree prune', { cwd: this.cwd });
      } catch {}
    }

    if (deleteBranch) {
      try {
        await execAsync(`git branch -D ${branch}`, { cwd: this.cwd });
      } catch {}
    }
  }

  async cleanupAll(): Promise<void> {
    try {
      await execAsync('git worktree prune', { cwd: this.cwd });
    } catch {}

    if (await fs.pathExists(this.worktreesDir)) {
      await fs.remove(this.worktreesDir);
    }
  }
}
