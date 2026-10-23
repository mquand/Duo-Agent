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

export interface SlashCommandItem {
  name: string;
  desc: string;
}

export const SLASH_COMMANDS_LIST: SlashCommandItem[] = [
  { name: '/help', desc: 'Tra cứu lệnh & trợ giúp' },
  { name: '/model', desc: 'Đổi AI model (Claude 5.5, GPT-6...)' },
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

export interface SuggestPromptConfig {
  message: string;
  isEn?: boolean;
  history?: string[];
}

export const promptWithSuggestions = createPrompt<string, SuggestPromptConfig>((config, done) => {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'done'>('idle');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Compute matching commands if typing a slash command
  let matches: SlashCommandItem[] = [];
  if (value.startsWith('/')) {
    const query = value.toLowerCase().trim();
    matches = SLASH_COMMANDS_LIST.filter((cmd) => {
      if (query === '/') return true;
      return cmd.name.toLowerCase().startsWith(query);
    });
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
        finalAnswer = matches[selectedIndex].name;
      }
      setStatus('done');
      done(finalAnswer);
    } else if (isTabKey(key)) {
      // Tab to autocomplete selected suggestion
      if (matches.length > 0) {
        const target = matches[selectedIndex % matches.length].name + ' ';
        setValue(target);
        rl.clearLine(0);
        rl.write(target);
        setSelectedIndex(0);
      }
    } else if (isDownKey(key)) {
      if (value.startsWith('/') && matches.length > 0) {
        setSelectedIndex((selectedIndex + 1) % matches.length);
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

  if (status === 'done' || !value.startsWith('/') || matches.length === 0) {
    return [promptLine, ''];
  }

  // Render suggestion popup (up to 5 items)
  const renderedList = matches.slice(0, 5).map((m, idx) => {
    const isSelected = idx === (selectedIndex % matches.length);
    const pointer = isSelected ? chalk.cyan('› ') : '  ';
    const cmdFormatted = isSelected ? chalk.bold.cyan(m.name) : chalk.white(m.name);
    const descFormatted = chalk.gray(m.desc);
    return `${pointer}${cmdFormatted.padEnd(16)} ${descFormatted}`;
  }).join('\n');

  return [promptLine, '\n' + renderedList];
});
