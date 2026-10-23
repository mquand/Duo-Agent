import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { DiffEngine } from '../dist/core/diff-engine.js';

test('DiffEngine - parseDiffBlocks parses standard SEARCH/REPLACE blocks', () => {
  const rawResponse = `
Here are the changes:

### File: src/utils/math.ts
<<<<<<< SEARCH
export function add(a: number, b: number): number {
  return a - b;
}
=======
export function add(a: number, b: number): number {
  return a + b;
}
>>>>>>>
`;

  const blocks = DiffEngine.parseDiffBlocks(rawResponse);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].file, 'src/utils/math.ts');
  assert.match(blocks[0].searchBlock, /return a - b/);
  assert.match(blocks[0].replaceBlock, /return a \+ b/);
});

test('DiffEngine - applyDiffBlock replaces exact matching content', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-diff-test-'));
  const targetFile = 'app.js';
  const fullPath = path.join(tmpDir, targetFile);

  await fs.writeFile(
    fullPath,
    `const PORT = 3000;\nconst HOST = 'localhost';\nconsole.log(PORT);\n`,
    'utf-8'
  );

  const block = {
    file: targetFile,
    searchBlock: `const PORT = 3000;\nconst HOST = 'localhost';`,
    replaceBlock: `const PORT = 8080;\nconst HOST = '0.0.0.0';`,
  };

  const result = await DiffEngine.applyDiffBlock(block, tmpDir);
  assert.equal(result.success, true);
  assert.equal(result.appliedCount, 1);

  const updatedContent = await fs.readFile(fullPath, 'utf-8');
  assert.match(updatedContent, /const PORT = 8080;/);
  assert.match(updatedContent, /const HOST = '0.0.0.0';/);

  await fs.remove(tmpDir);
});

test('DiffEngine - applyDiffBlock creates new file if it does not exist', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'duo-diff-new-'));
  const targetFile = 'sub/dir/new-file.txt';

  const block = {
    file: targetFile,
    searchBlock: '',
    replaceBlock: 'Hello Duo-Agent World!',
  };

  const result = await DiffEngine.applyDiffBlock(block, tmpDir);
  assert.equal(result.success, true);

  const fullPath = path.join(tmpDir, targetFile);
  assert.equal(await fs.pathExists(fullPath), true);
  const content = await fs.readFile(fullPath, 'utf-8');
  assert.equal(content, 'Hello Duo-Agent World!');

  await fs.remove(tmpDir);
});
