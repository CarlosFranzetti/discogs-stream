import { useState, useEffect } from 'react';

type Theme = 'dark' | 'theme-midnight' | 'theme-neon-orange' | 'theme-neon-yellow';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('app_theme') as string;
    // Migrate old theme-vintage to theme-neon-orange
    if (stored === 'theme-vintage') return 'theme-neon-orange';
    return (stored as Theme) || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-midnight', 'theme-neon-orange', 'theme-neon-yellow', 'theme-vintage');

    if (theme !== 'dark') {
      root.classList.add(theme);
    }

    localStorage.setItem('app_theme', theme);
  }, [theme]);

  return { theme, setTheme };
}
