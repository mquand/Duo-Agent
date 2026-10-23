# 🚀 Duo-Agent

<p align="center">
  <b>Universal Multi-Agent Orchestrator for Developers</b><br>
  <i>Fast • Lean • Accurate • Token-Optimized</i>
</p>

<p align="center">
  <a href="#-english">English</a> •
  <a href="#-tiếng-việt">Tiếng Việt</a>
</p>

---

<a name="-english"></a>
## 🌐 English

Duo-Agent is a developer-centric CLI tool designed to orchestrate AI models using a structured **Sandwich Architecture (Architect – Builder – Auditor)**:

1. **Architect (Reasoning Model)**: Analyzes project requirements, extracts a compact symbol index (CodeGraph Skeleton), and organizes subtasks into an execution graph (DAG) following the **Ponytail Philosophy** ("Write the minimum code necessary").
2. **Builder (Execution Model)**: Implements tasks concurrently, performs function-level context slicing for large files, applies surgical `SEARCH/REPLACE` blocks, and verifies changes locally via automated test commands.
3. **Chief Auditor (Auditing Model)**: Inspects the consolidated `git diff`, validates boundary conditions and security concerns, and applies automated final polish before delivery.

---

### ✨ Key Capabilities

- 🥪 **Sandwich Multi-Agent Pattern**: Distinct roles for planning, concurrent code execution, and final quality auditing.
- 🧘 **Ponytail Philosophy**: Minimizes token waste by preventing over-engineering, reusing existing helper methods, and keeping diffs strictly scoped.
- 🗺️ **CodeGraph Skeleton**: Compresses repository symbols into a compact outline (<1,000 tokens), preserving context budget.
- ✂️ **Context Slicing**: Slices function-level scopes for large files (>500 lines) to eliminate context bloat and hallucinated edits.
- ⚡ **DAG Parallel Execution**: Concurrently processes independent subtasks with automatic file mutex locks.
- 🛡️ **Safety Guardrails**:
  - Automatically creates a **Git Checkpoint** prior to changes; revert anytime using `duo --undo` or `/undo`.
  - Blocks dangerous shell operations (`rm -rf`, destructive database commands).
  - Supports **Interactive**, **Plan-Only** (`-p`), and **Auto-Accept** (`-y`) execution modes.
- 💬 **Interactive REPL & Slash Commands**: Interactive shell (`duo`) supporting direct text input without quotes, plus slash commands (`/model`, `/plan`, `/diff`, `/undo`, `/config`).
- 🌐 **Zero-Config Detection**: Automatically detects project types (Elixir, TypeScript/JavaScript, Python, Rust, Go) and test runners. Reads existing workspace rule files (`CLAUDE.md`, `.cursorrules`, `.duorules`).
- 🔌 **Provider Agnostic**: Works with any standard AI provider (Anthropic, Google Gemini, OpenAI-compatible APIs, or local offline models). All model selections are 100% user-configurable.

---

### 📦 Installation

#### Run directly via NPX
```bash
npx duo-agent "Add JWT token validation middleware"
```

#### Install Globally
```bash
git clone https://github.com/mquand/D-U-O---A-G-E-N-T-.git duo-agent
cd duo-agent
npm install
npm run build
npm link
```

---

### 🔑 Configuration

Configure your providers and chosen models via environment variables or in `~/.duo/config.json` (or `.duorc` in your project root):

```json
{
  "roles": {
    "architect": {
      "provider": "anthropic",
      "model": "your-reasoning-model"
    },
    "builder": {
      "provider": "google",
      "model": "your-fast-coder-model"
    },
    "auditor": {
      "provider": "anthropic",
      "model": "your-auditor-model"
    }
  }
}
```

---

### 💡 Usage

