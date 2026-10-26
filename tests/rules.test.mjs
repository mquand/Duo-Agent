import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ProjectDetector } from '../dist/detector/project.js';

test('ProjectDetector - detects local repository rules (.duorules, CLAUDE.md, etc.)', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-rules-test-'));

  try {
    // 1. Create a mock Elixir project with .duorules
    await fs.writeFile(path.join(tmpDir, 'mix.exs'), 'defmodule Test.MixProject do end');
    await fs.writeFile(path.join(tmpDir, '.duorules'), '# Custom Repo Rules\n- Always test controllers with Wallaby.');

    const detected = await ProjectDetector.detect(tmpDir);
    assert.equal(detected.type, 'elixir');
    assert.match(detected.ruleFile || '', /\.duorules/);
    assert.match(detected.ruleContent || '', /Always test controllers with Wallaby/);
  } finally {
    await fs.remove(tmpDir);
  }
});

test('ProjectDetector - auto-generates tailored rules template for different stacks', async () => {
  const elixirTemplate = ProjectDetector.generateRuleTemplate('elixir');
  assert.match(elixirTemplate, /Elixir & Phoenix/);
  assert.match(elixirTemplate, /mix test/);
  assert.match(elixirTemplate, /Ponytail/);

  const nodeTemplate = ProjectDetector.generateRuleTemplate('node');
  assert.match(nodeTemplate, /TypeScript/);
  assert.match(nodeTemplate, /npm test/);

  const pyTemplate = ProjectDetector.generateRuleTemplate('python');
  assert.match(pyTemplate, /PEP 8/);
  assert.match(pyTemplate, /pytest/);
});

test('ProjectDetector - initRules initializes .duorules file in project root', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-rules-init-'));

  try {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'sample-project', scripts: { test: 'jest' } });
    await fs.writeFile(path.join(tmpDir, 'tsconfig.json'), '{}');

    const res = await ProjectDetector.initRules(tmpDir);
    assert.equal(res.created, true);
    assert.equal(res.file, '.duorules');

    const createdContent = await fs.readFile(res.path, 'utf-8');
    assert.match(createdContent, /TypeScript/);
    assert.match(createdContent, /Ponytail/);

    // Running initRules again without force should not overwrite
    const secondRun = await ProjectDetector.initRules(tmpDir, false);
    assert.equal(secondRun.created, false);
  } finally {
    await fs.remove(tmpDir);
  }
});
