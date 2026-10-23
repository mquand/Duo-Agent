import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitGuard } from '../dist/core/git-guard.js';

const execAsync = promisify(exec);

test('GitGuard - detects git repository, checkpoints and rolls back', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-git-test-'));

  try {
    // 1. Initialize temporary git repository
    await execAsync('git init -b main', { cwd: tmpDir });
    await execAsync('git config user.name "Duo Test"', { cwd: tmpDir });
    await execAsync('git config user.email "test@duo.local"', { cwd: tmpDir });

    assert.equal(await GitGuard.isGitRepo(tmpDir), true);

    const testFile = path.join(tmpDir, 'file.txt');
    await fs.writeFile(testFile, 'initial content\n', 'utf-8');
    await execAsync('git add file.txt && git commit -m "initial commit"', { cwd: tmpDir });

    // 2. Modify file and check uncommitted status
    await fs.writeFile(testFile, 'modified content\n', 'utf-8');
    assert.equal(await GitGuard.hasUncommittedChanges(tmpDir), true);

    // 3. Rollback
    const rolledBack = await GitGuard.rollback(null, tmpDir);
    assert.equal(rolledBack, true);

    // 4. Assert content is restored
    const restoredContent = await fs.readFile(testFile, 'utf-8');
    assert.equal(restoredContent, 'initial content\n');
    assert.equal(await GitGuard.hasUncommittedChanges(tmpDir), false);
  } finally {
    await fs.remove(tmpDir);
  }
});

test('GitGuard - preserves user untracked files while cleaning agent-created files on rollback', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-git-safe-'));

  try {
    await execAsync('git init -b main', { cwd: tmpDir });
    await execAsync('git config user.name "Duo Test"', { cwd: tmpDir });
    await execAsync('git config user.email "test@duo.local"', { cwd: tmpDir });

    // Initial commit to make HEAD valid
    await fs.writeFile(path.join(tmpDir, 'readme.md'), 'initial\n', 'utf-8');
    await execAsync('git add readme.md && git commit -m "init"', { cwd: tmpDir });

    // User had a pre-existing untracked file before Duo ran
    const userUntracked = path.join(tmpDir, 'user-notes.txt');
    await fs.writeFile(userUntracked, 'my secret notes\n', 'utf-8');

    // Duo starts and captures checkpoint
    const checkpoint = await GitGuard.createCheckpoint(tmpDir);

    // Agent creates a new file during execution
    const agentFile = path.join(tmpDir, 'agent-generated.js');
    await fs.writeFile(agentFile, 'console.log("agent");\n', 'utf-8');

    // Rollback is triggered
    await GitGuard.rollback(checkpoint, tmpDir);

    // User's untracked file MUST still exist!
    assert.equal(await fs.pathExists(userUntracked), true);
    assert.equal(await fs.readFile(userUntracked, 'utf-8'), 'my secret notes\n');

    // Agent's generated file MUST be deleted!
    assert.equal(await fs.pathExists(agentFile), false);
  } finally {
    await fs.remove(tmpDir);
  }
});