#### 1. Interactive REPL Mode (Recommended)
Run `duo` without arguments to launch the interactive shell:
```bash
duo
```
```text
duo [Default] > Refactor database connection pool retry logic
duo [Default] > /sessions               # List all saved sessions
duo [Default] > /new auth-flow          # Create and switch to a fresh, clean session
duo [auth-flow] > /switch db-pool       # Switch back to an existing session
duo [db-pool] > /session                # View current session progress & completed tasks
duo [db-pool] > /model                  # Interactively switch models for any role
duo [db-pool] > /plan Add caching layer # Generate plan without editing files
duo [db-pool] > /diff                   # View current git diff
duo [db-pool] > /undo                   # Roll back changes to the initial checkpoint
duo [db-pool] > /exit                   # Quit session
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

#### 3. One-Shot Command
```bash
duo "Add unit tests for authentication service"
```

#### 4. Plan-Only Mode
```bash
duo -p "Design event-driven notification queue"
```

#### 5. Auto-Accept Mode (Autonomous)
```bash
duo -y "Generate API documentation comments"
```

#### 6. Rollback (Undo)
```bash
duo --undo
```

---

<br>

<a name="-tiếng-việt"></a>
## 🇻🇳 Tiếng Việt

Duo-Agent là công cụ CLI mã nguồn mở điều phối các mô hình AI theo kiến trúc **Bánh mì kẹp (Sandwich Architecture)**:

1. **Architect (Mô hình suy luận)**: Phân tích bài toán, trích xuất bản đồ cấu trúc mã nguồn (CodeGraph Skeleton), lập kế hoạch thực thi dạng đồ thị DAG theo **Triết lý Ponytail** ("Chỉ viết lượng mã nguồn tối thiểu cần thiết").
2. **Builder (Mô hình thực thi code)**: Chạy song song các bước độc lập, cắt lát hàm (Context Slicing) cho file lớn, áp dụng khối `SEARCH/REPLACE` chính xác và tự động chạy test kiểm tra.
3. **Chief Auditor (Mô hình thẩm định)**: Tổng duyệt toàn bộ `git diff`, kiểm tra điều kiện biên và tự động hoàn thiện (Last-Mile Polish) trước khi bàn giao.

---

### ✨ Tính năng nổi bật

- 🥪 **Kiến trúc Sandwich**: Tách biệt rõ ràng 3 giai đoạn: Lên kế hoạch, Thực thi song song và Tổng duyệt chất lượng.
- 🧘 **Triết lý Ponytail**: Tiết kiệm token tối đa bằng cách ngăn chặn over-engineering, tái sử dụng các hàm có sẵn.
- 🗺️ **CodeGraph Skeleton**: Nén thông tin module/hàm thành bản đồ siêu nhẹ (<1.000 token).
- ✂️ **Context Slicing**: Tự động cắt lát hàm xung quanh vùng cần sửa đối với file lớn (>500 dòng), tránh loãng ngữ cảnh.
- ⚡ **Thực thi song song (DAG)**: Chạy đồng thời các tác vụ độc lập với cơ chế khóa file tự động (File Mutex Lock).
- 🛡️ **An toàn tuyệt đối**:
  - Tự động tạo **Git Checkpoint** trước khi sửa file; khôi phục nhanh bằng `duo --undo` hoặc lệnh `/undo`.
  - Chặn đứng các câu lệnh shell nguy hiểm.
  - Hỗ trợ chế độ **Tương tác**, **Chỉ lên Plan** (`-p`), và **Tự động** (`-y`).
- 💬 **Chế độ Tương tác REPL & Lệnh Slash**: Gõ yêu cầu trực tiếp không cần ngoặc kép, hỗ trợ các lệnh `/sessions`, `/switch`, `/new`, `/session`, `/model`, `/plan`, `/diff`, `/undo`, `/config`.
- 🗂️ **Quản lý đa phiên (Multi-Session Management)**: Lưu trữ các phiên làm việc độc lập trong `.duo/sessions/`. Chuyển đổi qua lại giữa các tính năng (`/switch`, `/new`) hoặc khôi phục phiên cũ (`duo -r`) mà không bị nhiễm độc ngữ cảnh.
- 🌐 **Tự động nhận diện (Zero-Config)**: Tự phát hiện các loại dự án (Elixir, TypeScript/JavaScript, Python, Rust, Go) và nạp file quy ước có sẵn (`CLAUDE.md`, `.cursorrules`, `.duorules`).
- 🔌 **Linh hoạt cấu hình (Pluggable)**: Hỗ trợ mọi nhà cung cấp AI. Người dùng toàn quyền tùy biến tên model trong file cấu hình.

---

### 📦 Cài đặt & Sử dụng

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

## 📄 License
MIT © 2026
