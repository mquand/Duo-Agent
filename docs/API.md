# Duo-Agent Extended API & Architecture Reference

This document provides a comprehensive technical guide for developers, contributors, and integrators wishing to customize, extend, or programmatically interface with **Duo-Agent**.

---

## 1. Provider & Model Architecture

Duo-Agent uses a decoupled provider architecture under [`src/providers/`](../src/providers/) allowing any frontier model, open-source model, or local inference engine to be assigned to any of the three sandwich roles:
- **Architect**: High-reasoning model responsible for AST skeleton analysis and DAG task decomposition.
- **Builder**: High-throughput, low-latency model responsible for surgical `SEARCH/REPLACE` diffing.
- **Auditor**: Security and quality model responsible for test verification and last-mile polish.

### Supported Providers

| Provider | ID | Default Models | Supported Reasoning Budgets | Key Variable |
| :--- | :--- | :--- | :--- | :--- |
| **Anthropic** | `anthropic` | `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-3-7-sonnet` | `low` (2k), `medium` (8k), `high` (16k), `off` | `ANTHROPIC_API_KEY` |
| **Google** | `google` | `gemini-2.0-flash`, `gemini-2.0-pro-exp-02-05` | `low` (1k), `medium` (4k), `high` (8k), `off` | `GEMINI_API_KEY` |
| **OpenAI-Compatible** | `openai-compatible` | `gpt-6-astra`, `o3-mini`, `deepseek-chat`, `qwen2.5-coder:32b` | `low`, `medium`, `high`, `off` | Provider dependent |

### Connecting Custom / Local Endpoints

Any OpenAI-compatible server (Ollama, vLLM, LMStudio, OpenRouter, Groq, DeepSeek) can be plugged in by setting the `baseURL` property in `~/.duo/config.json`:

```json
{
  "roles": {
    "architect": {
      "provider": "openai-compatible",
      "model": "deepseek-r1:14b",
      "baseURL": "http://localhost:11434/v1"
    },
    "builder": {
      "provider": "openai-compatible",
      "model": "qwen2.5-coder:32b",
      "baseURL": "http://localhost:11434/v1"
    },
    "auditor": {
      "provider": "openai-compatible",
      "model": "deepseek-r1:14b",
      "baseURL": "http://localhost:11434/v1"
    }
  }
}
```

---

## 2. Configuration & Environment Hierarchy

Duo-Agent resolves configuration and credentials using a layered cascade:

```text
CLI Arguments (-e, -p, -y, --worktree)
       │
       ▼
Local Config (.duorc in project root)
       │
       ▼
Global Config (~/.duo/config.json)
       │
       ▼
Local .env (.env in project root)
       │
       ▼
Global .env (~/.duo/.env)
       │
       ▼
System Shell Environment ($ANTHROPIC_API_KEY, $GEMINI_API_KEY, etc.)
```

### Auto-Generated Template (`~/.duo/.env`)
Upon first launch, Duo-Agent automatically creates `~/.duo/.env` and `~/.duo/.env.example` pre-populated with documentation and links for obtaining each required key.

---

## 3. Programmatic Node.js / TypeScript SDK

You can import Duo-Agent modules directly into your own Node.js or TypeScript projects:

```typescript
import { ProviderFactory } from 'duo-agent/dist/providers/factory.js';
import { ArchitectAgent } from 'duo-agent/dist/agents/architect.js';
import { BuilderAgent } from 'duo-agent/dist/agents/builder.js';
import { AuditorAgent } from 'duo-agent/dist/agents/auditor.js';
import { DAGScheduler } from 'duo-agent/dist/core/scheduler.js';
import { Blackboard } from 'duo-agent/dist/core/blackboard.js';
import { CodeGraph } from 'duo-agent/dist/core/codegraph.js';

// 1. Initialize Providers
const archProvider = ProviderFactory.create({
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const builderProvider = ProviderFactory.create({
  provider: 'google',
  model: 'gemini-2.0-flash',
  apiKey: process.env.GEMINI_API_KEY,
});

// 2. Extract Codebase Skeleton
const skeleton = await CodeGraph.generateSkeleton(process.cwd());

// 3. Plan with Architect
const architect = new ArchitectAgent(archProvider);
const plan = await architect.plan("Add JWT authentication middleware", skeleton);

// 4. Concurrently Execute with Scheduler
const builder = new BuilderAgent(builderProvider);
const blackboard = new Blackboard(process.cwd());
await blackboard.init(plan.goal);

const scheduler = new DAGScheduler(builder, blackboard);
const result = await scheduler.executePlan(plan, {
  onStepStart: (step) => console.log(`Starting [${step.id}]: ${step.title}`),
  onStepComplete: (step, res) => console.log(`Completed [${step.id}]`),
  onStepError: (step, err) => console.error(`Error in [${step.id}]: ${err}`),
});
```

---

## 4. CodeGraph Performance Caching

To guarantee sub-millisecond responsiveness during multi-turn interactive shell sessions, [`CodeGraph`](../src/core/codegraph.ts) implements an **In-Memory Cache with TTL**:
- **Cache TTL**: 60,000ms (1 minute).
- **Subsequent Queries**: Repeated skeleton scans in the same session return in **< 1ms**.
- **Autonomous Cache Invalidation**: The cache is automatically purged when:
  - Any Builder step modifies files on disk.
  - A Git rollback (`duo --undo` or `/undo`) is executed.
  - Manual invalidation via `CodeGraph.invalidateCache(cwd)`.

---

## 5. Troubleshooting & Error Diagnostic Reference

| Error Output | Root Cause | Solution |
| :--- | :--- | :--- |
| `Cannot connect to local Ollama server at http://localhost:11434` | The Ollama background process is not running. | Run `ollama serve` or open the Ollama desktop application. |
| `Model '...' not found on server` | The requested model is not downloaded locally. | Run `ollama pull <model_name>` (e.g. `ollama pull deepseek-r1:14b`). |
| `Authentication error (401): Invalid API key` | Expired, revoked, or incorrect cloud API key. | Run `/model` to update key, or edit `~/.duo/.env`. |
| `Rate limit or quota exceeded (429)` | Cloud provider billing credits exhausted. | Verify credit balance on provider dashboard or switch to local models. |
| `Merge conflict detected when integrating branch` | Two parallel worktree branches edited identical lines. | Handled automatically by IntegrationManager; run `/undo` if needed. |
