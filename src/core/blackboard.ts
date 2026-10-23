import fs from 'fs-extra';
import path from 'path';

export interface StepRecord {
  stepId: string;
  status: 'completed' | 'failed';
  modifiedFiles: string[];
  findings?: string;
  error?: string;
  completedAt: string;
}

export interface BlackboardState {
  goal: string;
  activeStep?: string;
  records: Record<string, StepRecord>;
}

export class Blackboard {
  private filePath: string;
  private state: BlackboardState;

  constructor(cwd: string = process.cwd()) {
    this.filePath = path.join(cwd, '.duo', 'scratchpad.json');
    this.state = {
      goal: '',
      records: {},
    };
  }

  async init(goal: string): Promise<void> {
    await fs.ensureDir(path.dirname(this.filePath));
    this.state = {
      goal,
      records: {},
    };
    await this.persist();
  }

  async recordStep(record: StepRecord): Promise<void> {
    this.state.records[record.stepId] = record;
    await this.persist();
  }

  getSummaryForWorker(): string {
    const completed = Object.values(this.state.records).filter((r) => r.status === 'completed');
    if (completed.length === 0) return '';

    let summary = '### COMPLETED STEPS CONTEXT (SHARED MEMORY):\n';
    for (const r of completed) {
      summary += `- Step ${r.stepId}: Modified [${r.modifiedFiles.join(', ')}]. ${r.findings || ''}\n`;
    }
    return summary.trim();
  }

  private async persist(): Promise<void> {
    try {
      await fs.writeJson(this.filePath, this.state, { spaces: 2 });
    } catch {
      // Ignore write errors
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (await fs.pathExists(this.filePath)) {
        await fs.remove(this.filePath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}
