import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';

export class CodeGraph {
  static readonly IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/.git/**',
    '**/_build/**',
    '**/deps/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/target/**',
    '**/vendor/**',
    '**/*.min.js',
    '**/*.lock',
    '**/package-lock.json',
  ];

  static async scanFiles(cwd: string = process.cwd(), limit = 200): Promise<string[]> {
    const files = await fg(['**/*.*'], {
      cwd,
      ignore: this.IGNORE_PATTERNS,
      dot: false,
    });
    return files.slice(0, limit);
  }

  static async generateSkeleton(cwd: string = process.cwd(), maxChars = 8000): Promise<string> {
    const files = await this.scanFiles(cwd, 150);
    let skeleton = '## CẤU TRÚC CODEBASE & CHỮ KÝ HÀM (CODE SKELETON):\n\n';

    for (const relPath of files) {
      if (skeleton.length >= maxChars) {
        skeleton += '\n... [Đã cắt bớt để tối ưu token]\n';
        break;
      }

      const fullPath = path.join(cwd, relPath);
      const ext = path.extname(relPath).toLowerCase();

      // Only inspect code files
      if (!['.ex', '.exs', '.ts', '.js', '.jsx', '.tsx', '.py', '.rs', '.go'].includes(ext)) {
        continue;
      }

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const signatures = this.extractSignatures(content, ext);
        if (signatures.length > 0) {
          skeleton += `File: ${relPath}\n${signatures.join('\n')}\n\n`;
        }
      } catch {
        // Skip unreadable files
      }
    }

    return skeleton.trim();
  }

  private static extractSignatures(content: string, ext: string): string[] {
    const lines = content.split('\n');
    const signatures: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Elixir
      if (ext === '.ex' || ext === '.exs') {
        if (trimmed.startsWith('defmodule ') || trimmed.startsWith('def ') || trimmed.startsWith('defp ')) {
          signatures.push('  ' + trimmed.split(' do')[0]);
        }
      }
      // JS / TS
      else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        if (
          trimmed.startsWith('export class ') ||
          trimmed.startsWith('export function ') ||
          trimmed.startsWith('export interface ') ||
          trimmed.startsWith('export type ') ||
          trimmed.startsWith('export const ')
        ) {
          signatures.push('  ' + trimmed.replace(/\{.*$/, '').trim());
        }
      }
      // Python
      else if (ext === '.py') {
        if (trimmed.startsWith('def ') || trimmed.startsWith('class ')) {
          signatures.push('  ' + trimmed.replace(/:$/, ''));
        }
      }
      // Go
      else if (ext === '.go') {
        if (trimmed.startsWith('func ') || trimmed.startsWith('type ')) {
          signatures.push('  ' + trimmed.replace(/\{.*$/, '').trim());
        }
      }
      // Rust
      else if (ext === '.rs') {
        if (trimmed.startsWith('pub fn ') || trimmed.startsWith('fn ') || trimmed.startsWith('pub struct ')) {
          signatures.push('  ' + trimmed.replace(/\{.*$/, '').trim());
        }
      }

      if (signatures.length >= 10) {
        signatures.push('  ...');
        break;
      }
    }

    return signatures;
  }
}
