import { LLMProvider } from '../providers/base.js';
import { AuditorReviewResult } from '../types/index.js';
import { DiffEngine } from '../core/diff-engine.js';

export class AuditorAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async review(
    goal: string,
    gitDiff: string,
    projectRules?: string,
    cwd: string = process.cwd(),
    testResults?: { passed: boolean; output: string }
  ): Promise<AuditorReviewResult> {
    if (!gitDiff || gitDiff.trim().length === 0) {
      return {
        approved: true,
        critique: 'No codebase modifications detected.',
      };
    }

    const systemPrompt = `You are the Chief Code Auditor & Security Lead.
Your responsibility is to thoroughly review the final Git Diff after all Builders have completed their tasks:
1. ACCURACY: Does the diff fulfill 100% of the initial objective without missing logic?
2. GROUND TRUTH VERIFICATION: Verify against real test execution output (if provided). If tests failed, pinpoint root causes or provide polishDiffs to fix them.
3. EDGE CASES: Check for nil/null dereferences, empty collections, off-by-one errors, or malformed inputs.
4. REGRESSIONS & SECURITY: Ensure existing functionality is not broken and no security vulnerabilities (injection, auth bypass, secret leaks) are introduced.
5. PONYTAIL PHILOSOPHY: Flag unnecessary abstractions, dead code, or bloated modifications.

SPECIAL AUTHORITY (LAST-MILE POLISH):
If you identify minor bugs, regressions, or missing edge handling, you are authorized to provide "polishDiffs" (SEARCH/REPLACE blocks) to surgically patch the code immediately without bouncing back to Builders.

MANDATORY OUTPUT FORMAT (Raw JSON only):
{
  "approved": true or false,
  "critique": "Concise architectural critique (2-4 sentences)",
  "polishDiffs": [
    {
      "file": "path/to/file.ext",
      "searchBlock": "exact original code to replace",
      "replaceBlock": "optimal polished code"
    }
  ]
}`;

    let userPrompt = `ORIGINAL GOAL: "${goal}"\n\n`;
    if (projectRules) {
      userPrompt += `PROJECT RULES:\n${projectRules}\n\n`;
    }

    if (testResults) {
      userPrompt += `LOCAL TEST RUNNER RESULTS (GROUND TRUTH):\nStatus: ${testResults.passed ? 'ALL TESTS PASSED' : 'TESTS FAILED'}\nOutput Logs:\n${testResults.output.slice(0, 4000)}\n\n`;
      if (!testResults.passed) {
        userPrompt += `CRITICAL: The local test suite failed! You MUST NOT approve ("approved": false) unless you can completely fix the regressions via "polishDiffs"!\n\n`;
      }
    }

    userPrompt += `CUMULATIVE GIT DIFF:\n\`\`\`diff\n${gitDiff.slice(0, 15000)}\n\`\`\`\n\nPerform rigorous audit and output the JSON evaluation:`;

    const response = await this.provider.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { json: true, maxTokens: 3000 }
    );

    const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const result = JSON.parse(cleanJson) as AuditorReviewResult;

      // Apply polish diffs if provided
      if (result.polishDiffs && result.polishDiffs.length > 0) {
        for (const polish of result.polishDiffs) {
          await DiffEngine.applyDiffBlock(polish, cwd);
        }
      }

      return result;
    } catch {
      return {
        approved: true,
        critique: response.text || 'Auditor approved.',
      };
    }
  }
}
