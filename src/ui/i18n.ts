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

    console.log(chalk.white.bold(`\n${isEn ? 'COMMAND REFERENCE' : 'TRA CỨU LỆNH'}`));
    console.log(chalk.gray('─'.repeat(70)));

    console.log(chalk.cyan(isEn ? 'Interactive Shell Commands:' : 'Lệnh trong Shell tương tác:'));
    const slashCommands = [
      { cmd: '/help', desc: isEn ? 'Display command reference' : 'Hiển thị trợ giúp tra cứu lệnh' },
      { cmd: '/lang', desc: isEn ? 'Switch language (English / Vietnamese)' : 'Đổi ngôn ngữ giao diện (English / Vietnamese)' },
      { cmd: '/theme', desc: isEn ? 'Select terminal theme' : 'Chọn giao diện màu sắc Terminal' },
      { cmd: '/model', desc: isEn ? 'Switch models for Architect, Builder, Auditor' : 'Đổi model cho từng vai trò' },
      { cmd: '/sessions', desc: isEn ? 'List all saved work sessions' : 'Xem danh sách các phiên làm việc' },
      { cmd: '/switch <id|name>', desc: isEn ? 'Switch session' : 'Chuyển sang phiên làm việc khác' },
      { cmd: '/new <name>', desc: isEn ? 'Create a clean session' : 'Tạo phiên làm việc mới' },
      { cmd: '/session', desc: isEn ? 'View active session details' : 'Xem chi tiết phiên hiện tại' },
      { cmd: '/plan <task>', desc: isEn ? 'Generate plan only, do not modify files' : 'Chỉ lập kế hoạch, không sửa file' },
      { cmd: '/diff', desc: isEn ? 'Preview uncommitted git changes' : 'Xem các thay đổi git hiện tại' },
      { cmd: '/undo', desc: isEn ? 'Rollback working tree to checkpoint' : 'Khôi phục mã nguồn về checkpoint ban đầu' },
      { cmd: '/config', desc: isEn ? 'Display active configuration' : 'Xem cấu hình hiện tại' },
      { cmd: '/exit, /quit', desc: isEn ? 'Exit shell' : 'Thoát khỏi chương trình' },
    ];

    for (const c of slashCommands) {
      console.log(`  ${chalk.cyan(c.cmd.padEnd(24))} ${chalk.gray(c.desc)}`);
    }

    console.log(chalk.cyan(isEn ? '\nTerminal Commands:' : '\nLệnh từ Terminal:'));
    const cliCommands = [
      { cmd: 'duo', desc: isEn ? 'Interactive shell (recommended)' : 'Khởi chạy chế độ tương tác (khuyên dùng)' },
      { cmd: 'duo "task prompt"', desc: isEn ? 'Execute a task directly' : 'Thực thi một task trực tiếp' },
      { cmd: 'duo -p "task prompt"', desc: isEn ? 'Plan-only mode (.duo/plan.md)' : 'Chỉ lên kế hoạch, lưu vào .duo/plan.md' },
      { cmd: 'duo -y "task prompt"', desc: isEn ? 'Auto-accept mode' : 'Chế độ tự động hoàn toàn' },
      { cmd: 'duo -r [sessionId]', desc: isEn ? 'Resume session' : 'Tiếp tục phiên làm việc' },
      { cmd: 'duo --sessions', desc: isEn ? 'List all sessions' : 'Xem danh sách các phiên làm việc' },
      { cmd: 'duo --undo', desc: isEn ? 'Rollback changes' : 'Khôi phục code về checkpoint an toàn' },
      { cmd: 'duo monitor', desc: isEn ? 'Real-time activity & diff monitor' : 'Mở màn hình theo dõi hoạt động thời gian thực' },
      { cmd: 'duo theme [name]', desc: isEn ? 'Change terminal theme' : 'Đổi giao diện màu sắc Terminal' },
      { cmd: 'duo lang [en|vi]', desc: isEn ? 'Set CLI language' : 'Thiết lập ngôn ngữ mặc định' },
    ];

    for (const c of cliCommands) {
      console.log(`  ${chalk.green(c.cmd.padEnd(24))} ${chalk.gray(c.desc)}`);
    }

    console.log(chalk.gray('─'.repeat(70) + '\n'));
  },
};

const messages = {
  en: {
    banner_subtitle: 'Universal Multi-Agent Orchestrator',
    banner_roles: 'Architect -> Builder -> Auditor',
    repl_welcome: 'Duo Shell',
    repl_current_session: 'Session',
    repl_hint_no_quotes: 'Type prompt directly or use /help for commands.',
    prompt_select_language: 'Interface language:',
    lang_switched: 'Language set to English.',
    sessions_title: 'Saved Sessions:',
    sessions_empty: 'No saved sessions found.',
    tasks_completed: 'tasks completed',
    updated_at: 'Updated',
    switch_success: 'Switched to session:',
    create_success: 'Created session:',
    session_details_title: 'Session Details:',
    detect_project: 'Detected project:',
    checkpoint_created: 'Created safety checkpoint',
    skeleton_scanning: 'Extracting CodeGraph skeleton...',
    skeleton_done: 'CodeGraph skeleton ready',
    architect_planning: 'Architect planning...',
    architect_done: 'Architect plan ready',
    builder_starting: 'Builder executing tasks...',
    auditor_reviewing: 'Auditor reviewing git diff...',
    auditor_pass: 'Auditor: Quality approved (Pass)',
    auditor_warn: 'Auditor: Code quality note:',
    format_running: 'Formatting code...',
    format_done: 'Code formatted',
    all_completed: 'Execution completed successfully',
    cost_report_title: 'Summary',
    cost_est: 'Estimated cost:',
    cost_saved: 'Estimated savings:',
  },
  vi: {
    banner_subtitle: 'Universal Multi-Agent Orchestrator',
    banner_roles: 'Architect -> Builder -> Auditor',
    repl_welcome: 'Duo Shell',
    repl_current_session: 'Phiên hiện tại',
    repl_hint_no_quotes: 'Nhập yêu cầu trực tiếp hoặc gõ /help để xem hướng dẫn.',
    prompt_select_language: 'Ngôn ngữ giao diện:',
    lang_switched: 'Đã đổi ngôn ngữ sang Tiếng Việt.',
    sessions_title: 'Danh sách phiên làm việc:',
    sessions_empty: 'Chưa có phiên làm việc nào được lưu.',
    tasks_completed: 'tasks đã hoàn thành',
    updated_at: 'Cập nhật',
    switch_success: 'Đã chuyển sang phiên:',
    create_success: 'Đã tạo phiên mới:',
    session_details_title: 'Thông tin phiên:',
    detect_project: 'Phát hiện dự án:',
    checkpoint_created: 'Đã tạo checkpoint an toàn',
    skeleton_scanning: 'Đang quét CodeGraph skeleton...',
    skeleton_done: 'CodeGraph skeleton sẵn sàng',
    architect_planning: 'Architect đang lập kế hoạch...',
    architect_done: 'Architect hoàn tất kế hoạch',
    builder_starting: 'Builder đang thực thi nhiệm vụ...',
    auditor_reviewing: 'Auditor đang duyệt Git diff...',
    auditor_pass: 'Auditor: Phê duyệt (Pass)',
    auditor_warn: 'Auditor: Lưu ý chất lượng code:',
    format_running: 'Đang định dạng mã nguồn...',
    format_done: 'Đã định dạng mã nguồn',
    all_completed: 'Hoàn tất thành công',
    cost_report_title: 'Tổng kết',
    cost_est: 'Chi phí ước tính:',
    cost_saved: 'Mức tiết kiệm:',
  },
};
