import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext.native';
import { useTheme } from '../contexts/ThemeContext.native';
import { getThemeColors } from '../lib/themeColors';
import {
  BADGE_DEFINITIONS,
  BadgeDefinition,
  BadgeCategory,
  getUserBadges,
  setActiveBadge,
  getCategoryName,
  UserBadge,
} from '../lib/badges.native';

type BadgeGalleryProps = {
  isOpen: boolean;
  onClose: () => void;
  currentActiveBadgeId: string | null;
  onBadgeSelected?: () => void;
};

export function BadgeGallery({ isOpen, onClose, currentActiveBadgeId, onBadgeSelected }: BadgeGalleryProps) {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const colors = getThemeColors(resolvedTheme === 'light');
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(currentActiveBadgeId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && isOpen) {
      loadBadges();
    }
  }, [user, isOpen]);

  useEffect(() => {
    setActiveBadgeId(currentActiveBadgeId);
  }, [currentActiveBadgeId]);

  const loadBadges = async () => {
    if (!user) return;
    setLoading(true);
    const badges = await getUserBadges(user.id);
    setEarnedBadges(badges);
    setLoading(false);
  };

  const handleSelectBadge = async (badgeId: string | null) => {
    if (!user) return;

    const success = await setActiveBadge(user.id, badgeId);
    if (success) {
      setActiveBadgeId(badgeId);
      if (onBadgeSelected) {
        onBadgeSelected();
      }
    }
  };

  const isEarned = (badgeId: string) => {
    return earnedBadges.some(b => b.badge_id === badgeId);
  };

  const categories: BadgeCategory[] = ['getting_started', 'consistency', 'depth', 'emotion', 'insight'];

  const getBadgesByCategory = (category: BadgeCategory) => {
    return BADGE_DEFINITIONS.filter(b => b.category === category);
  };

  const earnedCount = earnedBadges.length;
  const totalCount = BADGE_DEFINITIONS.length;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeAreaContainer}>
          <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Badge Gallery</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {earnedCount} of {totalCount} earned
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <Feather name="x" size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : (
              <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {activeBadgeId && (
                  <View style={[styles.activeBadgeCard, { backgroundColor: colors.warningBackground, borderColor: colors.warning }]}>
                    <TouchableOpacity
                      onPress={() => handleSelectBadge(null)}
                      style={styles.activeBadgeButton}
                    >
                      <View style={styles.activeBadgeContent}>
                        <View>
                          <Text style={[styles.activeBadgeLabel, { color: colors.warning }]}>ACTIVE BADGE</Text>
                          <Text style={[styles.activeBadgeText, { color: colors.text }]}>Tap to remove active badge</Text>
                        </View>
                        <View style={[styles.activeBadgeIcon, { backgroundColor: colors.warning }]}>
                          <Feather name="x" size={16} color={colors.buttonPrimaryText} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {categories.map((category) => {
                  const badges = getBadgesByCategory(category);
                  return (
                    <View key={category} style={styles.categorySection}>
                      <Text style={[styles.categoryTitle, { color: colors.textSecondary }]}>
                        {getCategoryName(category).toUpperCase()}
                      </Text>
                      <View style={styles.badgesGrid}>
                        {badges.map((badge) => {
                          const earned = isEarned(badge.id);
                          const isActive = activeBadgeId === badge.id;

                          return (
                            <TouchableOpacity
                              key={badge.id}
                              onPress={() => earned && handleSelectBadge(isActive ? null : badge.id)}
                              disabled={!earned}
                              style={[
                                styles.badgeCard,
                                { backgroundColor: earned ? colors.card : colors.inputBackground, borderColor: colors.border },
                                isActive && { backgroundColor: colors.warningBackground, borderColor: colors.warning },
                                !earned && styles.badgeCardLocked,
                              ]}
                              activeOpacity={0.7}
                            >
                              <View style={styles.badgeHeader}>
                                <Text style={styles.badgeIcon}>{earned ? badge.icon : '🔒'}</Text>
                                {isActive && (
                                  <View style={[styles.activeIndicator, { backgroundColor: colors.warning }]}>
                                    <Feather name="check" size={12} color={colors.buttonPrimaryText} />
                                  </View>
                                )}
                                {!earned && (
                                  <View style={styles.lockIndicator}>
                                    <Feather name="lock" size={12} color={colors.textTertiary} />
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.badgeName, { color: earned ? colors.text : colors.textTertiary }]}>
                                {badge.name}
                              </Text>
                              <Text style={[styles.badgeDescription, { color: earned ? colors.textSecondary : colors.textTertiary }]}>
                                {badge.description}
                              </Text>
                              {earned && badge.xpReward > 0 && (
                                <Text style={[styles.badgeXP, { color: colors.accent }]}>
                                  +{badge.xpReward} XP
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    paddingTop: 40,
  },
  safeAreaContainer: {
    width: '100%',
    maxHeight: '90%',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    maxHeight: 650,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  activeBadgeCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  activeBadgeButton: {
    width: '100%',
  },
  activeBadgeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeBadgeText: {
    fontSize: 14,
  },
  activeBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '47%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeCardLocked: {
    opacity: 0.6,
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeIcon: {
    fontSize: 32,
  },
  activeIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  badgeXP: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
  },
});

