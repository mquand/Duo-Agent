import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ContextSlicer } from '../dist/core/slicer.js';

test('ContextSlicer - keeps small files intact (< 400 lines)', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-slicer-test-'));
  const targetFile = 'small.ts';
  const fullPath = path.join(tmpDir, targetFile);

  const sampleContent = Array.from({ length: 50 }, (_, i) => `console.log("line ${i}");`).join('\n');
  await fs.writeFile(fullPath, sampleContent, 'utf-8');

  const sliced = await ContextSlicer.sliceFile(targetFile, 'fix console', tmpDir);
  assert.equal(sliced.isSliced, false);
  assert.equal(sliced.totalLines, 50);
  assert.equal(sliced.content, sampleContent);

  await fs.remove(tmpDir);
});

test('ContextSlicer - slices function scope for large files (> 400 lines)', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-slicer-large-'));
  const targetFile = 'large.ts';
  const fullPath = path.join(tmpDir, targetFile);

  const lines = Array.from({ length: 600 }, (_, i) => {
    if (i === 450) {
      return 'export function calculateCriticalTax() { return 0.1; }';
    }
    return `// filler line ${i}`;
  });

  await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');

  const sliced = await ContextSlicer.sliceFile(
    targetFile,
    'Update calculateCriticalTax logic to 0.15',
    tmpDir
  );

  assert.equal(sliced.isSliced, true);
  assert.equal(sliced.totalLines, 600);
  assert.match(sliced.content, /calculateCriticalTax/);

  await fs.remove(tmpDir);
});
