import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MergeResult {
  success: boolean;
  conflict?: boolean;
  error?: string;
}

export class IntegrationManager {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  async mergeTaskBranch(branch: string, taskTitle: string): Promise<MergeResult> {
    try {
      // Merge task branch into current working tree without fast-forward
      await execAsync(`git merge --no-ff ${branch} -m "duo: integrate ${taskTitle.replace(/"/g, '\\"')}"`, {
        cwd: this.cwd,
      });
      return { success: true };
    } catch (err: any) {
      const errorOutput = err.stderr || err.stdout || err.message || '';
      const isConflict = errorOutput.toLowerCase().includes('conflict');

      if (isConflict) {
        try {
          await execAsync('git merge --abort', { cwd: this.cwd });
        } catch {}
        return {
          success: false,
          conflict: true,
          error: `Merge conflict detected when integrating branch [${branch}]:\n${errorOutput.slice(0, 500)}`,
        };
      }

      return {
        success: false,
        conflict: false,
        error: `Failed to integrate branch [${branch}]: ${errorOutput.slice(0, 300)}`,
      };
    }
  }

  async getIntegratedDiff(baseCommit: string = 'HEAD'): Promise<string> {
    try {
      const { stdout } = await execAsync(`git diff ${baseCommit}`, { cwd: this.cwd });
      return stdout;
    } catch {
      return '';
    }
  }
}
