# Duo-Agent

<p align="center">
  <b>Universal Multi-Agent Orchestrator for Developers</b><br>
  <i>Fast • Lean • Accurate • Token-Optimized</i>
</p>

<p align="center">
  <a href="#english">English</a> •
  <a href="#vietnamese">Vietnamese</a>
</p>

```ascii
 ██████╗ ██╗   ██╗ ██████╗       █████╗  ██████╗ ███████╗███╗   ██╗████████╗
 ██╔══██╗██║   ██║██╔═══██╗     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
 ██║  ██║██║   ██║██║   ██║     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
 ██║  ██║██║   ██║██║   ██║     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
 ██████╔╝╚██████╔╝╚██████╔╝     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
 ╚═════╝  ╚═════╝  ╚═════╝      ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
 ──────────────────────────────────────────────────────────────────────────
  Multi-Agent Orchestrator | Architect -> Builder -> Auditor
```

---

<a name="english"></a>
## English

Duo-Agent is a developer-centric CLI tool designed to orchestrate AI models using a structured **Sandwich Architecture (Architect -> Builder -> Auditor)**:

1. **Architect (Reasoning Model)**: Analyzes project requirements, extracts a compact symbol index (CodeGraph Skeleton), and organizes subtasks into an execution graph (DAG) following the **Ponytail Philosophy** ("Write the minimum code necessary").
2. **Builder (Execution Model)**: Implements tasks concurrently, performs function-level context slicing for large files, applies surgical `SEARCH/REPLACE` blocks, and verifies changes locally via automated test commands.
3. **Auditor (Quality Review)**: Inspects the consolidated `git diff`, validates boundary conditions and security concerns, and applies automated final polish before delivery.

---

### Key Capabilities

- **Sandwich Multi-Agent Pattern**: Distinct roles for planning, concurrent code execution, and final quality auditing.
- **Ponytail Philosophy**: Minimizes token waste by preventing over-engineering, reusing existing helper methods, and keeping diffs strictly scoped.
- **CodeGraph Skeleton**: Compresses repository symbols into a compact outline (<1,000 tokens), preserving context budget.
- **Context Slicing**: Slices function-level scopes for large files (>400 lines) to eliminate context bloat and hallucinated edits.
- **DAG Parallel Execution**: Concurrently processes independent subtasks with automatic file mutex locks.
- **Safety Guardrails**:
  - Automatically creates a **Git Checkpoint** prior to changes; revert anytime using `duo --undo` or `/undo`.
  - Blocks dangerous shell operations (`rm -rf`, destructive database commands).
  - Supports **Interactive**, **Plan-Only** (`-p`), and **Auto-Accept** (`-y`) execution modes.
- **Interactive Shell & Slash Commands**: Interactive REPL (`duo`) supporting direct text input, plus slash commands (`/model`, `/plan`, `/diff`, `/undo`, `/config`, `/sessions`, `/theme`, `/lang`).
- **Zero-Config Detection**: Automatically detects project types (Elixir, TypeScript/JavaScript, Python, Rust, Go) and test runners. Reads existing workspace rule files (`CLAUDE.md`, `.cursorrules`, `.duorules`).
- **Provider Agnostic**: Works with any standard AI provider (Anthropic Claude, OpenAI / o3-mini / GPT-4o, Google Gemini, DeepSeek, Mistral Codestral, Groq, Ollama, OpenRouter). All model selections are 100% user-configurable.

---

### Installation

#### Run directly via NPX
```bash
npx duo-agent "Add JWT token validation middleware"
```

#### Install Globally
```bash
git clone https://github.com/mquand/Duo-Agent.git duo-agent
cd duo-agent
npm install
npm run build
npm link
```

---

### Configuration

Configure your providers and chosen models via environment variables or in `~/.duo/config.json` (or `.duorc` in your project root):

```json
{
  "roles": {
    "architect": {
      "provider": "anthropic",
      "model": "claude-3-7-sonnet-20250219"
    },
    "builder": {
      "provider": "google",
      "model": "gemini-2.0-flash"
    },
    "auditor": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-latest"
    }
  },
  "theme": "cyber",
  "language": "en"
}
```

---

### Usage

#### 1. Interactive Shell (Recommended)
Run `duo` without arguments to launch the interactive shell:
```bash
duo
```
```text
Duo Shell (v1.0.0)
Type your prompt directly, or /help for commands.

duo > Refactor database connection pool in @lib/db/pool.ts
duo > /cost                   # View cumulative token usage and estimated USD cost
duo > /commit                 # Auto-generate conventional commit and commit to Git
duo > /add lib/schema.ts      # Pin specific file into agent context
duo > /paste                  # Multi-line input mode for stack traces or specs
duo > /compact                # Summarize completed tasks to save context
duo > /sessions               # List all saved sessions
duo > /new auth-flow          # Create and switch to a fresh, clean session
duo (auth-flow) > /switch main # Switch back to an existing session
duo > /session                # View current session progress & completed tasks
duo > /model                  # Interactively switch models (Claude 5.5, GPT-6...)
duo > /theme                  # Switch terminal color theme (Cyber, Dracula, Nord...)
duo > /lang                   # Switch interface language (English / Vietnamese)
duo > /help                   # View full command reference
duo > /plan Add caching layer # Generate plan without editing files
duo > /diff                   # View current git diff
duo > /undo                   # Roll back changes to the initial checkpoint
duo > ! git status            # Run local shell commands directly via !
duo > /exit                   # Quit shell
```

