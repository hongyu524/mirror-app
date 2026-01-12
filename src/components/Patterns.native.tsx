import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { collection, getDocs, orderBy, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext.native';
import { useTheme } from '../contexts/ThemeContext.native';
import { useLanguage } from '../contexts/LanguageContext.native';
import { useProgress } from '../hooks/useProgress.native';
import { getThemeColors } from '../lib/themeColors';
import { db } from '../firebase/firebaseConfig';
import { JourneyMiniStatus } from './JourneyMiniStatus.native';
import { REFLECTION_QUESTIONS } from '../lib/dailyReflections';
import { ReflectionSummaryReadOnly } from './ReflectionSummaryReadOnly';
import { DailyReflections } from './DailyReflections.native';
import { getEmotionEmoji, COLOR_PALETTE } from '../lib/emotions';
import {
  analyzeEmotionalTrends,
  analyzeRelationshipImpact,
  analyzeEmotionalPhase,
  generateInsightSummary,
} from '../lib/proInsights';
import {
  reconcileWeeklyReset,
  reconcileStatsFromData,
  reconcileBadges,
  reconcileDailyQuests,
  ensureStatsDoc,
  getCurrentDateKey,
} from '../lib/game';

type Contact = {
  id: string;
  name: string;
  relationship_type?: string | null;
};

type Event = {
  id: string;
  title?: string;
  description?: string | null;
  primaryEmotion?: string | null;
  emotionIntensity?: number | null;
  moodColor?: string | null;
  contactIds?: string[];
  tags?: string[];
  startAt?: any;
};

type EmotionStat = {
  emotion: string;
  count: number;
  percentage: number;
};

type RelationshipStat = {
  type: string;
  count: number;
};

type TagStat = {
  tag: string;
  count: number;
};

type PatternsProps = {
  onNavigate?: (screen: 'capture' | 'timeline' | 'patterns' | 'settings', options?: { scrollToReflections?: boolean }) => void;
  scrollToReflections?: boolean;
  onScrollComplete?: () => void;
};

const CONFIDENCE_THRESHOLD = 5;

export function Patterns({ onNavigate, scrollToReflections, onScrollComplete }: PatternsProps = {}) {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const { t, language } = useLanguage();
  const { progress } = useProgress();
  const insets = useSafeAreaInsets();
  const translateLevelName = (name?: string | null) => {
    const key = name ? `levels.${(name || '').toLowerCase()}` : 'levels.explorer';
    const localized = t(key);
    return localized === key ? (name || t('levels.explorer')) : localized;
  };
  const translateEmotion = (emo?: string | null) => {
    if (!emo) return '';
    const key = `emotion.${emo}`;
    const val = t(key);
    return val === key ? emo : val;
  };
  const colors = getThemeColors(resolvedTheme === 'light');
  const scrollRef = useRef<ScrollView>(null);

  const [timeFrame, setTimeFrame] = useState<'week' | 'month' | '6months' | 'year'>('week');
  const [events, setEvents] = useState<Event[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColorWheel, setShowColorWheel] = useState(false);
  const [plan, setPlan] = useState<'free' | 'premium'>('free');
  const [proInsights, setProInsights] = useState<{
    trend: ReturnType<typeof analyzeEmotionalTrends>;
    relationships: ReturnType<typeof analyzeRelationshipImpact>;
    phase: ReturnType<typeof analyzeEmotionalPhase>;
    summary: string[];
  } | null>(null);
  const [reflectionStatus, setReflectionStatus] = useState<{ answered: number; total: number; completed: boolean }>({
    answered: 0,
    total: 3,
    completed: false,
  });
  const [showReflectionsEditor, setShowReflectionsEditor] = useState(false);

  useEffect(() => {
    const reconcile = async () => {
      if (!user) return;
      const todayKey = getCurrentDateKey();
      await ensureStatsDoc(user.uid);
      await reconcileWeeklyReset(user.uid);
      await reconcileStatsFromData(user.uid);
      await reconcileBadges(user.uid);
      await reconcileDailyQuests(user.uid, todayKey);
    };
    reconcile();
  }, [user]);

  useEffect(() => {
    if (scrollToReflections) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
        onScrollComplete?.();
      }, 300);
    }
  }, [scrollToReflections, onScrollComplete]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setContacts([]);
      setReflectionStatus({ answered: 0, total: 3, completed: false });
      setLoading(false);
      return;
    }

    setLoading(true);
    const uid = user.uid;
    const eventsCol = collection(db, 'users', uid, 'events');
    const contactsCol = collection(db, 'users', uid, 'contacts');

    const unsubEvents = onSnapshot(query(eventsCol, orderBy('startAt', 'desc')), (snap) => {
      const eventList: Event[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          description: data.description || '',
          primaryEmotion: data.primaryEmotion || data.primary_emotion || null,
          emotionIntensity: data.emotionIntensity ?? data.emotion_intensity ?? null,
          moodColor: data.moodColor || data.color || null,
          contactIds: data.contactIds || (data.contact_id ? [data.contact_id] : []),
          tags: data.tags || [],
          startAt: data.startAt || data.event_date || null,
        };
      });
      setEvents(eventList);
      setLoading(false);
    }, (err) => {
      console.error('Failed to load patterns data', err);
      setEvents([]);
      setLoading(false);
    });

    const unsubContacts = onSnapshot(query(contactsCol, orderBy('name')), (snap) => {
      const contactList: Contact[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || '',
        relationship_type: d.data().relationship_type || null,
      }));
      setContacts(contactList);
    }, (err) => {
      console.error('Failed to load contacts data', err);
      setContacts([]);
    });

    const loadReflectionStatus = async () => {
      try {
        const todayKey = getCurrentDateKey();
        const profileRef = doc(db, 'users', uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const pd: any = profileSnap.data();
          setPlan(pd?.plan === 'premium' ? 'premium' : 'free');
        } else {
          setPlan('free');
        }
        const ref = doc(db, 'users', uid, 'daily_reflections', todayKey);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setReflectionStatus({ answered: 0, total: 3, completed: false });
        } else {
          const data: any = snap.data();
          const answered =
            (data?.support_answer ? 1 : 0) +
            (data?.reframe_answer ? 1 : 0) +
            (data?.boundary_answer ? 1 : 0);
          const completed = data?.completed || answered >= 3;
          setReflectionStatus({ answered, total: 3, completed });
        }
      } catch (err) {
        console.error('Failed to load reflection status', err);
        setReflectionStatus({ answered: 0, total: 3, completed: false });
      }
    };
    loadReflectionStatus();

    return () => {
      unsubEvents();
      unsubContacts();
    };
  }, [user]);

  const filteredEvents = useMemo(() => {
    const cutoff = new Date();
    switch (timeFrame) {
      case 'week':
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
      case '6months':
        cutoff.setMonth(cutoff.getMonth() - 6);
        break;
      case 'year':
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        break;
    }
    return events.filter((e) => {
      if (!e.startAt) return false;
      const date = e.startAt?.toDate ? e.startAt.toDate() : new Date(e.startAt);
      return date >= cutoff;
    });
  }, [events, timeFrame]);

  const smartAdvice = useMemo(() => {
    if (!proInsights) return [];
    const adv: string[] = [];
    const { trend, relationships, phase } = proInsights;
    if (Math.abs(trend.changePct) > 10) {
      adv.push(
        `Your intensity is ${trend.changePct > 0 ? 'rising' : 'cooling'} (${Math.abs(
          trend.changePct
        ).toFixed(0)}% vs last month).`
      );
    }
    if (relationships[0] && relationships[0].share > 50) {
      adv.push(`${relationships[0].name} dominates your emotional events (${relationships[0].share.toFixed(0)}%).`);
    }
    if (phase.phase === 'Numb') {
      adv.push('Low intensity and variance — try journaling one deeper reflection.');
    } else if (phase.phase === 'Volatile') {
      adv.push('High variance — schedule a calming activity to stabilize.');
    } else if (phase.phase === 'Escalating') {
      adv.push('Intensity is steady and elevated — check in with trusted support.');
    }
    if (!adv.length && relationships[1]) {
      adv.push(`Secondary influence: ${relationships[1].name} at ${relationships[1].share.toFixed(0)}%.`);
    }
    return adv.slice(0, 3);
  }, [proInsights]);

  const localizedSummary = useMemo(() => {
    if (!proInsights) return [];
    if (language === 'zh') {
      const lines: string[] = [];
      const { trend, relationships, phase } = proInsights;
      lines.push(`主导情绪本月：${translateEmotion(trend.thisMonth.dominantEmotion) || trend.thisMonth.dominantEmotion || ''}。`);
      if (relationships[0]) {
        lines.push(`${relationships[0].name} 占比 ${relationships[0].share.toFixed(0)}%，平均强度 ${relationships[0].avgIntensity.toFixed(1)}。`);
      }
      const phaseMap: Record<string, string> = {
        Stable: '稳定',
        Volatile: '波动',
        Recovering: '恢复',
        Escalating: '升高',
        Numb: '麻木',
      };
      lines.push(`阶段：${phaseMap[phase.phase] || phase.phase} — ${phase.reason}`);
      return lines;
    }
    return proInsights.summary;
  }, [proInsights, language, translateEmotion]);

  const isPro = plan === 'premium';

  useEffect(() => {
    if (!isPro || !events.length) {
      setProInsights(null);
      return;
    }
    const enrichedEvents = events.map((e) => ({
      ...e,
      contactName: contacts.find((c) => c.id === (e.contactIds && e.contactIds[0]))?.name || null,
    }));
    const trend = analyzeEmotionalTrends(enrichedEvents);
    const relationships = analyzeRelationshipImpact(enrichedEvents, contacts);
    const phase = analyzeEmotionalPhase(enrichedEvents);
    const summary = generateInsightSummary({ trend, phase, relationships });
    setProInsights({ trend, relationships, phase, summary });
  }, [events, contacts, isPro]);

  const emotionStats: EmotionStat[] = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      const emo = e.primaryEmotion;
      if (!emo) return;
      counts[emo] = (counts[emo] || 0) + 1;
    });
    const total = filteredEvents.length || 1;
    return Object.entries(counts)
      .map(([emotion, count]) => ({ emotion, count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  const relationshipStats: RelationshipStat[] = useMemo(() => {
    const map: Record<string, RelationshipStat> = {};
    filteredEvents.forEach((e) => {
      const cid = (e.contactIds && e.contactIds[0]) || '';
      const rel = contacts.find((c) => c.id === cid)?.relationship_type || 'other';
      if (!map[rel]) map[rel] = { type: rel, count: 0 };
      map[rel].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filteredEvents, contacts]);

  const tagStats: TagStat[] = useMemo(() => {
    const map: Record<string, TagStat> = {};
    filteredEvents.forEach((e) => {
      (e.tags || []).forEach((tag) => {
        if (!map[tag]) map[tag] = { tag, count: 0 };
        map[tag].count += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  const weekdayStats = useMemo(() => {
    const stats: { day: string; count: number }[] = [];
    const dayNames = [
      t('weekday.sun'),
      t('weekday.mon'),
      t('weekday.tue'),
      t('weekday.wed'),
      t('weekday.thu'),
      t('weekday.fri'),
      t('weekday.sat'),
    ];
    const counts: number[] = Array(7).fill(0);
    filteredEvents.forEach((e) => {
      if (!e.startAt) return;
      const date = e.startAt?.toDate ? e.startAt.toDate() : new Date(e.startAt);
      counts[date.getDay()] += 1;
    });
    dayNames.forEach((d, i) => stats.push({ day: d, count: counts[i] }));
    return stats;
  }, [filteredEvents]);

  const avgIntensity = useMemo(() => {
    const ints = filteredEvents.map((e) => Number(e.emotionIntensity || 0)).filter((n) => !isNaN(n));
    if (!ints.length) return 0;
    return ints.reduce((a, b) => a + b, 0) / ints.length;
  }, [filteredEvents]);

  const interactionStats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      (e.contactIds || []).forEach((id) => {
        map[id] = (map[id] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([id, count]) => ({
        id,
        name: contacts.find((c) => c.id === id)?.name || 'Unknown',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEvents, contacts]);

  const intensitySeries = useMemo(() => {
    const sorted = [...filteredEvents].sort((a, b) => {
      const aDate = a.startAt?.toDate ? a.startAt.toDate() : new Date(a.startAt || '');
      const bDate = b.startAt?.toDate ? b.startAt.toDate() : new Date(b.startAt || '');
      return aDate.getTime() - bDate.getTime();
    });
    return sorted.slice(-7).map((e) => {
      const date = e.startAt?.toDate ? e.startAt.toDate() : new Date(e.startAt || '');
      return {
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: Number(e.emotionIntensity || 0) || 0,
        emotion: e.primaryEmotion || '',
      };
    });
  }, [filteredEvents]);

  const dominantColor = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      if (!e.moodColor) return;
      map[e.moodColor] = (map[e.moodColor] || 0) + 1;
    });
    const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
    return top?.[0] || '#fbbf24';
  }, [filteredEvents]);

  const promptCards = useMemo(
    () =>
      REFLECTION_QUESTIONS.map((q) => ({
        id: q.key,
        category: q.label,
        prompt_text: q.question,
        quick_choices: q.answers.slice(0, 4).map((a) => a.label),
      })),
    []
  );

  const distinctContacts = useMemo(() => {
    const ids = new Set<string>();
    filteredEvents.forEach((e) => (e.contactIds || []).forEach((id) => ids.add(id)));
    return ids.size;
  }, [filteredEvents]);

  const topEmotion = emotionStats[0];
  const hasEnoughData = filteredEvents.length >= CONFIDENCE_THRESHOLD;

  const summaryText = useMemo(() => {
    if (filteredEvents.length === 0) return t('patterns.noData') || 'No data available yet.';
    const parts: string[] = [];
    if (language === 'zh') {
      parts.push(`记录 ${filteredEvents.length} 个时刻，涉及 ${distinctContacts} 个人物。`);
      if (topEmotion) {
        const emo = translateEmotion(topEmotion.emotion) || topEmotion.emotion;
        parts.push(`最常见情绪：${emo} (${topEmotion.count}, ${topEmotion.percentage.toFixed(0)}%)。`);
      }
      parts.push(`平均强度：${avgIntensity.toFixed(1)}/5。`);
      if (weekdayStats.length) {
        const busiest = [...weekdayStats].sort((a, b) => b.count - a.count)[0];
        if (busiest?.count)
          parts.push(`最活跃的日子：${t(`weekday.${busiest.day.toLowerCase?.() || busiest.day}`) || busiest.day}。`);
      }
      return parts.join(' ');
    }
    parts.push(`Logged ${filteredEvents.length} moments with ${distinctContacts} people.`);
    if (topEmotion) {
      parts.push(
        `Most common feeling: ${translateEmotion(topEmotion.emotion) || topEmotion.emotion} (${topEmotion.count}, ${topEmotion.percentage.toFixed(
          0
        )}%).`
      );
    }
    parts.push(`Avg intensity: ${avgIntensity.toFixed(1)}/5.`);
    if (weekdayStats.length) {
      const busiest = [...weekdayStats].sort((a, b) => b.count - a.count)[0];
      if (busiest?.count) parts.push(`Most active day: ${busiest.day}.`);
    }
    return parts.join(' ');
  }, [filteredEvents, distinctContacts, topEmotion, avgIntensity, weekdayStats, t, language]);
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <JourneyMiniStatus onNavigate={onNavigate} />

        <View style={styles.sectionHeader}>
          <View style={styles.headerLeft}>
            <Feather name="bar-chart-2" size={20} color={colors.textSecondary} />
            <Text style={[styles.title, { color: colors.text }]}>{t('patterns.patternReport')}</Text>
          </View>
          <View style={[styles.badgePill, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {filteredEvents.length} {t('patterns.moments')}
            </Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('patterns.insightsFrom')}</Text>
        <View style={[styles.levelRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.levelChip}>
            <Feather name="award" size={14} color="#facc15" />
            <Text style={[styles.levelText, { color: colors.text }]}>
              {(() => {
                const lvlNum = progress?.level ?? 1;
                const name = translateLevelName(progress?.levelName);
                const normalized = (name || '').toLowerCase();
                const hideName = name && normalized.includes('level') && normalized.includes(String(lvlNum));
                const suffix = !name || hideName ? '' : ` · ${name}`;
                return `${t('journey.level') || 'Level'} ${lvlNum}${suffix}`;
              })()}
            </Text>
          </View>
          {progress?.activeBadge && (
            <View style={styles.badgeChip}>
              <Text style={styles.badgeIcon}>{(progress.activeBadge as any).icon || '🎖️'}</Text>
              <Text style={[styles.badgeText, { color: colors.text }]}>{t('patterns.activeBadge')}</Text>
            </View>
          )}
        </View>

        <View style={[styles.timeRow, { borderColor: colors.border }]}>
          {(['week', 'month', '6months', 'year'] as const).map((tf) => (
            <TouchableOpacity
              key={tf}
              onPress={() => setTimeFrame(tf)}
              style={[
                styles.timeChip,
                {
                  backgroundColor: timeFrame === tf ? '#3b82f6' : colors.card,
                  borderColor: timeFrame === tf ? '#3b82f6' : colors.border,
                },
              ]}
            >
                <Text style={[styles.timeText, { color: timeFrame === tf ? '#fff' : colors.textSecondary }]}>
                  {tf === 'week'
                    ? t('patterns.week') || 'Past Week'
                    : tf === 'month'
                    ? t('patterns.month') || 'Past Month'
                    : tf === '6months'
                    ? t('patterns.6months') || 'Past 6 Months'
                    : t('patterns.year') || 'Past Year'}
                </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.text} />
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{t('common.loading') || 'Loading...'}</Text>
          </View>
        ) : !user ? (
          <View style={[styles.card, { borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('auth.signIn')}</Text>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>{t('auth.signInToContinue')}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: isPro ? '#0b1220' : colors.card }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="zap" size={18} color={isPro ? '#fbbf24' : colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: isPro ? '#fbbf24' : colors.text }]}>{t('patterns.proInsights')}</Text>
                </View>
                {!isPro && (
                  <TouchableOpacity style={styles.upgradePill}>
                    <Text style={styles.upgradeText}>{t('common.upgrade') || 'Upgrade'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!isPro ? (
                <View style={{ gap: 10 }}>
                  {[
                    t('patterns.deepAnalysis') || 'Deep Emotional Analysis',
                    t('patterns.relationshipMap') || 'Relationship Influence Map',
                    t('patterns.trendComparison') || 'Long-term Trend Comparison',
                    t('patterns.aiReport') || 'AI Insight Report',
                  ].map((title, idx) => (
                    <View key={title} style={[styles.lockedCard, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}>
                      <View style={styles.lockedHeader}>
                        <Feather name="lock" size={16} color={colors.textSecondary} />
                        <Text style={[styles.cardText, { color: colors.text }]}>{title}</Text>
                      </View>
                      <Text style={[styles.helper, { color: colors.textTertiary }]}>{t('patterns.unlockPro')}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <>
                  <View style={[styles.proCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={styles.cardHeaderLeft}>
                      <Feather name="activity" size={16} color="#34d399" />
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.aiInsight')}</Text>
                    </View>
                    <View style={{ gap: 6, marginTop: 6 }}>
                      {(localizedSummary || []).map((line, idx) => (
                        <Text key={idx} style={[styles.helper, { color: colors.textSecondary }]}>{line}</Text>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.proCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={styles.cardHeaderLeft}>
                      <Feather name="trending-down" size={16} color="#60a5fa" />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.longTerm')}</Text>
                    </View>
                    {proInsights && (
                      <View style={{ gap: 6, marginTop: 6 }}>
                        <Text style={[styles.helper, { color: colors.textSecondary }]}>
                          {language === 'zh'
                            ? `本月平均强度 ${proInsights.trend.thisMonth.avgIntensity.toFixed(1)}/5，对比上月 ${proInsights.trend.prevMonth.avgIntensity.toFixed(1)}/5（${proInsights.trend.changePct >= 0 ? '+' : ''}${proInsights.trend.changePct.toFixed(0)}%）。`
                            : `This month avg intensity ${proInsights.trend.thisMonth.avgIntensity.toFixed(1)}/5 vs last month ${proInsights.trend.prevMonth.avgIntensity.toFixed(1)}/5 (${proInsights.trend.changePct >= 0 ? '+' : ''}${proInsights.trend.changePct.toFixed(0)}%).`}
                        </Text>
                        <Text style={[styles.helper, { color: colors.textSecondary }]}>
                          {language === 'zh'
                            ? `主导情绪：${translateEmotion(proInsights.trend.thisMonth.dominantEmotion)}。`
                            : `Dominant emotion: ${translateEmotion(proInsights.trend.thisMonth.dominantEmotion) || proInsights.trend.thisMonth.dominantEmotion}.`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.proCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={styles.cardHeaderLeft}>
                      <Feather name="users" size={16} color="#a78bfa" />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.relationshipImpact')}</Text>
                    </View>
                    {proInsights && (
                      <View style={{ gap: 8, marginTop: 8 }}>
                        {proInsights.relationships.slice(0, 3).map((r) => (
                          <View key={r.id} style={styles.relationRow}>
                            <Text style={[styles.listLabel, { color: colors.text }]}>{r.name}</Text>
                            <Text style={[styles.helper, { color: colors.textSecondary }]}>
                              {language === 'zh'
                                ? `${r.count} 个时刻 · ${translateEmotion(r.dominantEmotion)} ${r.dominantEmoji} · ${r.avgIntensity.toFixed(1)}/5 · ${r.share.toFixed(0)}%`
                                : `${r.count} moments · ${r.dominantEmotion} ${r.dominantEmoji} · ${r.avgIntensity.toFixed(1)}/5 · ${r.share.toFixed(0)}%`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={[styles.proCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={styles.cardHeaderLeft}>
                      <Feather name="aperture" size={16} color="#f59e0b" />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.emotionalPhase')}</Text>
                    </View>
                    {proInsights && (
                      <Text style={[styles.helper, { color: colors.textSecondary, marginTop: 6 }]}>
                        {(() => {
                          const phaseMap: Record<string, { zh: string; en: string }> = {
                            Stable: { zh: '稳定', en: 'Stable' },
                            Volatile: { zh: '波动', en: 'Volatile' },
                            Recovering: { zh: '恢复', en: 'Recovering' },
                            Escalating: { zh: '升高', en: 'Escalating' },
                            Numb: { zh: '麻木', en: 'Numb' },
                          };
                          const p = proInsights.phase.phase;
                          const label = language === 'zh' ? (phaseMap[p]?.zh || p) : p;
                          return language === 'zh'
                            ? `你似乎处于“${label}”阶段 — ${proInsights.phase.reason}`
                            : `You appear to be in a “${label}” phase — ${proInsights.phase.reason}`;
                        })()}
                      </Text>
                    )}
                  </View>

                  <View style={[styles.proCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <View style={styles.cardHeaderLeft}>
                      <Feather name="compass" size={16} color="#38bdf8" />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.smartAdvice')}</Text>
                    </View>
                    {(smartAdvice.length ? smartAdvice : ['Stay consistent and add a reflection today.']).map((line, idx) => (
                      <Text key={idx} style={[styles.helper, { color: colors.textSecondary, marginTop: 6 }]}>{line}</Text>
                    ))}
                  </View>
                </>
              )}
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.cardHeader}
                activeOpacity={0.8}
                onPress={() => setShowColorWheel((v) => !v)}
              >
                <View style={styles.cardHeaderLeft}>
                  <Feather name="info" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.colorWheel')}</Text>
                </View>
                <Feather
                  name={showColorWheel ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                Tap to view the color meanings based on color psychology.
              </Text>
              {showColorWheel && (
                <View style={styles.colorGrid}>
                  {COLOR_PALETTE.map((item) => (
                    <View key={item.name} style={styles.colorRow}>
                      <View style={[styles.colorDot, { backgroundColor: item.hex }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.listLabel, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.helper, { color: colors.textSecondary }]}>{item.meaning}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { borderColor: colors.border, backgroundColor: '#111827' }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="alert-circle" size={18} color="#fbbf24" />
                  <Text style={[styles.cardTitle, { color: '#fbbf24' }]}>{t('patterns.summary')}</Text>
                </View>
              </View>
              <Text style={[styles.cardText, { color: '#f8fafc' }]}>
                {summaryText}
              </Text>
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="droplet" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.yourPalette')}</Text>
                </View>
                <Feather name="info" size={16} color={colors.textTertiary} />
              </View>
              <View style={styles.paletteRow}>
                <View style={[styles.paletteDot, { backgroundColor: dominantColor }]} />
                <Text style={[styles.cardText, { color: colors.text }]}>
                  {topEmotion ? translateEmotion(topEmotion.emotion) : t('patterns.noData')}
                </Text>
              </View>
            </View>

            <View style={styles.statGrid}>
              <View style={[styles.statCard, { borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{filteredEvents.length}</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.momentsLabel')}</Text>
                <Text style={[styles.helper, { color: colors.textTertiary }]}>{t('patterns.selectedRange')}</Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{distinctContacts}</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.peopleLabel')}</Text>
                <Text style={[styles.helper, { color: colors.textTertiary }]}>{t('patterns.interactedWith')}</Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {topEmotion ? translateEmotion(topEmotion.emotion) : '—'}
                </Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.topFeeling')}</Text>
                <Text style={[styles.helper, { color: colors.textTertiary }]}>{t('patterns.mostFrequent')}</Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{avgIntensity.toFixed(1)}/5</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.avgIntensityLabel')}</Text>
                <Text style={[styles.helper, { color: colors.textTertiary }]}>{t('patterns.emotionalDepth')}</Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{progress?.level ?? 1}</Text>
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.levelLabel')}</Text>
                <Text style={[styles.helper, { color: colors.textTertiary }]}>XP {progress?.totalXP ?? 0}</Text>
              </View>
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="activity" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.emotionOverTime')}</Text>
                </View>
              </View>
              {intensitySeries.length === 0 ? (
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.noData')}</Text>
              ) : (
                <View style={styles.sparkLine}>
                  {intensitySeries.map((point, idx) => {
                    const next = intensitySeries[idx + 1];
                    return (
                      <View key={`${point.label}-${idx}`} style={styles.sparkPoint}>
                        <View
                          style={[
                            styles.sparkDot,
                            {
                              backgroundColor: '#facc15',
                              marginBottom: point.value * 4,
                            },
                          ]}
                        />
                        {next && (
                          <View
                            style={[
                              styles.sparkConnector,
                              {
                                height: Math.abs((next.value - point.value) * 4) + 2,
                                backgroundColor: '#facc15',
                              },
                            ]}
                          />
                        )}
                        <Text style={[styles.sparkLabel, { color: colors.textSecondary }]}>{point.label}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="heart" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.emotionDistribution')}</Text>
                </View>
              </View>
              {emotionStats.length === 0 ? (
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.noData')}</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {emotionStats.slice(0, 5).map((stat) => {
                    const label = translateEmotion(stat.emotion);
                    return (
                      <View key={stat.emotion} style={styles.listRow}>
                        <View style={styles.listRowLeft}>
                          <Text style={{ fontSize: 16 }}>{getEmotionEmoji(stat.emotion)}</Text>
                          <Text style={[styles.listLabel, { color: colors.text }]}>{label}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${Math.max(10, stat.percentage)}%`, backgroundColor: '#fbbf24' },
                            ]}
                          />
                        </View>
                        <Text style={[styles.listValue, { color: colors.textSecondary }]}>{stat.count}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="users" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.interactionFrequency')}</Text>
                </View>
              </View>
              {interactionStats.length === 0 ? (
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.noData')}</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {interactionStats.map((stat) => (
                    <View key={stat.id} style={styles.listRow}>
                      <Text style={[styles.listLabel, { color: colors.text }]}>{stat.name}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${Math.min(100, stat.count * 25)}%`, backgroundColor: '#fbbf24' },
                          ]}
                        />
                      </View>
                      <Text style={[styles.listValue, { color: colors.textSecondary }]}>{stat.count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="smile" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.emotionByRelationship')}</Text>
                </View>
              </View>
              {relationshipStats.length === 0 ? (
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.noData')}</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {relationshipStats.map((stat) => (
                    <View key={stat.type} style={styles.listRow}>
                      <Text style={[styles.listLabel, { color: colors.text }]}>{stat.type}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${Math.min(100, stat.count * 25)}%`, backgroundColor: '#a78bfa' },
                          ]}
                        />
                      </View>
                      <Text style={[styles.listValue, { color: colors.textSecondary }]}>{stat.count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="layers" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.patternsByDOW')}</Text>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {weekdayStats.map((stat) => (
                  <View key={stat.day} style={styles.listRow}>
                    <Text style={[styles.listLabel, { color: colors.text }]}>{stat.day}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.min(100, stat.count * 20)}%`, backgroundColor: '#fbbf24' },
                        ]}
                      />
                    </View>
                    <Text style={[styles.listValue, { color: colors.textSecondary }]}>{stat.count}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Feather name="hash" size={18} color={colors.textSecondary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{t('patterns.recurringThemes')}</Text>
                </View>
              </View>
              {tagStats.length === 0 ? (
                <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('patterns.noTags')}</Text>
              ) : (
                <View style={styles.tagRow}>
                  {tagStats.slice(0, 10).map((tag) => (
                    <View key={tag.tag} style={[styles.tagChip, { borderColor: colors.border }]}>
                      <Text style={{ color: colors.text }}>#{tag.tag}</Text>
                      <Text style={{ color: colors.textSecondary }}>{tag.count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <ReflectionSummaryReadOnly
              answeredCount={reflectionStatus.answered}
              total={reflectionStatus.total}
              completed={reflectionStatus.completed}
              onEdit={() => setShowReflectionsEditor(true)}
            />
          </>
        )}
      </ScrollView>

      <Modal
        visible={showReflectionsEditor}
        animationType="slide"
        onRequestClose={() => setShowReflectionsEditor(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) }}>
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{t('reflection.todayTitle')}</Text>
            <TouchableOpacity hitSlop={12} onPress={() => setShowReflectionsEditor(false)}>
              <Feather name="x" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 24) }}>
            <DailyReflections onComplete={() => { /* keep open until user closes */ }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgePill: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 999 },
  title: { fontSize: 20, fontWeight: '600' },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  timeChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeText: { fontSize: 12, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardText: { fontSize: 14, lineHeight: 20 },
  proCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10, gap: 6, backgroundColor: '#0f172a' },
  helper: { fontSize: 12, marginTop: 6, lineHeight: 18 },
  upgradePill: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2563eb', borderRadius: 999 },
  upgradeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  loadingCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listLabel: { fontSize: 14, fontWeight: '600' },
  listValue: { fontSize: 13 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorRow: { width: '45%', flexDirection: 'row', alignItems: 'center', gap: 6 },
  colorDot: { width: 10, height: 10, borderRadius: 10 },
  paletteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paletteDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#1f2937' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flexBasis: '47%', borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  statValue: { fontSize: 24, fontWeight: '700' },
  sparkLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 120 },
  sparkPoint: { alignItems: 'center' },
  sparkDot: { width: 10, height: 10, borderRadius: 10 },
  sparkConnector: { width: 2, marginTop: 2 },
  sparkLabel: { fontSize: 12, marginTop: 4 },
  barTrack: { flex: 1, height: 10, borderRadius: 8, marginHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  barFill: { height: 10, borderRadius: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 999 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  levelChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelText: { fontWeight: '700', fontSize: 14 },
  badgeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  badgeIcon: { fontSize: 14 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  lockedCard: { borderWidth: 1, borderRadius: 12, padding: 10 },
  lockedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  relationRow: { gap: 2 },
});
