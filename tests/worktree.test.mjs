import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WorktreeManager } from '../dist/core/worktree.js';
import { IntegrationManager } from '../dist/core/integration.js';

const execAsync = promisify(exec);

test('WorktreeManager & IntegrationManager - isolated task worktrees & safe integration merge', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-worktree-test-'));

  try {
    // 1. Initialize temporary git repository
    await execAsync('git init -b main', { cwd: tmpDir });
    await execAsync('git config user.name "Duo Worktree Tester"', { cwd: tmpDir });
    await execAsync('git config user.email "tester@duo.local"', { cwd: tmpDir });

    const mainFile = path.join(tmpDir, 'service.js');
    await fs.writeFile(mainFile, 'export const initial = true;\n', 'utf-8');
    await execAsync('git add service.js && git commit -m "initial commit"', { cwd: tmpDir });

    const worktreeMgr = new WorktreeManager(tmpDir);
    const integrationMgr = new IntegrationManager(tmpDir);

    assert.equal(await worktreeMgr.isSupported(), true);

    // 2. Create isolated worktree for Task 1
    const task1 = await worktreeMgr.create('task_auth', 'HEAD');
    assert.ok(await fs.pathExists(task1.worktreePath));
    assert.equal(task1.branch, 'duo/task-task_auth');

    // 3. Modify file inside worktree
    const worktreeServiceFile = path.join(task1.worktreePath, 'service.js');
    await fs.appendFile(worktreeServiceFile, 'export const auth = () => "ok";\n', 'utf-8');

    // 4. Assert main repository is UNTOUCHED
    const mainContentBeforeMerge = await fs.readFile(mainFile, 'utf-8');
    assert.equal(mainContentBeforeMerge, 'export const initial = true;\n');

    // 5. Commit changes inside worktree
    const committed = await worktreeMgr.commitWorktree(task1.worktreePath, 'feat: implement auth logic');
    assert.equal(committed, true);

    // 6. Merge task branch via IntegrationManager into main repository
    const mergeResult = await integrationMgr.mergeTaskBranch(task1.branch, 'implement auth logic');
    assert.equal(mergeResult.success, true);

    // 7. Verify main repository now has the integrated changes
    const mainContentAfterMerge = await fs.readFile(mainFile, 'utf-8');
    assert.match(mainContentAfterMerge, /export const auth/);

    // 8. Cleanup worktree
    await worktreeMgr.cleanup('task_auth');
    assert.equal(await fs.pathExists(task1.worktreePath), false);
  } finally {
    await fs.remove(tmpDir);
  }
});
