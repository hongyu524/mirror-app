import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext.native';
import { useLanguage } from '../contexts/LanguageContext.native';
import { useTheme } from '../contexts/ThemeContext.native';
import { getThemeColors } from '../lib/themeColors';
import { db } from '../firebase/firebaseConfig';

type JourneyCardProps = {
  onQuestUpdate?: () => void;
};

type Profile = {
  streak_count?: number;
  reflection_style?: 'guided' | 'free';
};

export function JourneyCard({ onQuestUpdate }: JourneyCardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const colors = getThemeColors(resolvedTheme === 'light');

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [questProgress, setQuestProgress] = useState({
    quest_logged_moment: false,
    quest_answered_reflection: false,
    quest_added_detail: false,
  });
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalReflections, setTotalReflections] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setProfile(null);
        setQuestProgress({ quest_logged_moment: false, quest_answered_reflection: false, quest_added_detail: false });
        setTotalEvents(0);
        setTotalReflections(0);
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

        const [eventsSnap, reflectionsSnap] = await Promise.all([
          getDocs(collection(db, 'users', uid, 'events')),
          getDocs(collection(db, 'users', uid, 'reflections')),
        ]);
        setTotalEvents(eventsSnap.size);
        setTotalReflections(reflectionsSnap.size);

        // Simple quest progress: mark logged_moment if any event, answered_reflection if any reflection, added_detail if any event has tags/notes (not loaded here). We approximate with reflections.
        setQuestProgress({
          quest_logged_moment: eventsSnap.size > 0,
          quest_answered_reflection: reflectionsSnap.size > 0,
          quest_added_detail: false,
        });
      } catch (err) {
        console.error('JourneyCard load failed', err);
        setProfile(null);
        setQuestProgress({ quest_logged_moment: false, quest_answered_reflection: false, quest_added_detail: false });
        setTotalEvents(0);
        setTotalReflections(0);
      }
      setLoading(false);
      if (onQuestUpdate) onQuestUpdate();
    };
    load();
  }, [user, onQuestUpdate]);

  const quests = [
    {
      key: 'quest_logged_moment',
      label: 'Log 1 moment',
      completed: questProgress.quest_logged_moment,
    },
    {
      key: 'quest_answered_reflection',
      label: 'Answer 1 reflection',
      completed: questProgress.quest_answered_reflection,
    },
    {
      key: 'quest_added_detail',
      label: 'Add a tag or note',
      completed: questProgress.quest_added_detail,
    },
  ];

  const completedCount = quests.filter(q => q.completed).length;
  const allComplete = completedCount === quests.length;
  const distinctDays = totalEvents > 0 ? Math.min(totalEvents, 7) : 0;
  const nextUnlockProgress = distinctDays < 7 ? distinctDays : 0;
  const nextUnlockTotal = 7;

  if (loading) {
    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={colors.text} />
          <Text style={{ color: colors.textSecondary }}>{t('common.loading') || 'Loading...'}</Text>
        </View>
      </View>
    );
  }

  if (!profile || profile.reflection_style === 'free') {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
        activeOpacity={0.8}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="sparkles" size={18} color="#60a5fa" />
            <Text style={[styles.title, { color: colors.text }]}>{t('journey.title') || 'Your Journey'}</Text>
          </View>
          {profile.streak_count ? (
            <View style={styles.streakPill}>
              <Feather name="trending-up" size={14} color="#60a5fa" />
              <Text style={styles.streakText}>
                {profile.streak_count} day{profile.streak_count === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.questList}>
          {quests.map((quest) => (
            <View key={quest.key} style={styles.questRow}>
              <View
                style={[
                  styles.questDot,
                  quest.completed ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' } : { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              />
              <Text
                style={[
                  styles.questLabel,
                  { color: quest.completed ? colors.textSecondary : colors.text },
                  quest.completed && { textDecorationLine: 'line-through' },
                ]}
              >
                {quest.label}
              </Text>
              {quest.completed && <Feather name="check" size={14} color="#22c55e" />}
            </View>
          ))}
        </View>

        {allComplete && (
          <View style={styles.completeRow}>
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '600' }}>
              Today complete! Come back tomorrow.
            </Text>
          </View>
        )}

        {!allComplete && nextUnlockProgress > 0 && (
          <View style={styles.unlockRow}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Next unlock progress
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {nextUnlockProgress}/{nextUnlockTotal} days
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '600' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.15)',
  },
  streakText: { color: '#60a5fa', fontSize: 12, fontWeight: '600' },
  questList: { gap: 6 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  questLabel: { fontSize: 13 },
  completeRow: { marginTop: 6 },
  unlockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
});
