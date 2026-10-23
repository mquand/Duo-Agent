import chalk from 'chalk';

export type Language = 'en' | 'vi';

export const i18n = {
  currentLang: 'vi' as Language,

  setLanguage(lang: Language): void {
    this.currentLang = lang;
  },

  get(key: keyof typeof messages.en): string {
    const lang = this.currentLang;
    return messages[lang]?.[key] || messages.en[key] || key;
  },

  printHelp(): void {
    const isEn = this.currentLang === 'en';

    console.log(chalk.bold.yellow(`\n${isEn ? '📖 DUO-AGENT COMMAND REFERENCE & HELP' : '📖 BẢNG TRA CỨU LỆNH & TRỢ GIÚP DUO-AGENT'}`));
    console.log(chalk.gray('─'.repeat(70)));

    console.log(chalk.bold.cyan(isEn ? '⚡ INTERACTIVE REPL SLASH COMMANDS:' : '⚡ CÁC LỆNH SLASH TRONG CHẾ ĐỘ REPL:'));
    const slashCommands = [
      { cmd: '/help', desc: isEn ? 'Display this comprehensive help guide' : 'Hiển thị bảng hướng dẫn chi tiết này' },
      { cmd: '/lang, /language', desc: isEn ? 'Switch language (English / Tiếng Việt)' : 'Đổi ngôn ngữ giao diện (English / Tiếng Việt)' },
      { cmd: '/model, /change_model', desc: isEn ? 'Interactively switch models for Architect, Builder, or Auditor' : 'Đổi model/provider cho từng vai trò' },
      { cmd: '/sessions', desc: isEn ? 'List all saved work sessions' : 'Xem danh sách toàn bộ các phiên làm việc' },
      { cmd: '/switch <id|name>', desc: isEn ? 'Switch to another session' : 'Chuyển sang phiên làm việc khác' },
      { cmd: '/new <name>', desc: isEn ? 'Create a clean, isolated session' : 'Tạo phiên làm việc mới với ngữ cảnh sạch' },
      { cmd: '/session', desc: isEn ? 'View active session details and completed tasks' : 'Xem chi tiết tiến độ của phiên hiện tại' },
      { cmd: '/plan <task>', desc: isEn ? 'Generate architectural plan without modifying code' : 'Chỉ lập kế hoạch, không sửa file' },
      { cmd: '/diff', desc: isEn ? 'Preview uncommitted git changes' : 'Xem các thay đổi git hiện tại' },
      { cmd: '/undo', desc: isEn ? 'Rollback working tree to initial checkpoint' : 'Khôi phục mã nguồn về checkpoint ban đầu' },
      { cmd: '/config', desc: isEn ? 'Display active configuration JSON' : 'Xem cấu hình hiện tại' },
      { cmd: '/clear', desc: isEn ? 'Clear the terminal screen' : 'Xóa sạch màn hình terminal' },
      { cmd: '/exit, /quit', desc: isEn ? 'Exit Duo session' : 'Thoát khỏi chương trình' },
    ];

    for (const c of slashCommands) {
      console.log(`  ${chalk.cyan(c.cmd.padEnd(24))} ${chalk.white(c.desc)}`);
    }

    console.log(chalk.bold.cyan(isEn ? '\n🛠️ CLI COMMAND-LINE SHORTCUTS:' : '\n🛠️ CÁC LỆNH CLI TỪ TERMINAL BÊN NGOÀI:'));
    const cliCommands = [
      { cmd: 'duo', desc: isEn ? 'Launch interactive REPL mode (recommended)' : 'Khởi chạy chế độ tương tác REPL (khuyên dùng)' },
      { cmd: 'duo "task prompt"', desc: isEn ? 'Execute a task directly in one shot' : 'Thực thi một task trực tiếp' },
      { cmd: 'duo -p "task prompt"', desc: isEn ? 'Plan-only mode (saves to .duo/plan.md)' : 'Chỉ lên kế hoạch, lưu vào .duo/plan.md' },
      { cmd: 'duo -y "task prompt"', desc: isEn ? 'Auto-accept mode (autonomous execution)' : 'Chế độ tự động hoàn toàn không cần hỏi' },
      { cmd: 'duo -r [sessionId]', desc: isEn ? 'Resume latest or specific session' : 'Tiếp tục phiên làm việc trước đó' },
      { cmd: 'duo --sessions', desc: isEn ? 'List all saved sessions' : 'Xem danh sách các phiên làm việc' },
      { cmd: 'duo --undo', desc: isEn ? 'Rollback changes to last checkpoint' : 'Khôi phục code về checkpoint an toàn' },
      { cmd: 'duo monitor', desc: isEn ? 'Open real-time live activity & diff watcher' : 'Mở màn hình soi live activity & diff thời gian thực' },
      { cmd: 'duo lang [en|vi]', desc: isEn ? 'Set default CLI language' : 'Thiết lập ngôn ngữ mặc định' },
    ];

    for (const c of cliCommands) {
      console.log(`  ${chalk.green(c.cmd.padEnd(24))} ${chalk.white(c.desc)}`);
    }

    console.log(chalk.gray('─'.repeat(70) + '\n'));
  },
};

