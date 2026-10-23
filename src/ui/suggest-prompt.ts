import {
  createPrompt,
  useState,
  useKeypress,
  isEnterKey,
  isTabKey,
  isBackspaceKey,
  isUpKey,
  isDownKey,
} from '@inquirer/core';
import chalk from 'chalk';
import path from 'path';

export interface SlashCommandItem {
  name: string;
  desc: string;
}

export const SLASH_COMMANDS_LIST: SlashCommandItem[] = [
  { name: '/help', desc: 'Tra cứu lệnh & trợ giúp' },
  { name: '/model', desc: 'Đổi AI model (Claude 5.5, GPT-6...)' },
  { name: '/rules', desc: 'Xem hoặc cấu hình quy ước repo (.duorules)' },
  { name: '/effort', desc: 'Chỉnh mức độ suy luận / Thinking Effort (low, medium, high)' },
  { name: '/benchmark', desc: 'Chạy đối chuẩn hiệu năng & chi phí (Sandwich vs Monolith)' },
  { name: '/theme', desc: 'Đổi giao diện màu sắc Terminal' },
  { name: '/lang', desc: 'Đổi ngôn ngữ giao diện (en / vi)' },
  { name: '/cost', desc: 'Thống kê chi phí & tokens của phiên' },
  { name: '/commit', desc: 'Tự động tạo commit message & commit vào Git' },
  { name: '/add', desc: 'Ghim file hoặc thư mục vào ngữ cảnh' },
  { name: '/paste', desc: 'Chế độ dán nhiều dòng (Multi-line paste)' },
  { name: '/compact', desc: 'Nén và tóm tắt lịch sử task của phiên' },
  { name: '/sessions', desc: 'Xem danh sách các phiên làm việc' },
  { name: '/new', desc: 'Tạo phiên làm việc mới' },
  { name: '/switch', desc: 'Chuyển sang phiên làm việc khác' },
  { name: '/session', desc: 'Xem chi tiết phiên hiện tại' },
  { name: '/plan', desc: 'Chỉ lập kế hoạch, không sửa file' },
  { name: '/diff', desc: 'Xem các thay đổi git hiện tại' },
  { name: '/undo', desc: 'Khôi phục code về checkpoint an toàn' },
  { name: '/config', desc: 'Xem cấu hình hiện tại' },
  { name: '/clear', desc: 'Xóa sạch màn hình terminal' },
  { name: '/exit', desc: 'Thoát chương trình' },
];

export const SLASH_COMMANDS_DESC_EN: Record<string, string> = {
  '/help': 'Display command reference',
  '/model': 'Switch AI models (Claude 5.5, GPT-6...)',
  '/rules': 'View or configure repo guidelines (.duorules)',
  '/effort': 'Set reasoning effort / thinking budget',
  '/benchmark': 'Run empirical benchmark (Sandwich vs Monolith)',
  '/theme': 'Select terminal color theme',
  '/lang': 'Switch interface language (en / vi)',
  '/cost': 'Display session token usage & cost',
  '/commit': 'Auto-generate commit message & git commit',
  '/add': 'Pin file or folder into agent context',
  '/paste': 'Multi-line paste mode for logs/specs',
  '/compact': 'Summarize & compress session task history',
  '/sessions': 'List all saved sessions',
  '/new': 'Create a clean session',
  '/switch': 'Switch to another session',
  '/session': 'View active session details',
  '/plan': 'Generate architectural plan only',
  '/diff': 'Preview uncommitted git changes',
  '/undo': 'Rollback working tree to checkpoint',
  '/config': 'Display active configuration',
  '/clear': 'Clear terminal screen',
  '/exit': 'Exit Duo shell',
};

export interface SuggestPromptConfig {
  message: string;
  isEn?: boolean;
  history?: string[];
  files?: string[];
}

