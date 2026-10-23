# Duo-Agent

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Sandwich%20(Architect%20%E2%9E%94%20Builder%20%E2%9E%94%20Auditor)-00DC82?style=flat-square" alt="Architecture" />
  <img src="https://img.shields.io/badge/Node-%3E%3D%2018.0.0-blue?style=flat-square" alt="Node Version" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Frontier%20Models-Claude%205.5%20%7C%20GPT--6%20%7C%20Gemini%202.0-orange?style=flat-square" alt="Frontier Models" />
</p>

<p align="center">
  <b>Universal Multi-Agent Orchestrator for Developers</b><br />
  <i>Fast, token-efficient, and surgically precise AI coding CLI orchestrating heterogeneous models.</i>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#command-reference">Commands</a> •
  <a href="#vietnamese">Tài liệu tiếng Việt</a>
</p>

---

<a name="overview"></a>
## Overview

**Duo-Agent** is a developer-centric command-line interface (CLI) engineered to coordinate specialized AI models under a **Sandwich Architecture (Architect ➔ Builder ➔ Auditor)**. 

Unlike traditional monolith agent tools that route every step through a single expensive frontier model, Duo-Agent decouples planning, code modification, and quality assurance:
- **Architect (High-Reasoning)**: Crafts execution DAGs and extracts lightweight project outlines via the **Ponytail Philosophy** ("Write the minimum code necessary").
- **Builder (High-Throughput)**: Concurrently modifies targeted scopes using function-level AST context slicing, surgical `SEARCH/REPLACE` blocks, and local test runners.
- **Auditor (Quality Review)**: Synthesizes final git diffs, executes security boundary checks, and applies automated last-mile fixes prior to delivery.

Designed with the typography and keyboard ergonomics of modern terminal tooling (such as Claude Code and Cursor), Duo-Agent provides real-time keystroke autocomplete, instant file context injection, live cost tracking, and 1-second atomic git rollback.

---

<a name="architecture"></a>
## Architecture

```text
                             USER PROMPT / TASK
                                     │
                                     ▼
      ┌─────────────────────────────────────────────────────────────┐
      │                   ARCHITECT AGENT                           │
      │   Model: Claude Opus 5.5 / Sonnet 5.5 / GPT-6 Astra         │
      │   • CodeGraph Skeleton Extraction (<1,000 tokens)           │
      │   • Ponytail Minimalist Design Principle                    │
      │   • Directed Acyclic Graph (DAG) Task Planning              │
      └──────────────────────────────┬──────────────────────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
       ┌────────────────────────────┐ ┌────────────────────────────┐
       │      BUILDER WORKER 1      │ │      BUILDER WORKER 2      │
       │   Model: Gemini 2.0 Flash  │ │   Model: DeepSeek-V3 / Ollama
       │   • AST Context Slicing    │ │   • AST Context Slicing    │
       │   • Surgical Search/Replace│ │   • Surgical Search/Replace│
       │   • Local Test Verification│ │   • Local Test Verification│
       └──────────────┬─────────────┘ └─────────────┬──────────────┘
                      └──────────────┬──────────────┘
                                     │ (File Mutex Concurrency)
                                     ▼
      ┌─────────────────────────────────────────────────────────────┐
      │                    AUDITOR AGENT                            │
      │   Model: Claude Sonnet 5.5 / GPT-6 Sol                      │
      │   • Consolidated Git Diff Audit                             │
      │   • Security & Edge-Case Boundary Verification              │
      │   • Autonomous Last-Mile Polish & Code Formatting           │
      └──────────────────────────────┬──────────────────────────────┘
                                     │
                                     ▼
                           VERIFIED ATOMIC COMMIT
```

---

<a name="key-features"></a>
## Key Features

### 1. Real-Time Keystroke Autocomplete (`/` & `@`)
- **Slash Commands (`/`)**: Type `/` to open an inline menu of all CLI commands with real-time fuzzy filtering, parameter hints, and `Tab` completion.
- **Project File Context (`@`)**: Type `@` anywhere in your prompt to open an instant project file picker (e.g. `@src/index.ts`). Navigate with `↑` / `↓` and press `Tab` or `Enter` to expand the full relative path into your prompt.
- **Smart Directory Filter**: Automatically ignores heavy directories (`node_modules`, `.git`, `dist`, `_build`, `.next`, lockfiles, and `.duoignore`), executing file scans in under 10ms.

### 2. Live Cost & Token Telemetry
- **Pinned Status Header**: Displays cumulative session costs and token usage in real time (`Duo Agent v1.0.0 · ~$0.021 (14.2k tokens)`).
- **Prompt Tag**: Dynamic indicator shows current session spend: `duo [~$0.021] > `.
- **Command `/cost`**: Detailed breakdown of tokens processed and estimated USD expenses across Architect, Builder, and Auditor phases.