const messages = {
  en: {
    banner_subtitle: 'Universal Multi-Agent Orchestrator (Open Source)',
    banner_roles: 'Architect ➔ Builder (Parallel Execution) ➔ Auditor',
    repl_welcome: 'INTERACTIVE REPL MODE',
    repl_current_session: 'Active Session',
    repl_hint_no_quotes: 'Type task directly without quotes! Example:',
    prompt_select_language: 'Select interface language:',
    lang_switched: 'Language switched to English.',
    sessions_title: 'SAVED WORK SESSIONS:',
    sessions_empty: 'No saved sessions found.',
    tasks_completed: 'tasks completed',
    updated_at: 'Updated',
    switch_success: 'Switched to session:',
    create_success: 'Created and activated new session:',
    session_details_title: 'SESSION DETAILS:',
    detect_project: 'Detected project:',
    checkpoint_created: 'Created safety Git Checkpoint',
    skeleton_scanning: 'Extracting CodeGraph Skeleton...',
    skeleton_done: 'CodeGraph Skeleton extracted successfully!',
    architect_planning: 'Architect is planning...',
    architect_done: 'Architect plan generated successfully!',
    builder_starting: 'STARTING DAG TASK EXECUTION WITH BUILDER...',
    auditor_reviewing: 'Chief Auditor is reviewing consolidated Git Diff...',
    auditor_pass: 'Chief Auditor: QUALITY APPROVED (PASS)',
    auditor_warn: 'Chief Auditor: Code quality advisory:',
    format_running: 'Formatting code with project formatter...',
    format_done: 'Code formatted according to project conventions!',
    all_completed: 'ALL TASKS COMPLETED SUCCESSFULLY WITH HIGHEST ACCURACY!',
    cost_report_title: 'OPERATIONAL EFFICIENCY REPORT',
    cost_est: 'Estimated cost:',
    cost_saved: 'Estimated token/cost savings:',
  },
  vi: {
    banner_subtitle: 'Universal Multi-Agent Orchestrator (Mã Nguồn Mở)',
    banner_roles: 'Architect ➔ Builder (Thực Thi Song Song) ➔ Auditor',
    repl_welcome: 'CHẾ ĐỘ TƯƠNG TÁC (INTERACTIVE REPL)',
    repl_current_session: 'Phiên hiện tại',
    repl_hint_no_quotes: 'Nhập yêu cầu trực tiếp mà không cần dấu ngoặc kép! Ví dụ:',
    prompt_select_language: 'Chọn ngôn ngữ giao diện (Select interface language):',
    lang_switched: 'Đã đổi ngôn ngữ sang Tiếng Việt.',
    sessions_title: 'DANH SÁCH CÁC PHIÊN LÀM VIỆC (SESSIONS):',
    sessions_empty: 'Chưa có phiên làm việc nào được lưu.',
    tasks_completed: 'tasks đã hoàn thành',
    updated_at: 'Cập nhật',
    switch_success: 'Đã chuyển sang phiên:',
    create_success: 'Đã tạo và kích hoạt phiên mới:',
    session_details_title: 'THÔNG TIN CHI TIẾT PHIÊN LÀM VIỆC:',
    detect_project: 'Phát hiện dự án:',
    checkpoint_created: 'Đã tạo Git Checkpoint an toàn',
    skeleton_scanning: 'Đang trích xuất CodeGraph Skeleton...',
    skeleton_done: 'Đã trích xuất xong CodeGraph Skeleton!',
    architect_planning: 'Architect đang lên kế hoạch...',
    architect_done: 'Architect đã lập kế hoạch xong!',
    builder_starting: 'BẮT ĐẦU THỰC THI ĐỒ THỊ NHIỆM VỤ VỚI BUILDER...',
    auditor_reviewing: 'Chief Auditor đang tổng duyệt toàn bộ Git Diff cuối cùng...',
    auditor_pass: 'Chief Auditor: PHÊ DUYỆT CHẤT LƯỢNG (PASS)',
    auditor_warn: 'Chief Auditor: Có lưu ý về chất lượng code:',
    format_running: 'Đang định dạng mã nguồn chuẩn quy chuẩn dự án...',
    format_done: 'Đã định dạng mã nguồn chuẩn quy chuẩn dự án!',
    all_completed: 'TẤT CẢ CÁC BƯỚC ĐÃ HOÀN TẤT THÀNH CÔNG VỚI ĐỘ CHÍNH XÁC CAO NHẤT!',
    cost_report_title: 'BÁO CÁO TỐI ƯU HÓA HOẠT ĐỘNG',
    cost_est: 'Chi phí ước tính:',
    cost_saved: 'Mức độ tiết kiệm token/chi phí:',
  },
};
