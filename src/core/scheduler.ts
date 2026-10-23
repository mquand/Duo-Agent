import { DAGStep, Plan } from '../types/index.js';
import { BuilderAgent, BuilderResult } from '../agents/builder.js';
import { Blackboard } from './blackboard.js';

export interface StepProgressCallback {
  onStepStart: (step: DAGStep) => void;
  onStepComplete: (step: DAGStep, result: BuilderResult) => void;
  onStepError: (step: DAGStep, error: string) => void;
}

export class DAGScheduler {
  private builder: BuilderAgent;
  private blackboard: Blackboard;
  private fileLocks: Set<string> = new Set();

  constructor(builder: BuilderAgent, blackboard: Blackboard) {
    this.builder = builder;
    this.blackboard = blackboard;
  }

  async executePlan(
    plan: Plan,
    callbacks?: Partial<StepProgressCallback>,
    cwd: string = process.cwd()
  ): Promise<{ success: boolean; completedSteps: number; totalSteps: number }> {
    const steps = [...plan.dag];
    const completedStepIds = new Set<string>();
    const runningStepIds = new Set<string>();

    for (const s of steps) {
      s.status = 'pending';
    }

    while (completedStepIds.size < steps.length) {
      // Find steps ready to execute: dependencies satisfied, not currently running or done
      const readySteps = steps.filter((step) => {
        if (step.status !== 'pending') return false;
        const allDepsMet = step.depends_on.every((depId) => completedStepIds.has(depId));
        if (!allDepsMet) return false;

        // Check file collision with currently running steps
        const hasLockConflict = step.target_files.some((f) => this.fileLocks.has(f));
        return !hasLockConflict;
      });

      if (readySteps.length === 0) {
        // If no steps ready, but some are running, wait for one to finish
        if (runningStepIds.size > 0) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        } else {
          // Deadlock or unresolvable dependencies
          return {
            success: false,
            completedSteps: completedStepIds.size,
            totalSteps: steps.length,
          };
        }
      }

      // Execute ready steps in parallel
      const executionPromises = readySteps.map(async (step) => {
        step.status = 'running';
        runningStepIds.add(step.id);
        step.target_files.forEach((f) => this.fileLocks.add(f));

        callbacks?.onStepStart?.(step);

        const blackboardSummary = this.blackboard.getSummaryForWorker();
        const result = await this.builder.executeStep(step, blackboardSummary, cwd);

        // Release file locks
        step.target_files.forEach((f) => this.fileLocks.delete(f));
        runningStepIds.delete(step.id);

        if (result.success) {
          step.status = 'completed';
          completedStepIds.add(step.id);
          await this.blackboard.recordStep({
            stepId: step.id,
            status: 'completed',
            modifiedFiles: result.modifiedFiles,
            findings: result.findings,
            completedAt: new Date().toISOString(),
          });
          callbacks?.onStepComplete?.(step, result);
        } else {
          step.status = 'failed';
          step.error = result.error;
          await this.blackboard.recordStep({
            stepId: step.id,
            status: 'failed',
            modifiedFiles: result.modifiedFiles,
            error: result.error,
            completedAt: new Date().toISOString(),
          });
          callbacks?.onStepError?.(step, result.error || 'Lỗi không xác định');
        }
      });

      await Promise.all(executionPromises);

      // Check if any step failed
      const hasFailures = steps.some((s) => s.status === 'failed');
      if (hasFailures) {
        return {
          success: false,
          completedSteps: completedStepIds.size,
          totalSteps: steps.length,
        };
      }
    }

    return {
      success: true,
      completedSteps: completedStepIds.size,
      totalSteps: steps.length,
    };
  }
}
