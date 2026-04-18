export interface SystemLink {
  id: string;
  name: string;
  url: string;
  category: string;
  description?: string;
  icon?: string;
  bgImage?: string;
  userId: string;
  createdAt: number;
}

export type Category = {
  id: string;
  label: string;
  icon?: string;
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'all', label: 'Todos os Sistemas' },
  { id: 'work', label: 'Trabalho' },
  { id: 'personal', label: 'Pessoal' },
  { id: 'tools', label: 'Ferramentas' },
  { id: 'social', label: 'Social' },
];

export type ThemeId = 'bento-dark' | 'bento-light' | 'midnight' | 'emerald';

export interface Theme {
  id: ThemeId;
  name: string;
  isDark: boolean;
}

export const THEMES: Theme[] = [
  { id: 'bento-dark', name: 'Bento Dark', isDark: true },
  { id: 'bento-light', name: 'Bento Light', isDark: false },
  { id: 'midnight', name: 'Midnight', isDark: true },
  { id: 'emerald', name: 'Emerald', isDark: false },
];
