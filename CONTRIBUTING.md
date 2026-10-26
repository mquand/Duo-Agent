# Contributing to Duo-Agent

Thank you for your interest in contributing to **Duo-Agent**! 

Duo-Agent is built on the **Ponytail Philosophy**:
> *"The best code is the code you never wrote."*

Our mission is to prove that a specialized **Sandwich Architecture (Architect ➔ Builder ➔ Auditor)** produces higher-quality, regression-free code at ~5x lower token costs than monolithic agents.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for all contributors. Please be respectful, constructive, and open to feedback.

---

## Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **npm**: v9.0.0 or higher
- **Git**: Installed and accessible in your shell

### Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/mquand/Duo-Agent.git
   cd Duo-Agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the TypeScript source:**
   ```bash
   npm run build
   ```

4. **Run the test suite:**
   ```bash
   npm test
   ```

5. **Run the system diagnostic check:**
   ```bash
   node bin/duo.js doctor
   ```

---

## Codebase Architecture

```
duo-agent/
├── bin/
│   └── duo.js                 # Global executable entrypoint
├── src/
│   ├── index.ts               # CLI & Interactive REPL Shell engine
│   ├── agents/
│   │   ├── architect.ts       # Reasoning Agent (Plan & DAG generation)
│   │   ├── builder.ts         # Fast Worker Agent (SEARCH/REPLACE diffing & self-healing)
│   │   └── auditor.ts         # Chief Auditor (Ground truth test review & polish)
│   ├── core/
│   │   ├── scheduler.ts       # DAG concurrent scheduler & normalized file mutex
│   │   ├── worktree.ts        # Git worktree manager for isolated parallel branches
│   │   ├── integration.ts     # Merge queue & conflict resolution manager
│   │   ├── git-guard.ts       # Checkpoints, uncommitted changes stash & safe rollback
│   │   ├── codegraph.ts       # CodeGraph scanner & AST skeleton extractor
│   │   ├── blackboard.ts      # Shared memory across DAG workers
│   │   ├── slicer.ts          # Large file window slicer
│   │   ├── benchmark.ts       # Empirical benchmark runner
│   │   ├── session.ts         # Multi-session persistence manager
│   │   └── history.ts         # Prompt history & session cleanup
│   ├── detector/
│   │   └── project.ts         # Tech stack & repo rules (.duorules, CLAUDE.md) detector
│   ├── providers/             # Anthropic, Google Gemini, OpenAI-compatible factory
│   └── ui/                    # Terminal theme gradients, autocomplete, prompts, i18n
└── tests/                     # Fast native Node.js test runner suite (*.test.mjs)
```

---

## Contribution Guidelines

### 1. The Ponytail Rule (Strict)
- **Do not over-engineer:** Avoid creating wrapper classes, nested abstraction layers, or extra utility modules if editing 3–5 lines in existing functions achieves the objective.
- **Reuse first:** Always inspect existing helpers in `src/core/` before adding new dependencies.
- **Zero bloat:** Keep external npm dependencies minimal.

### 2. Model Updates
- **Centralized Model Management:** All model definitions are in `src/config/models.ts`. When providers release new models, update ONLY this file.
- **Deprecation Handling:** Mark deprecated models in `DEPRECATED_MODELS` with clear migration paths.
- **Test Updates:** Update test files to use current model names when adding new models.
- **Documentation Sync:** Update README.md and .env.example to reflect model changes.
- **Library Updates:** When updating Google Gemini models, check if `@google/generative-ai` needs an upgrade for API compatibility.

### 3. Prompt Language Separation
- **Internal AI prompts MUST remain 100% technical English:** All system prompts, DAG JSON schemas, and context markers in `src/agents/` and `src/core/` are strictly English for optimal tokenization efficiency and instruction adherence.
- **User-facing UI MUST remain bilingual:** Any CLI log, spinner message, or help text must support both English and Vietnamese via `isEn` toggles or `i18n.ts`.

### 4. Branching & Commits
- Use descriptive branch names:
  - `feat/add-provider-x`
  - `fix/worktree-symlink-cleanup`
  - `docs/update-benchmark-data`
  - `chore/update-models-2026`
- Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat: ...`
  - `fix: ...`
  - `refactor: ...`
  - `test: ...`
  - `docs: ...`
  - `chore: ...`

### 5. Testing
- Every bug fix or new feature must be accompanied by unit or integration tests in `tests/*.test.mjs`.
- Tests run using native Node.js test runner (`node --test tests/*.test.mjs`) and must pass in < 500ms.

---

## Submitting a Pull Request

1. Push your branch to your fork.
2. Open a Pull Request against the `main` branch of `mquand/Duo-Agent`.
3. Fill out the PR template completely.
4. Ensure CI / tests pass.
5. Maintainers will review your PR and provide constructive feedback.
