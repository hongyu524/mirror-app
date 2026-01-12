import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import Svg, { Circle } from 'react-native-svg';
import { useLanguage } from '../contexts/LanguageContext.native';
import { useAuth } from '../contexts/AuthContext.native';
import { db } from '../firebase/firebaseConfig';

interface JourneyDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentDay: number;
  totalDays: number;
  nextUnlock: string;
  daysUntilUnlock: number;
  todayTasks: {
    id: string;
    label: string;
    completed: boolean;
    statusText?: string;
    action?: () => void;
  }[];
  onPrimaryCTA: () => void;
  primaryCTALabel: string;
  onNavigate?: (screen: 'capture' | 'timeline' | 'patterns' | 'settings', options?: { scrollToReflections?: boolean }) => void;
  onOpenBadges?: () => void;
  title?: string;
}

export function JourneyDetailsSheet({
  isOpen,
  onClose,
  currentDay,
  totalDays,
  nextUnlock,
  daysUntilUnlock,
  todayTasks,
  onPrimaryCTA,
  primaryCTALabel,
  onOpenBadges,
  title,
}: JourneyDetailsSheetProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [newlyUnlockedDays, setNewlyUnlockedDays] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [streakCount, setStreakCount] = useState(0);

  useEffect(() => {
    const checkUnlockedDays = async () => {
      const previous = new Set<number>();
      const newly = new Set<number>();
      [1, 3, 7].forEach(day => {
        if (currentDay >= day && !previous.has(day)) {
          newly.add(day);
          previous.add(day);
        }
      });
      setNewlyUnlockedDays(newly);
    };

    const loadStreak = async () => {
      if (!user) {
        setStreakCount(0);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setStreakCount(data?.streak_count || 0);
        } else {
          setStreakCount(0);
        }
      } catch (err) {
        console.error('JourneyDetailsSheet streak load failed', err);
        setStreakCount(0);
      }
      setLoading(false);
    };

    if (isOpen) {
      checkUnlockedDays();
      loadStreak();
    }
  }, [currentDay, isOpen, user]);

  const progress = (currentDay / totalDays) * 100;

  const features = [
    { day: 1, name: t('journey.dailyReflections'), benefit: t('journey.dailyReflectionsBenefit'), isNew: newlyUnlockedDays.has(1) },
    { day: 1, name: t('journey.emotionTracking'), benefit: t('journey.emotionTrackingBenefit'), isNew: newlyUnlockedDays.has(1) },
    { day: 3, name: t('journey.patternRecognition'), benefit: t('journey.patternRecognitionBenefit'), isNew: newlyUnlockedDays.has(3) },
    { day: 7, name: t('journey.dowPatterns'), benefit: t('journey.dowPatternsBenefit'), isNew: newlyUnlockedDays.has(7) },
  ];

  const unlockedFeatures = features.filter(f => currentDay >= f.day);
  const nextFeature = features.find(f => currentDay < f.day);
  const circumference = 2 * Math.PI * 34;
  const progressArc = (progress / 100) * circumference;
  const showStreak = useMemo(() => streakCount > 0, [streakCount]);

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
          <View style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{title || t('journey.title')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#e5e7eb" />
                <Text style={styles.loadingText}>{t('common.loading')}</Text>
              </View>
            )}

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View>
                  <Text style={styles.progressLabel}>{t('journey.progress')}</Text>
                  <Text style={styles.progressValue}>
                    {language === 'zh'
                      ? `${t('journey.dayLabel')} ${currentDay}/${totalDays} 天`
                      : `${t('journey.dayLabel')} ${currentDay}/${totalDays}`}
                  </Text>
                </View>
                <View style={styles.progressCircle}>
                  <Svg width={80} height={80} style={styles.svg}>
                    <Circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke="#1e40af"
                      strokeWidth="4"
                    />
                    <Circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="4"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - progressArc}
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                    />
                  </Svg>
                  <View style={styles.progressCircleText}>
                    <Text style={styles.progressCircleDay}>{currentDay}/{totalDays}</Text>
                    <Text style={styles.progressCirclePercent}>{Math.round(progress)}%</Text>
                  </View>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressNote}>
                {t('journey.progressNote') || 'Progress counts distinct days with ≥1 moment logged.'}
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="zap" size={20} color="#4ade80" />
                <Text style={styles.sectionTitle}>{t('journey.availableNow')}</Text>
              </View>
              {showStreak && (
                <View style={styles.streakRow}>
                  <Feather name="trending-up" size={16} color="#22c55e" />
                  <Text style={styles.streakText}>
                    {language === 'zh'
                      ? `${t('journey.streak')}: ${streakCount} 天`
                      : `${t('journey.streak')}: ${streakCount} day${streakCount === 1 ? '' : 's'}`}
                  </Text>
                </View>
              )}
              <View style={styles.featuresList}>
                {unlockedFeatures.map((feature, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Feather name="check-circle" size={20} color="#22c55e" />
                    <View style={styles.featureContent}>
                      <View style={styles.featureHeader}>
                        <Text style={styles.featureName}>{feature.name}</Text>
                        {feature.isNew && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>{t('journey.new') || 'NEW'}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.featureBenefit}>{feature.benefit}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {currentDay < totalDays && nextFeature && (
              <View style={styles.nextUnlockCard}>
                <Text style={styles.nextUnlockLabel}>{t('journey.nextUnlock')}</Text>
                <Text style={styles.nextUnlockTitle}>
                  {language === 'zh'
                    ? `${nextFeature.name} — 还需记录 ${daysUntilUnlock} 天`
                    : `${nextFeature.name} — ${t('journey.logMoreDays', { count: daysUntilUnlock }) || `Log on ${daysUntilUnlock} more distinct days`}`}
                </Text>
                <Text style={styles.nextUnlockText}>
                  {language === 'zh'
                    ? `${t('journey.logged')} ${currentDay}/${nextFeature.day}`
                    : `${t('journey.logged')} ${currentDay} of ${nextFeature.day}`}
                </Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('journey.todayPlan') || "Today's plan"}</Text>
              <View style={styles.tasksList}>
                {todayTasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    onPress={task.action}
                    style={styles.taskItemRow}
                    activeOpacity={0.7}
                  >
                    <View style={styles.taskLabelBox}>
                      <Text style={[styles.taskLabel, { color: '#e5e7eb' }]}>{task.label}</Text>
                      <Text style={[styles.taskSubLabel, { color: '#9ca3af' }]}>
                        {task.completed ? t('common.done') : task.statusText || t('common.notStarted')}
                      </Text>
                    </View>
                    <View style={styles.taskRight}>
                      <View style={[styles.statusPill, task.completed && styles.statusPillDone]}>
                        <Text style={[styles.statusPillText, task.completed && styles.statusPillTextDone]}>
                          {task.completed ? t('common.done') : task.statusText || t('common.notStarted')}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color="#9ca3af" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={onPrimaryCTA}
              style={styles.primaryButton}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>{primaryCTALabel}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    paddingTop: 40,
  },
  safeAreaContainer: {
    width: '100%',
    maxHeight: '90%',
  },
  container: {
    backgroundColor: '#1a2332',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    maxHeight: '90%',
    width: '100%',
  },
  scrollView: {
    maxHeight: 650,
  },
  content: {
    padding: 12,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#e5e7eb',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f1a29',
    borderWidth: 1,
    borderColor: '#2a3441',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(250,204,21,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.4)',
  },
  badgeButtonText: { color: '#facc15', fontWeight: '700', fontSize: 12 },
  progressCard: {
    backgroundColor: 'rgba(37, 99, 235, 0.4)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.5)',
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: '500',
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressCircle: {
    width: 80,
    height: 80,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  progressCircleText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleDay: {
    fontSize: 10,
    color: '#93c5fd',
    fontWeight: '500',
  },
  progressCirclePercent: {
    fontSize: 10,
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#0f1a29',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  progressNote: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
  section: {
    marginBottom: 16,
  },
  tasksList: { gap: 8 },
  taskItemRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
  },
  taskLabelBox: { flexDirection: 'column', gap: 2, flex: 1 },
  taskLabel: { fontSize: 14, fontWeight: '600' },
  taskSubLabel: { fontSize: 12 },
  taskRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    backgroundColor: 'rgba(148,163,184,0.1)',
  },
  statusPillDone: {
    borderColor: 'rgba(34,197,94,0.6)',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  statusPillText: { color: '#e5e7eb', fontSize: 12, fontWeight: '600' },
  statusPillTextDone: { color: '#22c55e' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  streakText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  featuresList: {
    backgroundColor: '#0f1a29',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a3441',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  featureName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 999,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  featureBenefit: {
    fontSize: 12,
    color: '#9ca3af',
  },
  nextUnlockCard: {
    backgroundColor: 'rgba(147, 51, 234, 0.3)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(147, 51, 234, 0.3)',
    marginBottom: 16,
  },
  nextUnlockLabel: {
    fontSize: 14,
    color: '#a78bfa',
    fontWeight: '500',
    marginBottom: 4,
  },
  nextUnlockTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  nextUnlockText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  tasksList: {
    gap: 8,
  },
  taskItem: {
    backgroundColor: '#0f1a29',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  taskLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  taskLabelCompleted: {
    color: '#9ca3af',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#22c55e',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
});

