import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGameState } from '../hooks/useGameState';
import { useTheme } from '../contexts/ThemeContext.native';
import { getThemeColors } from '../lib/themeColors';
import { useLanguage } from '../contexts/LanguageContext.native';

type JourneyMiniStatusProps = {
  onNavigate?: (screen: 'capture' | 'timeline' | 'patterns' | 'settings', options?: { scrollToReflections?: boolean }) => void;
  onQuestUpdate?: () => void;
  questUpdateTrigger?: number;
  onOpenJourney?: () => void;
  onOpenBadges?: () => void;
  levelOverride?: number;
  levelNameOverride?: string;
  xpOverride?: number;
};

export function JourneyMiniStatus({ onNavigate, onOpenJourney, onOpenBadges, levelOverride, levelNameOverride, xpOverride }: JourneyMiniStatusProps) {
  const { stats } = useGameState();
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();
  const colors = getThemeColors(resolvedTheme === 'light');

  const lvl = levelOverride ?? stats?.level ?? 1;
  const xp = xpOverride ?? stats?.allTimeXP ?? 0;
  const translateLevelName = (name?: string | null) => {
    const key = name ? `levels.${name.toLowerCase()}` : 'levels.explorer';
    const localized = t(key);
    return localized === key ? (name || t('levels.explorer')) : localized;
  };
  const name = translateLevelName(levelNameOverride ?? stats?.levelName);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.8}
      onPress={() => {
        if (onOpenJourney) {
          onOpenJourney();
        } else {
          onNavigate?.('patterns');
        }
      }}
    >
      <View style={styles.row}>
        <Feather name="trending-up" size={18} color={colors.textSecondary} />
        <Text style={[styles.title, { color: colors.text }]}>{t('journey.title') || 'Your Journey'}</Text>
        <View style={[styles.levelPill, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
          <Text style={[styles.levelPillText, { color: colors.text }]}>{`Lvl ${lvl} · ${name}`}</Text>
        </View>
        {onOpenBadges && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onOpenBadges();
            }}
            style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
            activeOpacity={0.8}
          >
            <Feather name="award" size={14} color={colors.textSecondary} />
            <Text style={[styles.pillText, { color: colors.text }]}>{t('journey.badges') || 'Badges earned'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{`${xp} XP`}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  levelPillText: { fontSize: 12, fontWeight: '700' },
  pillText: { fontSize: 12, fontWeight: '600' },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
  },
});
