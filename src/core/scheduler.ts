import path from 'path';
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

  private normalizePath(f: string, cwd: string): string {
    return path.normalize(path.isAbsolute(f) ? f : path.resolve(cwd, f));
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

        // Check normalized file collision with currently running steps
        const normalizedTargetFiles = step.target_files.map((f) => this.normalizePath(f, cwd));
        const hasLockConflict = normalizedTargetFiles.some((f) => this.fileLocks.has(f));
        return !hasLockConflict;
      });

      if (readySteps.length === 0) {
        // If no steps ready, but some are running, wait for one to finish
        if (runningStepIds.size > 0) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        } else {
          // Deadlock or all remaining steps are blocked
          const pendingRemaining = steps.filter((s) => s.status === 'pending');
          for (const s of pendingRemaining) {
            s.status = 'blocked';
            s.error = 'Blocked (Deadlock or unmet dependencies)';
            callbacks?.onStepError?.(s, s.error);
          }
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
        const normalizedTargetFiles = step.target_files.map((f) => this.normalizePath(f, cwd));
        normalizedTargetFiles.forEach((f) => this.fileLocks.add(f));

        callbacks?.onStepStart?.(step);

        try {
          const blackboardSummary = this.blackboard.getSummaryForWorker();
          const result = await this.builder.executeStep(step, blackboardSummary, cwd);

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
            callbacks?.onStepError?.(step, result.error || 'Unknown error');

            // Cascade: Mark all dependent pending tasks as BLOCKED
            const markBlocked = (failedId: string) => {
              for (const s of steps) {
                if (s.status === 'pending' && s.depends_on.includes(failedId)) {
                  s.status = 'blocked';
                  s.error = `Blocked because prerequisite task [${failedId}] failed`;
                  callbacks?.onStepError?.(s, s.error);
                  markBlocked(s.id);
                }
              }
            };
            markBlocked(step.id);
          }
        } finally {
          // Guaranteed lock release even on error or unhandled exception
          normalizedTargetFiles.forEach((f) => this.fileLocks.delete(f));
          runningStepIds.delete(step.id);
        }
      });

      await Promise.all(executionPromises);

      // Check if any step failed or blocked
      const hasFailures = steps.some((s) => s.status === 'failed' || s.status === 'blocked');
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
