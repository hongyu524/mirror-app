import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext.native';
import { useTheme } from '../contexts/ThemeContext.native';
import { getThemeColors } from '../lib/themeColors';

type Screen = 'capture' | 'timeline' | 'patterns' | 'settings';

type LayoutProps = {
  children: ReactNode;
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
};

const iconMap: Record<Screen, string> = {
  capture: 'edit-3',
  timeline: 'calendar',
  patterns: 'bar-chart-2',
  settings: 'settings',
};

export function Layout({ children, currentScreen, onScreenChange }: LayoutProps) {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const colors = getThemeColors(resolvedTheme === 'light');

  const navItems: Array<{ id: Screen; label: string }> = [
    { id: 'capture', label: t('nav.capture') },
    { id: 'timeline', label: t('nav.timeline') },
    { id: 'patterns', label: t('nav.patterns') },
    { id: 'settings', label: t('nav.settings') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {children}
      </View>

      <SafeAreaView edges={['bottom']} style={[styles.navContainer, { backgroundColor: colors.navBackground, borderTopColor: colors.navBorder }]}>
        <View style={styles.nav}>
          {navItems.map((item) => {
            const isActive = currentScreen === item.id;
            const iconName = iconMap[item.id] as any;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onScreenChange(item.id)}
                style={styles.navItem}
                activeOpacity={0.7}
              >
                <Feather
                  name={iconName}
                  size={24}
                  color={isActive ? '#60a5fa' : colors.textTertiary}
                />
                <Text style={[styles.navLabel, { color: colors.textTertiary }, isActive && { color: '#60a5fa' }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  navContainer: {
    borderTopWidth: 1,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});

