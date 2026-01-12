import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Load saved theme preference
    AsyncStorage.getItem('mirror-theme').then((saved) => {
      if (saved) {
        setThemeState(saved as Theme);
      }
    });
  }, []);

  useEffect(() => {
    const systemColorScheme = Appearance.getColorScheme();
    const effectiveTheme = theme === 'system' ? (systemColorScheme || 'dark') : theme;
    setResolvedTheme(effectiveTheme);

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (theme === 'system') {
        setResolvedTheme(colorScheme || 'dark');
      }
    });

    return () => subscription.remove();
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    await AsyncStorage.setItem('mirror-theme', newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

