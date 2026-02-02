import { useState, useEffect } from 'react';

type Theme = 'dark' | 'theme-midnight' | 'theme-vintage';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('app_theme') as Theme) || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove all theme classes
    root.classList.remove('theme-midnight', 'theme-vintage');
    // 'dark' is the default base class for shadcn, so we keep it.
    // The other themes are additive/overrides on top of dark mode structure.
    
    if (theme !== 'dark') {
      root.classList.add(theme);
    }
    
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  return { theme, setTheme };
}
