import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { AuthManager } from '../dist/auth/oauth.js';
import { HandoffManager } from '../dist/core/handoff.js';
import { Inspector } from '../dist/core/inspector.js';
import { ConfigManager } from '../dist/config/manager.js';

test('AuthManager - reports status and detects oauth/tokens', async () => {
  const report = AuthManager.getAuthStatusReport();
  assert.ok(report.google);
  assert.ok(report.anthropic);
  assert.ok(report.openaiCompatible);
});

test('HandoffManager - saves, retrieves, and updates plan', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-agent-test-'));
  try {
    const { plan, planMarkdownPath, planJsonPath } = await HandoffManager.savePlan({
      title: 'Test Integration Plan',
      task: 'Build test feature',
      summary: 'Summary of feature',
      steps: [
        { id: 1, title: 'Step 1', instruction: 'Do step 1', verification: 'Check 1' },
        { id: 2, title: 'Step 2', instruction: 'Do step 2', verification: 'Check 2' }
      ],
      directory: tmpDir
    });

    assert.strictEqual(plan.steps.length, 2);
    assert.ok(fs.existsSync(planMarkdownPath));
    assert.ok(fs.existsSync(planJsonPath));

    const retrieved = await HandoffManager.getPlan(tmpDir);
    assert.strictEqual(retrieved.title, 'Test Integration Plan');

    const updated = await HandoffManager.updateStepStatus({
      directory: tmpDir,
      stepId: 1,
      status: 'completed',
      note: 'Step 1 done!'
    });
    assert.strictEqual(updated.plan.steps[0].status, 'completed');
  } finally {
    await fs.remove(tmpDir);
  }
});

test('Inspector - inspectAndGuard performs rapid AST and stack detection', async () => {
  const res = await Inspector.inspectAndGuard({
    directory: process.cwd(),
    checkpoint: false
  });
  assert.ok(res.filesScanned >= 0);
  assert.ok(res.skeleton !== undefined);
  assert.ok(res.stack);
  assert.strictEqual(res.status, 'protected_and_surveyed');
});
