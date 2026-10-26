export interface ColorTheme {
  id: string;
  name: string;
  gradient: [string, string, string, string, string, string];
  accent: string;
}

export const THEMES: Record<string, ColorTheme> = {
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk (Cyan ➔ Neon Green)',
    gradient: ['#00F2FE', '#4FACFE', '#00C9FF', '#92FE9D', '#38EF7D', '#11998E'],
    accent: '#00F2FE',
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula (Purple ➔ Pink ➔ Cyan)',
    gradient: ['#BD93F9', '#FF79C6', '#8BE9FD', '#50FA7B', '#FFB86C', '#FF5555'],
    accent: '#BD93F9',
  },
  nord: {
    id: 'nord',
    name: 'Nord (Arctic Frost & Ice Blue)',
    gradient: ['#88C0D0', '#81A1C1', '#5E81AC', '#8FBCBB', '#A3BE8C', '#EBCB8B'],
    accent: '#88C0D0',
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai (Magenta ➔ Yellow ➔ Green)',
    gradient: ['#F92672', '#FD971F', '#E6DB74', '#A6E22E', '#66D9EF', '#AE81FF'],
    accent: '#F92672',
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix (Terminal Green Hacker)',
    gradient: ['#76FF03', '#64DD17', '#00E676', '#00C853', '#1B5E20', '#2E7D32'],
    accent: '#00E676',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset (Warm Orange ➔ Coral Pink)',
    gradient: ['#FF512F', '#F09819', '#FF6A00', '#EE0979', '#FF6A88', '#FF99AC'],
    accent: '#FF6A00',
  },
};

export class ThemeManager {
  static getTheme(themeId?: string): ColorTheme {
    return THEMES[themeId || 'cyber'] || THEMES.cyber;
  }
}
