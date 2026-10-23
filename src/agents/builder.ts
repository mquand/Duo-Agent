import { exec } from 'child_process';
import { promisify } from 'util';
import { LLMProvider } from '../providers/base.js';
import { DAGStep } from '../types/index.js';
import { ContextSlicer } from '../core/slicer.js';
import { DiffEngine } from '../core/diff-engine.js';
import { ActivityLogger } from '../core/monitor.js';

const execAsync = promisify(exec);

export interface BuilderResult {
  success: boolean;
  modifiedFiles: string[];
  findings?: string;
  error?: string;
  patchPreviews: string[];
}

export class BuilderAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async executeStep(
    step: DAGStep,
    blackboardSummary?: string,
    cwd: string = process.cwd(),
    projectRules?: string
  ): Promise<BuilderResult> {
    const patchPreviews: string[] = [];
    const modifiedFiles: string[] = [];

    // 1. Gather sliced context of target files
    let filesContext = '';
    for (const file of step.target_files) {
      const sliced = await ContextSlicer.sliceFile(file, step.instructions, cwd);
      filesContext += `\n--- FILE: ${file} (Total lines: ${sliced.totalLines}) ---\n${sliced.content}\n`;
    }

    const systemPrompt = `You are a Senior Implementation Engineer (Builder).
Objective: Modify source code minimally, surgically, and accurately according to the PONYTAIL PHILOSOPHY:
- Do not write unnecessary boilerplate or wrapper functions.
- Modify ONLY the specific lines required.
- Emit surgical SEARCH/REPLACE blocks following this EXACT format:

### File: path/to/file.ext
<<<<<<< SEARCH
// exact original code characters to be replaced
=======
// updated replacement code
>>>>>>>

If creating a brand new file, use:
### File: path/to/new_file.ext
<<<<<<< SEARCH
=======
// entire initial content of the new file
>>>>>>>`;

    let userPrompt = `TASK INSTRUCTIONS: ${step.instructions}\n`;
    if (projectRules) {
      userPrompt += `\nPROJECT GUIDELINES & REPO CONVENTIONS:\n${projectRules}\n`;
    }
    if (blackboardSummary) {
      userPrompt += `\n${blackboardSummary}\n`;
    }
    userPrompt += `\nTARGET FILE CONTEXT:${filesContext}\n\nEmit the surgical SEARCH/REPLACE blocks to complete the task:`;

    // 2. Generate and apply diff
    let attempt = 0;
    const maxAttempts = 3;
    let lastError = '';

    while (attempt < maxAttempts) {
      attempt++;
      let currentPrompt = userPrompt;
      if (lastError) {
        currentPrompt += `\n\n⚠️ PREVIOUS ATTEMPT FAILED WITH ERROR:\n${lastError}\nAnalyze the root cause and provide corrected SEARCH/REPLACE blocks!`;
      }

      const response = await this.provider.generate([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: currentPrompt },
      ]);

      const blocks = DiffEngine.parseDiffBlocks(response.text, step.target_files[0]);
      if (blocks.length === 0) {
        lastError = 'No valid SEARCH/REPLACE blocks extracted from model response.';
        continue;
      }

      let applyFailed = false;
      for (const block of blocks) {
        const res = await DiffEngine.applyDiffBlock(block, cwd);
        if (!res.success) {
          applyFailed = true;
          lastError = res.error || 'Diff application failed.';
          break;
        }
        if (res.patchPreview) {
          patchPreviews.push(res.patchPreview);
          await ActivityLogger.log('diff', `Modified: ${block.file}`, res.patchPreview);
        }
        if (!modifiedFiles.includes(block.file)) modifiedFiles.push(block.file);
      }

      if (applyFailed) continue;

      // 3. Verification Command (Self-Healing Loop)
      if (step.verification_cmd) {
        try {
          await ActivityLogger.log('test', `Running: ${step.verification_cmd}`);
          await execAsync(step.verification_cmd, { cwd });
          await ActivityLogger.log('test', `Test verified (PASS): ${step.verification_cmd}`);
          return {
            success: true,
            modifiedFiles,
            findings: `Successfully modified ${modifiedFiles.join(', ')} and verified with ${step.verification_cmd}.`,
            patchPreviews,
          };
        } catch (cmdError: any) {
          const stderr = cmdError.stderr || cmdError.stdout || cmdError.message;
          const truncatedLog = stderr.split('\n').slice(-30).join('\n');
          lastError = `Verification command [${step.verification_cmd}] failed:\n${truncatedLog}`;
          await ActivityLogger.log('test', `Test failed (FAIL): ${step.verification_cmd}`, truncatedLog);
          continue; // Self-heal on next iteration
        }
      } else {
        return {
          success: true,
          modifiedFiles,
          findings: `Successfully applied changes to: ${modifiedFiles.join(', ')}.`,
          patchPreviews,
        };
      }
    }

    return {
      success: false,
      modifiedFiles,
      error: `Failed after ${maxAttempts} attempts. Last error: ${lastError}`,
      patchPreviews,
    };
  }
}
