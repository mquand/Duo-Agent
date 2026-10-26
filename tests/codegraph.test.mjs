import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { CodeGraph } from '../dist/core/codegraph.js';

test('CodeGraph - scans project files and filters out ignored directories', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-codegraph-test-'));

  // Create mock files
  await fs.outputFile(path.join(tmpDir, 'src/index.ts'), 'export const a = 1;');
  await fs.outputFile(path.join(tmpDir, 'src/utils/math.js'), 'export const b = 2;');
  await fs.outputFile(path.join(tmpDir, 'node_modules/pkg/index.js'), 'ignored');
  await fs.outputFile(path.join(tmpDir, '.git/config'), 'ignored');
  await fs.outputFile(path.join(tmpDir, 'dist/bundle.js'), 'ignored');
  await fs.outputFile(path.join(tmpDir, 'custom-heavy/data.json'), 'ignored');

  // Add custom .duoignore
  await fs.outputFile(path.join(tmpDir, '.duoignore'), '# Ignore custom\ncustom-heavy\n');

  const scanned = await CodeGraph.scanFiles(tmpDir);

  // Assert target files are included
  assert.ok(scanned.includes('src/index.ts'));
  assert.ok(scanned.includes('src/utils/math.js'));

  // Assert ignored paths are excluded
  assert.ok(!scanned.some((f) => f.includes('node_modules')));
  assert.ok(!scanned.some((f) => f.includes('.git')));
  assert.ok(!scanned.some((f) => f.includes('dist')));
  assert.ok(!scanned.some((f) => f.includes('custom-heavy')));

  // Test skeleton generation
  const skeleton = await CodeGraph.generateSkeleton(tmpDir);
  assert.match(skeleton, /CODEBASE STRUCTURE/);
  assert.match(skeleton, /src\/index\.ts/);

  await fs.remove(tmpDir);
});
