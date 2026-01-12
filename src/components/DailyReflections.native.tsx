import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext.native';
import { useLanguage } from '../contexts/LanguageContext.native';
import { useAuth } from '../contexts/AuthContext.native';
import { getThemeColors } from '../lib/themeColors';
import { REFLECTION_QUESTIONS } from '../lib/dailyReflections';
import { db } from '../firebase/firebaseConfig';
import { awardXpOnce, ensureStatsDoc, getCurrentDateKey } from '../lib/game';

type DailyReflectionsProps = {
  momentId?: string;
  onComplete?: () => void;
};

type DailyReflectionDoc = {
  support_answer?: string | null;
  reframe_answer?: string | null;
  boundary_answer?: string | null;
  completed_at?: any;
};

export function DailyReflections({ momentId, onComplete }: DailyReflectionsProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const colors = getThemeColors(resolvedTheme === 'light');

  const [reflection, setReflection] = useState<DailyReflectionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setReflection(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const todayKey = getCurrentDateKey();
        const ref = doc(db, 'users', user.uid, 'daily_reflections', todayKey);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setReflection(snap.data() as DailyReflectionDoc);
        } else {
          setReflection(null);
        }
      } catch (err) {
        console.error('DailyReflections load failed', err);
        setReflection(null);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const questions = useMemo(() => {
    const byKey: Record<string, typeof REFLECTION_QUESTIONS[number]> = {};
    REFLECTION_QUESTIONS.forEach((q) => (byKey[q.key] = q));
    return byKey;
  }, []);

  const saveAnswer = async (field: 'support_answer' | 'reframe_answer' | 'boundary_answer', value: string) => {
    if (!user || !field || !value) {
      console.warn('saveAnswer blocked: missing user/field/value');
      return;
    }
    setSaving(true);
    try {
      const todayKey = getCurrentDateKey();
      if (!todayKey) {
        console.warn('saveAnswer blocked: missing todayKey');
        setSaving(false);
        return;
      }
      const ref = doc(db, 'users', user.uid, 'daily_reflections', todayKey);
      await setDoc(
        ref,
        {
          [field]: value,
          completed: false,
          dateKey: todayKey,
          momentId: momentId || null,
        },
        { merge: true }
      );
      setReflection((prev) => ({ ...(prev || {}), [field]: value }));
      if (onComplete) onComplete();
    } catch (err) {
      console.error('DailyReflections save failed', err);
    }
    setSaving(false);
  };

  const answeredCount =
    (reflection?.support_answer ? 1 : 0) +
    (reflection?.reframe_answer ? 1 : 0) +
    (reflection?.boundary_answer ? 1 : 0);
  const isComplete = answeredCount >= 3;

  useEffect(() => {
    const markComplete = async () => {
      if (!user || !isComplete || !reflection) return;
      const todayKey = getCurrentDateKey();
      const ref = doc(db, 'users', user.uid, 'daily_reflections', todayKey);
      await setDoc(ref, { completed: true, completedAt: new Date().toISOString(), dateKey: todayKey }, { merge: true });
      await ensureStatsDoc(user.uid);
      await awardXpOnce(user.uid, `DAILY_REFLECTIONS_COMPLETED_${todayKey}`, 15, { dateKey: todayKey });
      if (onComplete) onComplete();
    };
    markComplete();
  }, [isComplete, reflection, user, onComplete]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <ActivityIndicator color={colors.text} />
          <Text style={[styles.subtitle, { color: colors.textSecondary, marginLeft: 8 }]}>
            {t('common.loading') || 'Loading...'}
          </Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('reflections.title') || "Today's Reflections"}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('auth.signInToContinue') || 'Sign in to answer reflections.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t('reflections.title') || "Today's Reflections"}</Text>
        <View style={[styles.progressPill, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 12 }}>
            {answeredCount}/3
          </Text>
        </View>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {isComplete ? (t('reflections.complete') || 'Complete! Tap to view insight') : (t('reflection.dailyPrompt') || '3 daily questions to stay mindful')}
      </Text>

      <View style={[styles.statusCard, { borderColor: isComplete ? '#16a34a' : colors.border, backgroundColor: isComplete ? 'rgba(22,163,74,0.08)' : colors.inputBackground }]}>
        <View style={styles.statusHeader}>
          <Text style={[styles.statusTitle, { color: isComplete ? '#16a34a' : colors.text }]}>
            {isComplete ? (t('reflections.allComplete') || 'All reflections complete!') : (t('reflections.keepGoing') || 'Keep going')}
          </Text>
          {isComplete && <Text style={[styles.xpText, { color: '#16a34a' }]}>+10 XP</Text>}
        </View>
        {isComplete ? (
          <Text style={[styles.helper, { color: colors.text }]}>
            {t('reflections.complete') || "Complete! Tap to view insight"}
          </Text>
        ) : (
          <Text style={[styles.helper, { color: colors.textSecondary }]}>
            {t('reflections.keepGoing') || 'Keep going'}
          </Text>
        )}
      </View>

      <View style={{ gap: 12 }}>
        {( ['support', 'reframe', 'boundary'] as const).map((key) => {
          const q = questions[key];
          const labelText = t(`reflections.label.${key}`) || q?.label || key.toUpperCase();
          const questionText = t(`reflections.question.${key}`) || q?.question;
          const field =
            key === 'support'
              ? 'support_answer'
              : key === 'reframe'
              ? 'reframe_answer'
              : 'boundary_answer';
          const selected = (reflection as any)?.[field] || '';
          const choices = q?.answers?.map((a) => a.label) || [];
          return (
            <View key={key} style={styles.block}>
              <Text style={[styles.label, { color: colors.text }]}>{labelText}</Text>
              <Text style={[styles.prompt, { color: colors.textSecondary }]}>{questionText}</Text>
              <View style={styles.choices}>
                {choices.map((choice) => {
                  const isSelected = selected === choice;
                  const choiceKey = choice.replace(/\s+/g, '_');
                  const localizedChoice = t(`reflections.answer.${choiceKey}`) || choice;
                  return (
                    <TouchableOpacity
                      key={choice}
                      onPress={() => saveAnswer(field as any, choice)}
                      disabled={saving}
                      style={[
                        styles.choice,
                        {
                          backgroundColor: isSelected ? '#3b82f6' : colors.card,
                          borderColor: isSelected ? '#3b82f6' : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.choiceText, { color: isSelected ? '#fff' : colors.text }]}>
                        {localizedChoice}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: isComplete ? '#2563eb' : colors.inputBackground },
          ]}
          disabled={!isComplete}
          onPress={() => onComplete?.()}
        >
          <Text style={[styles.primaryText, { color: isComplete ? '#fff' : colors.textSecondary }]}>
            {t('reflections.done') || t('common.done') || 'Done'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
          onPress={async () => {
            if (!user) return;
            try {
              const todayKey = getCurrentDateKey();
              const ref = doc(db, 'users', user.uid, 'daily_reflections', todayKey);
              await setDoc(
                ref,
                {
                  support_answer: null,
                  reframe_answer: null,
                  boundary_answer: null,
                  completed: false,
                  completedAt: null,
                },
                { merge: true }
              );
              setReflection({
                support_answer: null,
                reframe_answer: null,
                boundary_answer: null,
                completed_at: null,
              });
            } catch (err) {
              console.error('DailyReflections reset failed', err);
            }
          }}
        >
          <Feather name="edit-3" size={16} color={colors.textSecondary} />
          <Text style={[styles.secondaryText, { color: colors.text }]}>{t('reflection.editCta') || t('common.edit') || 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      {reflection?.completed_at && (
        <Text style={[styles.footer, { color: colors.textTertiary }]}>
          {t('reflections.completed') || 'Completed'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  block: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  prompt: { fontSize: 13, lineHeight: 18 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  choiceText: { fontSize: 14, fontWeight: '500' },
  footer: { marginTop: 8, fontSize: 12 },
  statusCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 6, gap: 4 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTitle: { fontSize: 15, fontWeight: '700' },
  xpText: { fontWeight: '700' },
  helper: { fontSize: 12, lineHeight: 18 },
  footerRow: { flexDirection: 'column', alignItems: 'stretch', gap: 8, marginTop: 12 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 12, justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '600' },
  primaryButton: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryText: { fontSize: 15, fontWeight: '700' },
});
