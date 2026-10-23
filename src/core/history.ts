import fs from 'fs-extra';
import path from 'path';

export class HistoryManager {
  private static historyFile = path.join(process.cwd(), '.duo', 'history');

  static async loadHistory(): Promise<string[]> {
    try {
      if (await fs.pathExists(this.historyFile)) {
        const raw = await fs.readFile(this.historyFile, 'utf-8');
        return raw
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
      }
    } catch {
      // Ignore read errors
    }
    return [];
  }

  static async append(line: string): Promise<void> {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    // Do not store empty, slash commands, or common exit/control commands
    if (
      !trimmed ||
      trimmed.startsWith('/') ||
      ['exit', 'quit', ':q', 'q', 'bye', 'clear', 'cls'].includes(lower)
    ) {
      return;
    }

    try {
      await fs.ensureDir(path.dirname(this.historyFile));
      const current = await this.loadHistory();
      // Avoid immediate duplicate
      if (current.length > 0 && current[current.length - 1] === trimmed) {
        return;
      }
      current.push(trimmed);
      // Keep last 300 entries
      const capped = current.slice(-300);
      await fs.writeFile(this.historyFile, capped.join('\n') + '\n', 'utf-8');
    } catch {
      // Ignore write errors
    }
  }

  static async clear(cwd: string = process.cwd()): Promise<void> {
    try {
      const duoDir = path.join(cwd, '.duo');
      if (await fs.pathExists(duoDir)) {
        await fs.remove(duoDir);
      }
    } catch {}
  }
}
