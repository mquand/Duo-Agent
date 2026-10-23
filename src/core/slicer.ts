import fs from 'fs-extra';
import path from 'path';

export interface SlicedContext {
  filePath: string;
  isSliced: boolean;
  totalLines: number;
  startLine?: number;
  endLine?: number;
  content: string;
}

export class ContextSlicer {
  static readonly MAX_FULL_FILE_LINES = 400;

  static async sliceFile(filePath: string, instruction: string, cwd: string = process.cwd()): Promise<SlicedContext> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);

    if (!(await fs.pathExists(fullPath))) {
      return {
        filePath,
        isSliced: false,
        totalLines: 0,
        content: `// [NEW FILE - DOES NOT EXIST YET]`,
      };
    }

    const raw = await fs.readFile(fullPath, 'utf-8');
    const lines = raw.split('\n');
    const totalLines = lines.length;

    if (totalLines <= this.MAX_FULL_FILE_LINES) {
      return {
        filePath,
        isSliced: false,
        totalLines,
        content: raw,
      };
    }

    // Attempt to locate target function or symbol from instruction
    const targetSymbol = this.findTargetSymbol(instruction, lines);
    let targetIndex = -1;

    if (targetSymbol) {
      targetIndex = lines.findIndex((l) => l.includes(targetSymbol));
    }

    if (targetIndex === -1) {
      // Default slice: First 250 lines
      const sliced = lines.slice(0, 250).join('\n');
      return {
        filePath,
        isSliced: true,
        totalLines,
        startLine: 1,
        endLine: 250,
        content: `// [LARGE FILE (${totalLines} LINES) - SLICED LINES 1 TO 250]\n${sliced}\n// ... [${totalLines - 250} remaining lines omitted]`,
      };
    }

    // Window around target symbol: 40 lines before, 80 lines after
    const start = Math.max(0, targetIndex - 40);
    const end = Math.min(totalLines, targetIndex + 80);
    const sliced = lines.slice(start, end).join('\n');

    return {
      filePath,
      isSliced: true,
      totalLines,
      startLine: start + 1,
      endLine: end,
      content: `// [LARGE FILE (${totalLines} LINES) - SLICED AROUND '${targetSymbol}' FROM LINE ${start + 1} TO ${end}]\n${sliced}`,
    };
  }

  private static findTargetSymbol(instruction: string, lines: string[]): string | null {
    // Look for identifier words in instruction (e.g. filter_by_date, OrderController, etc.)
    const words = instruction.match(/[a-zA-Z0-9_]{4,}/g) || [];
    for (const word of words) {
      if (['function', 'method', 'controller', 'model', 'update', 'create'].includes(word.toLowerCase())) {
        continue;
      }
      const match = lines.some((l) => l.includes(word));
      if (match) return word;
    }
    return null;
  }
}
