import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ArchitectAgent } from '../dist/agents/architect.js';
import { BuilderAgent } from '../dist/agents/builder.js';
import { AuditorAgent } from '../dist/agents/auditor.js';

class MockLLMProvider {
  constructor(responses) {
    this.responses = responses;
    this.callIndex = 0;
  }

  async generate(messages, options) {
    const nextResponse = this.responses[this.callIndex++];
    if (!nextResponse) {
      return {
        text: '{"approved": true, "critique": "OK"}',
        inputTokens: 150,
        outputTokens: 50,
      };
    }

    const text = typeof nextResponse === 'string' ? nextResponse : JSON.stringify(nextResponse);
    return {
      text,
      inputTokens: 200,
      outputTokens: 80,
    };
  }
}

test('E2E Sandwich Architecture - Architect -> Builder -> Auditor execution pipeline', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-e2e-test-'));

  try {
    const targetFile = 'service.js';
    const initialContent = `// placeholder\nexport const VERSION = '1.0.0';\n`;
    await fs.writeFile(path.join(tmpDir, targetFile), initialContent, 'utf-8');

    // 1. Architect Phase
    const architectMock = new MockLLMProvider([
      {
        goal: 'Add authenticate function',
        summary: 'Expose authenticate helper in service.js',
        dag: [
          {
            id: 'step_1',
            title: 'Implement authenticate function',
            target_files: [targetFile],
            instructions: 'Add authenticate function returning true for valid tokens',
            depends_on: [],
          },
        ],
      },
    ]);

    const architect = new ArchitectAgent(architectMock);
    const plan = await architect.plan('Add auth to service.js', '// Codebase outline');

    assert.equal(plan.goal, 'Add authenticate function');
    assert.equal(plan.dag.length, 1);
    assert.equal(plan.dag[0].target_files[0], targetFile);

    // 2. Builder Phase
    const builderDiff = `
### File: ${targetFile}
<<<<<<< SEARCH
// placeholder
=======
export function authenticate(token) { return token === 'secret'; }
>>>>>>>
`;

    const builderMock = new MockLLMProvider([builderDiff]);
    const builder = new BuilderAgent(builderMock);

    const stepResult = await builder.executeStep(plan.dag[0], '', tmpDir);
    assert.equal(stepResult.success, true);
    assert.ok(stepResult.modifiedFiles.includes(targetFile));

    // Verify file on disk was modified surgically
    const updatedContent = await fs.readFile(path.join(tmpDir, targetFile), 'utf-8');
    assert.match(updatedContent, /export function authenticate\(token\)/);
    assert.match(updatedContent, /export const VERSION = '1\.0\.0';/);

    // 3. Auditor Phase
    const auditorMock = new MockLLMProvider([
      {
        approved: true,
        critique: 'Implementation is clean and strictly scoped.',
      },
    ]);

    const auditor = new AuditorAgent(auditorMock);
    const gitDiff = `+export function authenticate(token) { return token === 'secret'; }`;
    const review = await auditor.review('Add auth to service.js', gitDiff, '', tmpDir);

    assert.equal(review.approved, true);
    assert.match(review.critique, /Implementation is clean/);
  } finally {
    await fs.remove(tmpDir);
  }
});
