import { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext.native';
import { useAuth } from '../contexts/AuthContext.native';
import { useProgress } from '../hooks/useProgress.native';
import { getThemeColors } from '../lib/themeColors';
import { db } from '../firebase/firebaseConfig';

type JourneySheetProps = {
  isOpen?: boolean;
  onClose: () => void;
  onQuestUpdate?: () => void;
  onNavigate?: (screen: 'capture' | 'timeline' | 'patterns' | 'settings', options?: { scrollToReflections?: boolean }) => void;
};

type Profile = {
  reflection_style?: 'guided' | 'free';
  streak_count?: number;
};

export function JourneySheet({ isOpen = true, onClose, onNavigate }: JourneySheetProps) {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const { progress } = useProgress();
  const colors = getThemeColors(resolvedTheme === 'light');

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalReflections, setTotalReflections] = useState(0);
  const [badgesCount, setBadgesCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setProfile(null);
        setTotalEvents(0);
        setTotalReflections(0);
        setBadgesCount(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const uid = user.uid;
        const profileSnap = await getDoc(doc(db, 'users', uid));
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as Profile);
        } else {
          setProfile(null);
        }

        const [eventsSnap, reflectionsSnap, badgesSnap] = await Promise.all([
          getDocs(collection(db, 'users', uid, 'events')),
          getDocs(collection(db, 'users', uid, 'reflections')),
          getDocs(collection(db, 'users', uid, 'badges').withConverter(undefined)),
        ]);
        setTotalEvents(eventsSnap.size);
        setTotalReflections(reflectionsSnap.size);
        setBadgesCount(badgesSnap.size);
      } catch (err) {
        console.error('JourneySheet load failed', err);
        setProfile(null);
        setTotalEvents(0);
        setTotalReflections(0);
        setBadgesCount(0);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Feather name="zap" size={20} color="#60a5fa" />
              <Text style={[styles.title, { color: colors.text }]}>{'Your Journey'}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.text} />
                <Text style={[styles.helper, { color: colors.textSecondary, marginLeft: 8 }]}>
                  { 'Loading...' }
                </Text>
              </View>
            ) : (
              <>
                {progress && (
                  <View style={[styles.card, { borderColor: colors.border }]}>
                    <View style={styles.rowBetween}>
                      <View style={styles.row}>
                        <View style={styles.iconCircle}>
                          <Feather name="trending-up" size={16} color="#60a5fa" />
                        </View>
                        <View>
                          <Text style={[styles.cardTitle, { color: colors.text }]}>
                            {`Level ${progress.level}`}
                          </Text>
                          <Text style={[styles.helper, { color: colors.textSecondary }]}>
                            {progress.totalXP} XP • {progress.weeklyXP ?? 0} this week
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.helper, { color: colors.textSecondary }]}>
                        {progress.levelName || ''}
                      </Text>
                    </View>
                    {!progress.isMaxLevel && progress.progressToNext !== undefined && (
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressInner,
                            { width: `${Math.min(100, progress.progressToNext * 100)}%` },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                )}

                <View style={[styles.card, { borderColor: colors.border }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Today</Text>
                    <TouchableOpacity onPress={() => onNavigate?.('capture')}>
                      <Text style={{ color: '#60a5fa', fontWeight: '600' }}>Log a moment</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.rowBetween}>
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: colors.text }]}>{totalEvents}</Text>
                      <Text style={[styles.helper, { color: colors.textSecondary }]}>Moments</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: colors.text }]}>{totalReflections}</Text>
                      <Text style={[styles.helper, { color: colors.textSecondary }]}>Reflections</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: colors.text }]}>{badgesCount}</Text>
                      <Text style={[styles.helper, { color: colors.textSecondary }]}>Badges</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.card, { borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Reflection Mode</Text>
                  <Text style={[styles.helper, { color: colors.textSecondary }]}>
                    {profile?.reflection_style === 'free'
                      ? 'Free mode — capture moments without quests'
                      : 'Guided mode — daily quests and prompts'}
                  </Text>
                  <View style={styles.row}>
                    <TouchableOpacity
                      onPress={() => onNavigate?.('patterns', { scrollToReflections: true })}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>View reflections</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onNavigate?.('capture')}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>Log moment</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingTop: 40,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    paddingVertical: 12,
    gap: 12,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  helper: { fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(96,165,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 6,
  },
  progressInner: {
    height: '100%',
    backgroundColor: '#60a5fa',
  },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '700' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1f2937',
  },
  chipText: { color: '#e5e7eb', fontWeight: '600', fontSize: 13 },
});