export const promptWithSuggestions = createPrompt<string, SuggestPromptConfig>((config, done) => {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'done'>('idle');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // 1. Compute matching commands if typing a slash command
  let matches: SlashCommandItem[] = [];
  if (value.startsWith('/')) {
    const query = value.toLowerCase().trim();
    matches = SLASH_COMMANDS_LIST.filter((cmd) => {
      if (query === '/') return true;
      return cmd.name.toLowerCase().startsWith(query);
    });
  }

  // 2. Compute matching files if typing @file
  const atMatch = value.match(/(?:^|\s)@([a-zA-Z0-9_\-\.\/]*)$/);
  let fileMatches: string[] = [];
  if (!value.startsWith('/') && atMatch && config.files && config.files.length > 0) {
    const query = atMatch[1].toLowerCase();
    fileMatches = config.files.filter((f) => {
      if (!query) return true;
      const lower = f.toLowerCase();
      const base = path.basename(lower);
      return base.startsWith(query) || lower.startsWith(query) || lower.includes(query);
    });

    if (query) {
      fileMatches.sort((a, b) => {
        const aBase = path.basename(a).toLowerCase();
        const bBase = path.basename(b).toLowerCase();
        const aStarts = aBase.startsWith(query) || a.toLowerCase().startsWith(query);
        const bStarts = bBase.startsWith(query) || b.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.length - b.length;
      });
    }
  }

  useKeypress((key, rl) => {
    if (status !== 'idle') return;

    if (isEnterKey(key)) {
      let finalAnswer = rl.line || value;
      if (
        value.startsWith('/') &&
        matches.length > 0 &&
        selectedIndex < matches.length &&
        !matches.some((m) => m.name === finalAnswer.trim())
      ) {
        finalAnswer = matches[selectedIndex % matches.length].name;
        setStatus('done');
        done(finalAnswer);
        return;
      }

      // If user is actively selecting an @file suggestion
      if (!value.startsWith('/') && atMatch && fileMatches.length > 0) {
        const selectedFile = fileMatches[selectedIndex % fileMatches.length];
        const currentToken = atMatch[1];
        if (currentToken !== selectedFile) {
          const atStart = atMatch.index! + (atMatch[0].startsWith(' ') ? 1 : 0);
          const prefix = value.substring(0, atStart);
          const target = `${prefix}@${selectedFile} `;
          setValue(target);
          rl.clearLine(0);
          rl.write(target);
          setSelectedIndex(0);
          return;
        }
      }

      setStatus('done');
      done(finalAnswer);
    } else if (isTabKey(key)) {
      // Tab to autocomplete selected suggestion
      if (value.startsWith('/') && matches.length > 0) {
        const target = matches[selectedIndex % matches.length].name + ' ';
        setValue(target);
        rl.clearLine(0);
        rl.write(target);
        setSelectedIndex(0);
      } else if (!value.startsWith('/') && atMatch && fileMatches.length > 0) {
        const selectedFile = fileMatches[selectedIndex % fileMatches.length];
        const atStart = atMatch.index! + (atMatch[0].startsWith(' ') ? 1 : 0);
        const prefix = value.substring(0, atStart);
        const target = `${prefix}@${selectedFile} `;
        setValue(target);
        rl.clearLine(0);
        rl.write(target);
        setSelectedIndex(0);
      }
    } else if (isDownKey(key)) {
      if (value.startsWith('/') && matches.length > 0) {
        setSelectedIndex((selectedIndex + 1) % matches.length);
      } else if (!value.startsWith('/') && atMatch && fileMatches.length > 0) {
        setSelectedIndex((selectedIndex + 1) % fileMatches.length);
      } else if (config.history && config.history.length > 0) {
        // Navigate forward in prompt history
        if (historyIndex !== -1) {
          const nextIndex = historyIndex + 1;
          if (nextIndex >= config.history.length) {
            setHistoryIndex(-1);
            setValue('');
            rl.clearLine(0);
          } else {
            setHistoryIndex(nextIndex);
            const entry = config.history[nextIndex];
            setValue(entry);
            rl.clearLine(0);
            rl.write(entry);
          }
        }
      }
    } else if (isUpKey(key)) {
      if (value.startsWith('/') && matches.length > 0) {
        setSelectedIndex((selectedIndex - 1 + matches.length) % matches.length);
      } else if (!value.startsWith('/') && atMatch && fileMatches.length > 0) {
        setSelectedIndex((selectedIndex - 1 + fileMatches.length) % fileMatches.length);
      } else if (config.history && config.history.length > 0) {
        // Navigate backward in prompt history
        const nextIndex =
          historyIndex === -1
            ? config.history.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        const entry = config.history[nextIndex];
        setValue(entry);
        rl.clearLine(0);
        rl.write(entry);
      }
    } else if (isBackspaceKey(key)) {
      const next = rl.line;
      setValue(next);
      setSelectedIndex(0);
      setHistoryIndex(-1);
    } else {
      setValue(rl.line);
      setSelectedIndex(0);
      setHistoryIndex(-1);
    }
  });

  const promptLine = `${config.message}${value}`;

  if (status === 'done') {
    return [promptLine, ''];
  }

  // Render slash commands suggestion popup (up to 5 items)
  if (value.startsWith('/') && matches.length > 0) {
    const renderedList = matches.slice(0, 5).map((m, idx) => {
      const isSelected = idx === (selectedIndex % matches.length);
      const pointer = isSelected ? chalk.cyan('› ') : '  ';
      const cmdFormatted = isSelected ? chalk.bold.cyan(m.name) : chalk.white(m.name);
      const descText = config.isEn ? (SLASH_COMMANDS_DESC_EN[m.name] || m.desc) : m.desc;
      const descFormatted = chalk.gray(descText);
      return `${pointer}${cmdFormatted.padEnd(16)} ${descFormatted}`;
    }).join('\n');
    return [promptLine, '\n' + renderedList];
  }

  // Render @file suggestion popup (up to 6 items)
  if (!value.startsWith('/') && atMatch && fileMatches.length > 0) {
    const renderedList = fileMatches.slice(0, 6).map((file, idx) => {
      const isSelected = idx === (selectedIndex % fileMatches.length);
      const pointer = isSelected ? chalk.cyan('› ') : '  ';
      const fileFormatted = isSelected ? chalk.bold.cyan(`@${file}`) : chalk.white(`@${file}`);
      return `${pointer}${fileFormatted}`;
    }).join('\n');
    return [promptLine, '\n' + renderedList];
  }

  return [promptLine, ''];
});
