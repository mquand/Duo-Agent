import fs from 'fs-extra';
import path from 'path';
import { DetectedProject } from '../types/index.js';

const RULE_FILES = ['.duorules', 'CLAUDE.md', '.cursorrules', 'AGENTS.md', '.windsurfrules'];

export class ProjectDetector {
  static async detect(cwd: string = process.cwd()): Promise<DetectedProject> {
    const result: DetectedProject = {
      type: 'generic',
      language: 'unknown',
    };

    // 1. Detect Stack
    if (await fs.pathExists(path.join(cwd, 'mix.exs'))) {
      result.type = 'elixir';
      result.language = 'elixir';
      result.testCommand = 'mix test';
      result.formatCommand = 'mix format';
    } else if (await fs.pathExists(path.join(cwd, 'package.json'))) {
      result.type = 'node';
      result.language = (await fs.pathExists(path.join(cwd, 'tsconfig.json'))) ? 'typescript' : 'javascript';
      try {
        const pkg = await fs.readJson(path.join(cwd, 'package.json'));
        if (pkg.scripts && pkg.scripts.test) {
          result.testCommand = 'npm test';
        }
        if (pkg.scripts && pkg.scripts.format) {
          result.formatCommand = 'npm run format';
        } else {
          result.formatCommand = 'npx prettier --write';
        }
      } catch (e) {
        result.testCommand = 'npm test';
      }
    } else if (
      (await fs.pathExists(path.join(cwd, 'pyproject.toml'))) ||
      (await fs.pathExists(path.join(cwd, 'requirements.txt'))) ||
      (await fs.pathExists(path.join(cwd, 'setup.py')))
    ) {
      result.type = 'python';
      result.language = 'python';
      result.testCommand = 'pytest';
      result.formatCommand = 'ruff format . || black .';
    } else if (await fs.pathExists(path.join(cwd, 'Cargo.toml'))) {
      result.type = 'rust';
      result.language = 'rust';
      result.testCommand = 'cargo test';
      result.formatCommand = 'cargo fmt';
    } else if (await fs.pathExists(path.join(cwd, 'go.mod'))) {
      result.type = 'go';
      result.language = 'go';
      result.testCommand = 'go test ./...';
      result.formatCommand = 'gofmt -w .';
    }

    // 2. Detect Rules File
    for (const ruleFileName of RULE_FILES) {
      const rulePath = path.join(cwd, ruleFileName);
      if (await fs.pathExists(rulePath)) {
        try {
          result.ruleFile = ruleFileName;
          result.ruleContent = await fs.readFile(rulePath, 'utf-8');
          break;
        } catch (e) {
          // continue
        }
      }
    }

    return result;
  }
}