#### 2. Session Management
```bash
# Resume your last active session
duo -r

# Resume a specific session by ID or name
duo -r auth-flow

# List all saved sessions
duo --sessions
```

#### 3. Dual-Pane Split Terminal & Live Monitor
You can split your terminal into two panes (`Cmd + \` or `Ctrl + \` in VS Code / IDE):
- **Pane 1 (Left)**: Interactive shell (`duo`)
- **Pane 2 (Right)**: Live activity and code diff watcher (`duo monitor`)

```bash
# In your second terminal window or split pane:
duo monitor
```
`duo monitor` streams agent planning, function-level slicing, colorized code diffs, and local test logs in real time.

#### 4. One-Shot Command
```bash
duo "Add unit tests for authentication service"
```

#### 5. Plan-Only Mode
```bash
duo -p "Design event-driven notification queue"
```

#### 6. Auto-Accept Mode (Autonomous)
```bash
duo -y "Generate API documentation comments"
```

#### 7. Rollback (Undo)
```bash
duo --undo
```

---

<a name="vietnamese"></a>
## Vietnamese

Duo-Agent là công cụ CLI mã nguồn mở điều phối các mô hình AI theo kiến trúc **Sandwich (Architect -> Builder -> Auditor)**:

1. **Architect (Mô hình suy luận)**: Phân tích bài toán, trích xuất bản đồ cấu trúc mã nguồn (CodeGraph Skeleton), lập kế hoạch thực thi dạng đồ thị DAG theo **Triết lý Ponytail** ("Chỉ viết lượng mã nguồn tối thiểu cần thiết").
2. **Builder (Mô hình thực thi code)**: Chạy song song các bước độc lập, cắt lát hàm (Context Slicing) cho file lớn, áp dụng khối `SEARCH/REPLACE` chính xác và tự động chạy test kiểm tra.
3. **Auditor (Mô hình thẩm định)**: Tổng duyệt toàn bộ `git diff`, kiểm tra điều kiện biên và tự động hoàn thiện (Last-Mile Polish) trước khi bàn giao.

---

### Tính năng nổi bật

- **Kiến trúc Sandwich**: Tách biệt rõ ràng 3 giai đoạn: Lên kế hoạch, Thực thi song song và Tổng duyệt chất lượng.
- **Triết lý Ponytail**: Tiết kiệm token tối đa bằng cách ngăn chặn over-engineering, tái sử dụng các hàm có sẵn.
- **CodeGraph Skeleton**: Nén thông tin module/hàm thành bản đồ siêu nhẹ (<1.000 token).
- **Context Slicing**: Tự động cắt lát hàm xung quanh vùng cần sửa đối với file lớn (>400 dòng), tránh loãng ngữ cảnh.
- **Thực thi song song (DAG)**: Chạy đồng thời các tác vụ độc lập với cơ chế khóa file tự động (File Mutex Lock).
- **An toàn tuyệt đối**:
  - Tự động tạo **Git Checkpoint** trước khi sửa file; khôi phục nhanh bằng `duo --undo` hoặc lệnh `/undo`.
  - Chặn đứng các câu lệnh shell nguy hiểm.
  - Hỗ trợ chế độ **Tương tác**, **Chỉ lên Plan** (`-p`), và **Tự động** (`-y`).
- **Chế độ Tương tác REPL & Lệnh Slash**: Gõ yêu cầu trực tiếp không cần ngoặc kép, hỗ trợ các lệnh `/sessions`, `/switch`, `/new`, `/session`, `/model`, `/plan`, `/diff`, `/undo`, `/config`, `/theme`, `/lang`.
- **Quản lý đa phiên (Multi-Session)**: Lưu trữ các phiên làm việc độc lập trong `.duo/sessions/`. Chuyển đổi qua lại giữa các tính năng (`/switch`, `/new`) hoặc khôi phục phiên cũ (`duo -r`) mà không bị nhiễm độc ngữ cảnh.
- **Chia đôi Terminal & Live Monitor**: Mở 2 cửa sổ song song (`Cmd + \`). Một bên tương tác (`duo`), một bên theo dõi trực tiếp thay đổi code và tiến độ theo thời gian thực (`duo monitor`).
- **Tự động nhận diện (Zero-Config)**: Tự phát hiện các loại dự án (Elixir, TypeScript/JavaScript, Python, Rust, Go) và nạp file quy ước có sẵn (`CLAUDE.md`, `.cursorrules`, `.duorules`).
- **Linh hoạt cấu hình (Pluggable)**: Hỗ trợ mọi nhà cung cấp AI hàng đầu (Anthropic, Google Gemini, OpenAI, DeepSeek, Mistral, Groq, Ollama). Người dùng toàn quyền tùy biến tên model.

---

### Cài đặt & Sử dụng

```bash
# Cài đặt toàn cục
cd duo-agent
npm install
npm run build
npm link

# Chạy chế độ tương tác
duo
```

---

## License
MIT © 2026
