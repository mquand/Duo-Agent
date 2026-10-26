import path from 'path';
import { CodeGraph } from './codegraph.js';
import { GitGuard } from './git-guard.js';
import { ProjectDetector } from '../detector/project.js';
import { DetectedProject } from '../types/index.js';
import { HandoffManager, HandoffPlan, HandoffStep } from './handoff.js';

export interface InspectionResult {
  directory: string;
  filesScanned: number;
  skeleton: string;
  stack: DetectedProject;
  checkpointRef?: string;
  status: 'protected_and_surveyed';
}

export interface PlanExecutionPayload {
  plan: HandoffPlan;
  currentStep: HandoffStep;
  checkpointRef?: string;
  stack: DetectedProject;
  planMarkdownPath: string;
}

export class Inspector {
  /**
   * All-in-one survey AST, stack detection, and git safety checkpoint
   */
  static async inspectAndGuard(params?: {
    directory?: string;
    maxFiles?: number;
    checkpoint?: boolean;
  }): Promise<InspectionResult> {
    const cwd = params?.directory ? path.resolve(params.directory) : process.cwd();
    const maxFiles = params?.maxFiles ?? 200;
    const shouldCheckpoint = params?.checkpoint !== false;

    // 1. Scan CodeGraph AST (<10ms)
    const files = await CodeGraph.scanFiles(cwd, maxFiles);
    const skeleton = await CodeGraph.generateSkeleton(cwd);

    // 2. Detect project stack and conventions
    const stack = await ProjectDetector.detect(cwd);

    // 3. Git safety checkpoint
    let checkpointRef: string | undefined;
    if (shouldCheckpoint) {
      try {
        const isGit = await GitGuard.isGitRepo(cwd);
        if (isGit) {
          const ref = await GitGuard.createCheckpoint(cwd);
          if (ref) checkpointRef = ref;
        }
      } catch {
        // Ignore checkpoint errors if not a git repo
      }
    }

    return {
      directory: cwd,
      filesScanned: files.length,
      skeleton,
      stack,
      checkpointRef,
      status: 'protected_and_surveyed',
    };
  }

  /**
   * All-in-one plan execution activator
   */
  static async startPlanExecution(params: {
    directory?: string;
    stepId?: number;
    autoCheckpoint?: boolean;
  }): Promise<PlanExecutionPayload> {
    const cwd = params.directory ? path.resolve(params.directory) : process.cwd();
    const plan = await HandoffManager.getPlan(cwd);
    if (!plan) {
      throw new Error('No active handoff plan found in this project. Create one first using duo plan or duo_handoff_plan.');
    }

    let checkpointRef: string | undefined;
    if (params.autoCheckpoint !== false) {
      try {
        const isGit = await GitGuard.isGitRepo(cwd);
        if (isGit) {
          const ref = await GitGuard.createCheckpoint(cwd);
          if (ref) checkpointRef = ref;
        }
      } catch {
        // Ignore checkpoint errors
      }
    }

    const stack = await ProjectDetector.detect(cwd);

    let targetStep = plan.steps.find((s) => s.id === params.stepId);
    if (!targetStep) {
      targetStep = plan.steps.find((s) => s.status !== 'completed') || plan.steps[0];
    }

    const { plan: updatedPlan, planMarkdownPath } = await HandoffManager.updateStepStatus({
      directory: cwd,
      stepId: targetStep.id,
      status: 'in_progress',
    });

    return {
      plan: updatedPlan,
      currentStep: { ...targetStep, status: 'in_progress' },
      checkpointRef,
      stack,
      planMarkdownPath,
    };
  }
}
