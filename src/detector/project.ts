import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { DetectedProject } from '../types/index.js';

const REPO_RULE_FILES = [
  '.duorules',
  '.duo/rules.md',
  '.duo/rules',
  'CLAUDE.md',
  '.cursorrules',
  'AGENTS.md',
  '.windsurfrules',
  '.github/copilot-instructions.md',
];

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

    // 2. Detect Local Repository Rules File
    let localRuleFile: string | undefined;
    let localRuleContent: string | undefined;

    for (const ruleFileName of REPO_RULE_FILES) {
      const rulePath = path.join(cwd, ruleFileName);
      if (await fs.pathExists(rulePath)) {
        try {
          localRuleContent = await fs.readFile(rulePath, 'utf-8');
          localRuleFile = ruleFileName;
          break;
        } catch {}
      }
    }

    // 3. Detect Global User Rules (~/.duo/rules.md)
    let globalRuleContent: string | undefined;
    const globalRulePath = path.join(os.homedir(), '.duo', 'rules.md');
    if (await fs.pathExists(globalRulePath)) {
      try {
        globalRuleContent = await fs.readFile(globalRulePath, 'utf-8');
      } catch {}
    }

    // 4. Cascade & Merge Rules (Global + Repo)
    if (localRuleContent && globalRuleContent) {
      result.ruleFile = `${localRuleFile} (+ ~/.duo/rules.md)`;
      result.ruleContent = `# Global Rules (~/.duo/rules.md):\n${globalRuleContent}\n\n# Repository Rules (${localRuleFile}):\n${localRuleContent}`;
    } else if (localRuleContent) {
      result.ruleFile = localRuleFile;
      result.ruleContent = localRuleContent;
    } else if (globalRuleContent) {
      result.ruleFile = '~/.duo/rules.md (global)';
      result.ruleContent = globalRuleContent;
    }

    return result;
  }

  static generateRuleTemplate(type: DetectedProject['type']): string {
    const header = `# Repository Guidelines & Rules (.duorules)\n# Duo-Agent (Architect, Builder, Auditor) strictly complies with these guidelines.\n\n`;

    if (type === 'elixir') {
      return (
        header +
        `## 1. Elixir & Phoenix Conventions
- Follow idiomatic Elixir conventions (snake_case for functions and variables, PascalCase for modules).
- Prefer pattern matching in function signatures and 'case' statements over nested 'if' or 'cond'.
- Guard against nil values explicitly using pattern matching.
- Keep Phoenix contexts modular; do not query Repo directly from controllers or LiveViews.
- Ensure Ecto migrations include proper reversibility (change/0 or up/down).

## 2. Testing & Verification
- Run tests via 'mix test'.
- Add unit/integration tests for every new business logic path.
- Keep tests isolated; avoid global shared mock states.

## 3. Ponytail Philosophy
- Do not create unnecessary context wrappers or modules if modifying existing functions achieves the goal.
- The best code is the code you never wrote.
`
      );
    }

    if (type === 'node') {
      return (
        header +
        `## 1. TypeScript & Code Style
- Strict typing: Avoid 'any'. Define explicit interfaces and types for payloads and returns.
- Keep functions small, pure, and single-purpose where possible.
- Avoid introducing heavy third-party npm dependencies for simple utility functions.
- Do not leave console.log or temporary debug code in commits.

## 2. Testing & Verification
- Run tests via 'npm test' or the workspace test runner.
- Every bug fix should be accompanied by a regression test.

## 3. Ponytail Philosophy
- Do not create wrapper abstractions or unnecessary helper files if a direct 3-line change in an existing function suffices.
`
      );
    }

    if (type === 'python') {
      return (
        header +
        `## 1. Python Conventions
- Follow PEP 8 style guidelines.
- Use explicit type hints for function signatures: def process_order(order_id: str) -> bool:
- Prefer list/dict comprehensions over raw loops where readability is maintained.
- Catch specific exceptions rather than bare 'except:'.

## 2. Testing & Verification
- Run tests via 'pytest'.
- Use fixtures and parameterization for clean test cases.

## 3. Ponytail Philosophy
- Minimal surgical modifications. No over-engineered OOP hierarchies.
`
      );
    }

    return (
      header +
      `## 1. Architecture & Code Quality
- Follow existing codebase naming conventions and file directory structures.
- Keep modifications minimal, surgical, and strictly scoped to the objective.
- Always handle edge cases: null/nil checks, empty collections, boundary conditions.

## 2. Verification
- Run the workspace test suite to verify changes.
- Never commit code that breaks existing tests.

## 3. Ponytail Philosophy
- "The best code is the code you never wrote."
`
    );
  }

  static async initRules(cwd: string = process.cwd(), force: boolean = false): Promise<{ created: boolean; path: string; file: string }> {
    const targetFile = '.duorules';
    const targetPath = path.join(cwd, targetFile);

    if (!force && (await fs.pathExists(targetPath))) {
      return { created: false, path: targetPath, file: targetFile };
    }

    const detected = await this.detect(cwd);
    const content = this.generateRuleTemplate(detected.type);
    await fs.writeFile(targetPath, content, 'utf-8');
    return { created: true, path: targetPath, file: targetFile };
  }
}
