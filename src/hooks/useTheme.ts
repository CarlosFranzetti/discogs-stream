import { useState, useEffect } from 'react';

type Theme = 'dark' | 'theme-midnight' | 'theme-neon-orange' | 'theme-cyberpunk' | 'theme-neon-yellow';

// Every theme class the app may apply to <html>. Cleared before reapplying so
// swapping themes never leaves a stuck class (the previous bug — selecting any
// theme not in this list left it active even after switching away).
const ALL_THEME_CLASSES = [
  'theme-midnight',
  'theme-neon-orange',
  'theme-neon-yellow',
  'theme-cyberpunk',
  'theme-vintage',
];

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('app_theme') as string;
    if (stored === 'theme-vintage') return 'theme-neon-orange';
    if (stored === 'theme-neon-yellow') return 'theme-cyberpunk';
    if (
      stored === 'dark' ||
      stored === 'theme-midnight' ||
      stored === 'theme-neon-orange' ||
      stored === 'theme-cyberpunk'
    ) {
      return stored as Theme;
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    for (const cls of ALL_THEME_CLASSES) {
      root.classList.remove(cls);
    }
    if (theme !== 'dark') {
      root.classList.add(theme);
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  return { theme, setTheme };
}
