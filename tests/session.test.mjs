import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { SessionManager } from '../dist/core/session.js';

test('SessionManager - creates and manages isolated sessions with cost tracking', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-session-test-'));

  const manager = new SessionManager(tmpDir);

  // 1. Get active default session
  const defaultSession = await manager.getActiveSession();
  assert.ok(defaultSession.id);
  assert.equal(defaultSession.records.length, 0);

  // 2. Record task and cost
  await manager.recordTask(defaultSession, 'task_1', 'Refactor auth', ['src/auth.ts']);
  defaultSession.totalTokens = (defaultSession.totalTokens || 0) + 14200;
  defaultSession.estimatedCostUsd = (defaultSession.estimatedCostUsd || 0) + 0.0213;
  await manager.saveSession(defaultSession);

  const updatedSession = await manager.getActiveSession();
  assert.equal(updatedSession.records.length, 1);
  assert.equal(updatedSession.totalTokens, 14200);
  assert.ok(Math.abs(updatedSession.estimatedCostUsd - 0.0213) < 0.0001);

  // 3. Create fresh new session
  const paymentSession = await manager.createSession('payment-flow');
  assert.equal(paymentSession.title, 'payment-flow');
  assert.equal(paymentSession.records.length, 0);
  assert.equal(paymentSession.totalTokens || 0, 0);

  // 4. Switch back to original session
  const switchedBack = await manager.switchSession(defaultSession.id);
  assert.equal(switchedBack.id, defaultSession.id);
  assert.equal(switchedBack.totalTokens, 14200);

  // 5. List sessions
  const allSessions = await manager.listSessions();
  assert.equal(allSessions.length, 2);

  await fs.remove(tmpDir);
});
