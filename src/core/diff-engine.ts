import fs from 'fs-extra';
import path from 'path';
import * as diff from 'diff';
import chalk from 'chalk';
import { DiffBlock } from '../types/index.js';

export interface ApplyResult {
  success: boolean;
  file: string;
  appliedCount: number;
  patchPreview?: string;
  error?: string;
}

export class DiffEngine {
  static parseDiffBlocks(rawText: string, defaultFile?: string): DiffBlock[] {
    const blocks: DiffBlock[] = [];
    const searchReplaceRegex = /(?:### File:?\s*([^\n]+)\n)?<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>/g;

    let match;
    while ((match = searchReplaceRegex.exec(rawText)) !== null) {
      const explicitFile = match[1]?.trim();
      const searchBlock = match[2];
      const replaceBlock = match[3];

      const targetFile = explicitFile || defaultFile || '';
      if (targetFile) {
        blocks.push({
          file: targetFile,
          searchBlock,
          replaceBlock,
        });
      }
    }

    return blocks;
  }

  static async applyDiffBlock(block: DiffBlock, cwd: string = process.cwd()): Promise<ApplyResult> {
    const fullPath = path.isAbsolute(block.file) ? block.file : path.join(cwd, block.file);

    // If file does not exist, create it
    if (!(await fs.pathExists(fullPath))) {
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, block.replaceBlock, 'utf-8');
      return {
        success: true,
        file: block.file,
        appliedCount: 1,
        patchPreview: chalk.green(`+ [Created new file ${block.file}]:\n${block.replaceBlock.slice(0, 300)}`),
      };
    }

    let content = await fs.readFile(fullPath, 'utf-8');
    const originalContent = content;

    // 1. Exact match attempt
    if (content.includes(block.searchBlock)) {
      content = content.replace(block.searchBlock, block.replaceBlock);
    } else {
      // 2. Normalized whitespace match
      const matched = this.fuzzyReplace(content, block.searchBlock, block.replaceBlock);
      if (matched !== null) {
        content = matched;
      } else {
        return {
          success: false,
          file: block.file,
          appliedCount: 0,
          error: `SEARCH block not found in file ${block.file}. Please verify the target code.`,
        };
      }
    }

    await fs.writeFile(fullPath, content, 'utf-8');

    // Create colored patch preview
    const patch = diff.createPatch(block.file, originalContent, content);
    const colorizedPatch = this.colorizePatch(patch);

    return {
      success: true,
      file: block.file,
      appliedCount: 1,
      patchPreview: colorizedPatch,
    };
  }

  private static fuzzyReplace(content: string, search: string, replace: string): string | null {
    const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
    const normContent = normalize(content);
    const normSearch = normalize(search);

    if (normContent.includes(normSearch)) {
      // Perform replacement on normalized content
      return normContent.replace(normSearch, replace);
    }
    return null;
  }

  static colorizePatch(patchStr: string): string {
    return patchStr
      .split('\n')
      .map((line) => {
        if (line.startsWith('+') && !line.startsWith('+++')) return chalk.green(line);
        if (line.startsWith('-') && !line.startsWith('---')) return chalk.red(line);
        if (line.startsWith('@@')) return chalk.cyan(line);
        return chalk.gray(line);
      })
      .join('\n');
  }
}
