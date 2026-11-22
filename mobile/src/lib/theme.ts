// 颜色与网站一致（web/src/styles/global.css 的变量），跟随系统的深浅色。
import { useColorScheme } from 'react-native';

const light = {
  paper: '#f6f4ec',
  surface: '#fffefa',
  ink: '#1d2621',
  ink2: '#4a554e',
  ink3: '#7b857e',
  rule: '#dcd8c9',
  rule2: '#ebe8dc',
  accent: '#2c6a4c',
  accentInk: '#1f5239',
  accentWash: '#e6efe7',
  ok: '#2a7a4b',
  okWash: '#e4f1e7',
  warn: '#8f5a00',
  warnWash: '#f7ecd3',
  toxic: '#b43a0e',
  toxicWash: '#fbe6da',
  deadly: '#fff7f3',
  deadlyBg: '#6e1414',
  deadlyMark: '#6e1414',
  muted: '#56615a',
  mutedWash: '#eceae0',
  onAccent: '#fffefa',
};
export type Palette = typeof light;

const dark: Palette = {
  paper: '#141815',
  surface: '#1b201c',
  ink: '#e8ebe4',
  ink2: '#b5bdb5',
  ink3: '#848e86',
  rule: '#303731',
  rule2: '#262c27',
  accent: '#7fc49d',
  accentInk: '#9ad5b3',
  accentWash: '#1f2d25',
  ok: '#7fc49d',
  okWash: '#1c2c22',
  warn: '#e0b057',
  warnWash: '#2f2716',
  toxic: '#f08a5d',
  toxicWash: '#36201a',
  deadly: '#ffe9e2',
  deadlyBg: '#7a1c1c',
  deadlyMark: '#ff8d7a',
  muted: '#a3ada5',
  mutedWash: '#242a25',
  onAccent: '#10231a',
};

export const useColors = (): Palette => (useColorScheme() === 'dark' ? dark : light);

/** 安全等级的色调（LEVELS[*].tone）→ 字色、底色 */
export function toneColors(c: Palette, tone: string): { fg: string; wash: string } {
  switch (tone) {
    case 'ok':
      return { fg: c.ok, wash: c.okWash };
    case 'warn':
      return { fg: c.warn, wash: c.warnWash };
    case 'toxic':
      return { fg: c.toxic, wash: c.toxicWash };
    case 'deadly':
      return { fg: c.deadlyMark, wash: c.toxicWash };
    default:
      return { fg: c.muted, wash: c.mutedWash };
  }
}

export const font = {
  /** 学名：衬线斜体 */
  sci: { fontFamily: 'serif', fontStyle: 'italic' as const },
};