### 3. Frontier & Pluggable Model Support
Out-of-the-box support for leading frontier and local inference engines:
- **Anthropic Claude**: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-3-7-sonnet`.
- **OpenAI**: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna`, `o3-mini`, `gpt-4o`.
- **Google Gemini**: `gemini-2.0-flash`, `gemini-2.0-pro-exp-02-05`.
- **OpenAI-Compatible & Local**: DeepSeek (`deepseek-coder`, `deepseek-chat`), Groq, Mistral Codestral, OpenRouter, and Local Ollama/vLLM.

### 4. Safety Guardrails & Git Checkpointing
- **Atomic Git Checkpointing**: Automatically captures a clean git snapshot before applying any changes.
- **Instant Rollback**: Run `duo --undo` or type `/undo` in the REPL to revert working tree modifications in under 1 second.
- **Dangerous Command Interception**: Intercepts destructive shell expressions (`rm -rf`, destructive database migrations, force pushes) and requests explicit confirmation.

### 5. Multi-Session Management
- Sessions are stored in `.duo/sessions/`. Switch between independent features (`/new`, `/switch`, `/sessions`) without cross-pollinating conversation context.
- Resume ongoing sessions effortlessly via `duo -r [sessionId]`.

### 6. Dual-Pane Live Monitor
Split your terminal (`Cmd + \` or `Ctrl + \`) to run the interactive shell on one side and `duo monitor` on the other. Streams agent thought processes, file slicing, test outputs, and colorized diffs in real time.

---

<a name="installation"></a>
## Installation

### Prerequisites
- Node.js `>= 18.0.0`
- Git `>= 2.25.0`

### Global Installation

```bash
# Clone the repository
git clone https://github.com/mquand/Duo-Agent.git duo-agent
cd duo-agent

# Install dependencies and build TypeScript
npm install
npm run build

# Link globally to system PATH
npm link
```

Verify installation:
```bash
duo --version
```

---

<a name="configuration"></a>
## Configuration

Duo-Agent checks configuration in the following order of precedence:
1. Active environment variables (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.)
2. Local project configuration: `.duorc` (in current working directory)
3. Global user configuration: `~/.duo/config.json`

### Recommended: Shell Environment Variables
Add your keys to `~/.zshrc` or `~/.bashrc`:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export GEMINI_API_KEY="AIzaSy..."
export OPENAI_API_KEY="sk-..."
```
When keys are detected in the environment, Duo-Agent automatically recognizes them on startup without requiring manual input.

### Configuration File Example (`~/.duo/config.json` or `.duorc`)
```json
{
  "roles": {
    "architect": {
      "provider": "anthropic",
      "model": "claude-sonnet-5-5"
    },
    "builder": {
      "provider": "google",
      "model": "gemini-2.0-flash"
    },
    "auditor": {
      "provider": "anthropic",
      "model": "claude-sonnet-5-5"
    }
  },
  "theme": "cyber",
  "language": "en",
  "telemetry": false
}
```

---

<a name="usage"></a>
## Usage

### 1. Interactive REPL (Recommended)
Launch the interactive shell by running `duo` without arguments:

```bash
duo
```

```text
Duo Agent v1.0.0 · ~$0.000 (0 tokens)
Architect: claude-sonnet-5-5 · Builder: gemini-2.0-flash · Auditor: claude-sonnet-5-5
/Users/developer/my-project

duo > Refactor authentication middleware in @src/middleware/auth.ts
duo > /cost
duo > /commit Implement JWT token validation
duo > ! npm test
```

### 2. CLI Execution Modes

```bash
# One-shot direct task execution
duo "Optimize SQL queries in user controller"

# Plan-only mode: Generates architectural DAG without touching files
duo -p "Design notification queue system"

# Auto-accept mode: Executes full pipeline autonomously without manual prompt confirmations
duo -y "Generate missing unit tests for payment module"

# Dry-run mode: Simulates execution without disk writes
duo -d "Refactor error handling"

# Rollback last execution
duo --undo

# Resume last active session
duo -r

# Launch split-terminal telemetry watcher
duo monitor
```

---

<a name="command-reference"></a>
## Command Reference

| Command | Argument | Description |
| :--- | :--- | :--- |
| `/help` | — | Display command reference and shortcut guide |
| `/model` | — | Interactively switch models (Claude 5.5, GPT-6, DeepSeek, Local Ollama) |
| `/cost` | — | Inspect cumulative token consumption and estimated USD costs |
| `/commit` | `[message]` | Generate conventional git commit from changes and commit to repository |
| `/add` | `<path>` | Pin specific file or folder directly into agent working memory |
| `/paste` | — | Enter multi-line input mode (paste logs, stack traces, or specifications) |
| `/compact` | — | Distill completed task history into memory to reclaim context budget |
| `/diff` | — | Inspect pending git modifications |
| `/undo` | — | Revert working tree to pre-task git checkpoint |
| `/theme` | — | Switch color theme (`default`, `cyber`, `dracula`, `nord`, `monokai`, `minimal`) |
| `/lang` | `[en\|vi]` | Switch interface language between English and Vietnamese |
| `/sessions` | — | List all saved workspace sessions |
| `/new` | `[title]` | Create and switch to a fresh, clean session |
| `/switch` | `<id\|name>` | Switch between active sessions |
| `/session` | — | View active session details and task progress |
| `/plan` | `<task>` | Plan task without modifying any project files |
| `/config` | — | Inspect active role and provider configurations |
| `/clear` | — | Clear terminal screen |
| `/exit` | — | Cleanly terminate session |
| `! <cmd>` | `<shell>` | Pass arbitrary command directly to host shell (e.g. `! git status`) |
| `@<file>` | `<query>` | Live fuzzy search and inject file contents into prompt context |

---

<a name="vietnamese"></a>
## Tài liệu tiếng Việt

**Duo-Agent** là công cụ CLI mã nguồn mở điều phối các mô hình AI theo **Kiến trúc Sandwich (Architect ➔ Builder ➔ Auditor)**, tối ưu chi phí token và độ chính xác khi lập trình.

### 1. Luồng hoạt động của 3 Agent
1. **Architect (Mô hình suy luận cao)**: Phân tích yêu cầu, bóc tách cấu trúc khung dự án (CodeGraph Skeleton) và lập đồ thị thực thi DAG theo **Triết lý Ponytail** ("Chỉ viết lượng code tối thiểu cần thiết").
2. **Builder (Mô hình thực thi tốc độ cao)**: Nhận các task độc lập, cắt lát ngữ cảnh theo hàm (AST Context Slicing), áp dụng khối `SEARCH/REPLACE` chính xác vào code và tự động chạy test kiểm thử.
3. **Auditor (Mô hình thẩm định chất lượng)**: Tổng duyệt toàn bộ `git diff`, kiểm tra bảo mật, điều kiện biên và tự động hoàn thiện (Last-Mile Polish) trước khi hoàn tất.

### 2. Tính năng nổi bật
* **Gợi ý lệnh (`/`) & File (`@`) thời gian thực**:
  * Gõ `/` để mở menu lệnh kèm mô tả chi tiết, dùng phím mũi tên `↑`/`↓` để chọn, nhấn `Tab` để tự động điền.
  * Gõ `@` ở bất kỳ đâu trong câu lệnh để tìm kiếm nhanh file trong dự án (fuzzy search), tự động bỏ qua `node_modules`, `.git`, file build. Nhấn `Tab` hoặc `Enter` để hoàn thành đường dẫn file.
* **Theo dõi chi phí & Token trực tiếp**:
  * Tiêu đề ghim hiển thị chi phí tích lũy theo thời gian thực: `Duo Agent v1.0.0 · ~$0.021 (14.2k tokens)`.
  * Nhập `/cost` để xem bảng thống kê chi tiết chi phí của từng Agent.
* **Hỗ trợ các Model Frontier mới nhất**:
  * Claude 5.5 (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`).
  * GPT-6 (`gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna`).
  * Google Gemini 2.0 Flash, DeepSeek-V3, Groq, Ollama / vLLM chạy offline trên máy.
* **An toàn tuyệt đối (Git Checkpoint)**:
  * Tự động tạo điểm khôi phục Git trước khi sửa bất kỳ file nào.
  * Hoàn tác ngay lập tức với `duo --undo` hoặc gõ `/undo` trong REPL.
* **Giao diện chuẩn Developer (Typography & Themes)**:
  * Loại bỏ hoàn toàn emoji rác, thiết kế tinh gọn theo phong cách Claude Code.
  * Hỗ trợ lưu lịch sử phím bấm (`↑`/`↓`), xem trước trực tiếp mã màu trong lệnh `/theme`.

### 3. Cài đặt nhanh
```bash
git clone https://github.com/mquand/Duo-Agent.git duo-agent
cd duo-agent
npm install
npm run build
npm link
```

### 4. Sử dụng cơ bản
```bash
# Khởi động REPL tương tác
duo

# Chạy một tác vụ đơn lẻ
duo "Thêm middleware xác thực JWT cho router user"

# Chỉ lập kế hoạch, không sửa file
duo -p "Thiết kế kiến trúc hệ thống cache Redis"

# Chế độ tự động hoàn toàn
duo -y "Viết unit test cho service thanh toán"

# Hoàn tác thay đổi về checkpoint an toàn
duo --undo

# Mở màn hình theo dõi diff & tiến độ song song (chia đôi terminal)
duo monitor
```

---

## License

Duo-Agent được phân phối theo giấy phép [MIT License](LICENSE). Copyright © 2026.
