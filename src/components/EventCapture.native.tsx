import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext.native';
import { useTheme } from '../contexts/ThemeContext.native';
import { useLanguage } from '../contexts/LanguageContext.native';
import { getThemeColors } from '../lib/themeColors';
import { EMOTIONS_GROUPED, COLOR_PALETTE, getEmotionEmoji, getSuggestedColorForEmotion } from '../lib/emotions';
import { useGameState } from '../hooks/useGameState';
import { JourneyMiniStatus } from './JourneyMiniStatus.native';
import { JourneyDetailsSheet } from './JourneyDetailsSheet.native';
import { DailyReflections } from './DailyReflections.native';
import { BadgeGallery } from './BadgeGallery.native';
import { createEventWithAttachments } from '../lib/firebaseWrites.native';
import { awardXpOnce, ensureStatsDoc, getCurrentDateKey, LEVEL_THRESHOLDS } from '../lib/game';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  orderBy,
  query,
  limit,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const SUGGESTED_TAGS = ['work', 'family', 'celebration', 'conflict', 'milestone', 'support', 'stress', 'achievement'];

const RELATIONSHIP_TYPES = [
  { value: 'partner', key: 'relationship.partner' },
  { value: 'family', key: 'relationship.family' },
  { value: 'friend', key: 'relationship.friend' },
  { value: 'work', key: 'relationship.work' },
  { value: 'other', key: 'relationship.other' },
];

type NewContactData = {
  name: string;
  relationship_type: string;
};

type UploadedFile = {
  uri: string;
  fileName: string;
  fileSize: number;
  type: string;
};

type Contact = {
  id: string;
  name: string;
  relationship_type?: string;
};

type DailyQuestProgress = any;
type Profile = any;

type EventCaptureProps = {
  onNavigate?: (screen: 'capture' | 'timeline' | 'patterns' | 'settings', options?: { scrollToReflections?: boolean }) => void;
  scrollToReflections?: boolean;
  onScrollComplete?: () => void;
};

export function EventCapture({ onNavigate, scrollToReflections, onScrollComplete }: EventCaptureProps = {}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { resolvedTheme } = useTheme();
  const colors = getThemeColors(resolvedTheme === 'light');
  const isLight = resolvedTheme === 'light';
  const { stats } = useGameState();
  const scrollViewRef = useRef<ScrollView>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [showNewContact, setShowNewContact] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [newContact, setNewContact] = useState<NewContactData>({ name: '', relationship_type: 'friend' });

  const [whatHappened, setWhatHappened] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState('');
  const [emotionIntensity, setEmotionIntensity] = useState(3);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0].hex);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showEmotionModal, setShowEmotionModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showColorMeanings, setShowColorMeanings] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [questProgress, setQuestProgress] = useState<DailyQuestProgress | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lastSavedMomentId, setLastSavedMomentId] = useState<string>('');
  const [distinctDays, setDistinctDays] = useState(0);
  const [completedReflections, setCompletedReflections] = useState(0);
  const [viewedPatternsToday, setViewedPatternsToday] = useState(false);
  const [showBadgeGallery, setShowBadgeGallery] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadContacts();
      loadRecentTags();
      loadQuestData();
      checkOnboardingVisibility();
      loadBadgeCount();
    }
  }, [user]);

  useEffect(() => {
    if (scrollToReflections && lastSavedMomentId) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
        if (onScrollComplete) {
          onScrollComplete();
        }
      }, 300);
    }
  }, [scrollToReflections, lastSavedMomentId, onScrollComplete]);

  const checkOnboardingVisibility = async () => {
    if (!user) return;
    const hasSeenOnboarding = await AsyncStorage.getItem('mirror_onboarding_seen');
    if (hasSeenOnboarding) {
      setShowOnboarding(false);
      return;
    }
    try {
      const uid = user.uid;
      const snap = await getDocs(query(collection(db, 'users', uid, 'events'), limit(3)));
      if (snap.size >= 3) {
        await AsyncStorage.setItem('mirror_onboarding_seen', 'true');
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.error('checkOnboardingVisibility failed', err);
      setShowOnboarding(true);
    }
  };

  const loadQuestData = async () => {
    if (!user) return;
    try {
      const uid = user.uid;
      const eventsSnap = await getDocs(collection(db, 'users', uid, 'events'));
      const todayKey = new Date().toISOString().split('T')[0];
      const reflectionsDocRef = doc(db, 'users', uid, 'daily_reflections', todayKey);
      const todayRefSnap = await getDoc(reflectionsDocRef);
      const todayData: any = todayRefSnap.exists() ? todayRefSnap.data() : {};
      const answeredCount =
        (todayData?.support_answer ? 1 : 0) +
        (todayData?.reframe_answer ? 1 : 0) +
        (todayData?.boundary_answer ? 1 : 0);
      const reflectionsCompleted = todayData?.completed || answeredCount >= 3;

      const dates = new Set<string>();
      let todayLogged = false;
      eventsSnap.docs.forEach((d) => {
        const data = d.data();
        const start = data.startAt?.toDate ? data.startAt.toDate() : data.startAt ? new Date(data.startAt) : null;
        if (start) {
          const key = start.toISOString().split('T')[0];
          dates.add(key);
          if (key === todayKey) todayLogged = true;
        }
      });
      setDistinctDays(dates.size);
      setCompletedReflections(answeredCount);

      const viewedDate = await AsyncStorage.getItem('patterns_viewed_date');
      const viewedToday = viewedDate === todayKey;
      setViewedPatternsToday(viewedToday);

      setQuestProgress({
        quest_logged_moment: todayLogged,
        quest_answered_reflection: reflectionsCompleted,
        quest_added_detail: false,
      });
      setProfile({ reflection_style: 'guided' });
    } catch (err) {
      console.error('loadQuestData failed', err);
      setQuestProgress(null);
      setProfile(null);
      setDistinctDays(0);
      setCompletedReflections(0);
    }
  };

  const loadBadgeCount = async () => {
    if (!user) {
      setBadgeCount(0);
      return;
    }
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'badges'));
      setBadgeCount(snap.docs.filter((d) => d.data()?.earned).length);
    } catch (err) {
      console.error('loadBadgeCount failed', err);
      setBadgeCount(0);
    }
  };

  const loadContacts = async () => {
    if (!user) {
      setContacts([]);
      return;
    }
    try {
      const uid = user.uid;
      const snap = await getDocs(query(collection(db, 'users', uid, 'contacts'), orderBy('name')));
      const list: Contact[] = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || '',
        relationship_type: d.data().relationship_type || 'other',
      }));
      setContacts(list);
    } catch (err) {
      console.error('loadContacts failed', err);
      setContacts([]);
    }
  };

  const loadRecentTags = async () => {
    if (!user) {
      setRecentTags([]);
      return;
    }
    try {
      const uid = user.uid;
      const snap = await getDocs(query(collection(db, 'users', uid, 'events'), orderBy('startAt', 'desc'), limit(50)));
      const tagSet = new Set<string>();
      snap.docs.forEach((d) => {
        const tags: string[] = d.data().tags || [];
        tags.forEach((t) => tagSet.add(t));
      });
      setRecentTags(Array.from(tagSet).slice(0, 10));
    } catch (err) {
      console.error('loadRecentTags failed', err);
      setRecentTags([]);
    }
  };

  const dismissOnboarding = async () => {
    await AsyncStorage.setItem('mirror_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newFiles: UploadedFile[] = result.assets.map(asset => ({
        uri: asset.uri,
        fileName: asset.fileName || `image_${Date.now()}.jpg`,
        fileSize: asset.fileSize || 0,
        type: asset.type || 'image',
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddContact = async () => {
    if (!user || !newContact.name.trim()) return;
    try {
      const uid = user.uid;
      const ref = await addDoc(collection(db, 'users', uid, 'contacts'), {
        name: newContact.name.trim(),
        relationship_type: newContact.relationship_type,
        createdAt: new Date(),
      });
      const created = {
        id: ref.id,
        name: newContact.name.trim(),
        relationship_type: newContact.relationship_type,
      };
      setContacts([...contacts, created]);
      setSelectedContactId(ref.id);
      setShowNewContact(false);
      setShowContactPicker(false);
      setNewContact({ name: '', relationship_type: 'friend' });
    } catch (err) {
      console.error('handleAddContact failed', err);
      Alert.alert('Error', 'Could not add contact. Please try again.');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!user) return;

    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const ref = doc(db, 'users', user.uid, 'contacts', contactId);
              await deleteDoc(ref);
            } catch (err) {
              console.error('delete contact failed', err);
              Alert.alert('Error', 'Could not delete contact. Please try again.');
              return;
            }
            setContacts((prev) => prev.filter(c => c.id !== contactId));
            if (selectedContactId === contactId) {
              setSelectedContactId('');
            }
            // Refresh from Firestore to ensure it does not reappear on reopen
            loadContacts();
          },
        },
      ]
    );
  };

  const handleAddTag = (tag?: string) => {
    const tagToAdd = tag || tagInput.trim();
    if (tagToAdd && !tags.includes(tagToAdd)) {
      setTags([...tags, tagToAdd]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const getSuggestedTags = () => {
    const combined = [...new Set([...SUGGESTED_TAGS, ...recentTags])];
    if (!tagInput.trim()) return combined;
    return combined.filter(tag =>
      tag.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(tag)
    );
  };

  const handleSubmit = async () => {
    if (!user || !selectedContactId || !whatHappened.trim() || !selectedEmotion) return;

    setLoading(true);

    const normalizeAttachments = () => {
      return uploadedFiles.map((file) => {
        const name = file.fileName || file.uri.split('/').pop() || `file_${Date.now()}`;
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const isImage = (file.type || '').toLowerCase().includes('image') || ['jpg','jpeg','png','heic','webp'].includes(ext);
        const isVideo = (file.type || '').toLowerCase().includes('video') || ['mp4','mov','m4v'].includes(ext);
        const contentType =
          file.type?.includes('/') ? file.type :
          isImage ? `image/${ext || 'jpeg'}` :
          isVideo ? 'video/mp4' :
          'application/octet-stream';
        const mappedType: 'image' | 'video' | 'audio' | 'file' =
          isImage ? 'image' : isVideo ? 'video' : 'file';
        return {
          uri: file.uri,
          fileName: name,
          contentType,
          type: mappedType,
        };
      });
    };

    try {
      const { eventId } = await createEventWithAttachments({
        title: whatHappened.trim(),
        description: notes.trim() || null,
        startAt: new Date(),
        timezone: 'America/Los_Angeles',
        moodColor: selectedColor || null,
        primaryEmotion: selectedEmotion || null,
        emotionIntensity: emotionIntensity || null,
        tags,
        contactIds: [selectedContactId],
        attachments: normalizeAttachments(),
      });

      if (user) {
        await ensureStatsDoc(user.uid);
        const statsRef = doc(db, 'users', user.uid, 'stats', 'main');
        await updateDoc(statsRef, {
          momentsCount: increment(1),
          lastMomentAt: serverTimestamp(),
        });
        await awardXpOnce(user.uid, `MOMENT_COMPLETED_${eventId}`, 10, { eventId, dateKey: getCurrentDateKey() });
        const depthSignals =
          (tags?.length || 0) +
          (notes ? 1 : 0) +
          (emotionIntensity ? 1 : 0) +
          (uploadedFiles.length ? 1 : 0);
        if (depthSignals >= 2) {
          await awardXpOnce(user.uid, `DEPTH_BONUS_${eventId}`, 5, { eventId });
        }
      }

      setLastSavedMomentId(eventId);
      setSuccess(true);
      setSelectedContactId('');
      setWhatHappened('');
      setSelectedEmotion('');
      setEmotionIntensity(3);
      setSelectedColor(COLOR_PALETTE[0].hex);
      setTags([]);
      setNotes('');
      setUploadedFiles([]);

      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error submitting event:', error);
      Alert.alert('Error', 'Failed to save your moment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = selectedContactId && whatHappened.trim() && selectedEmotion;

  const getButtonText = () => {
    if (loading) return t('capture.saving');

    if (!questProgress || !profile || profile.reflection_style === 'free') {
      return t('capture.save');
    }

    const hasLoggedMoment = questProgress.quest_logged_moment;

    if (!hasLoggedMoment) {
      return 'Log today\'s moment';
    }

    if (profile.streak_count > 0) {
      return `Continue ${profile.streak_count}-day streak`;
    }

    return t('capture.save');
  };

  // Safety check - log all components before render
  const componentCheck = {
    JourneyMiniStatus: typeof JourneyMiniStatus,
    JourneyDetailsSheet: typeof JourneyDetailsSheet,
    DailyReflections: typeof DailyReflections,
    Slider: typeof Slider,
    Feather: typeof Feather,
    SafeAreaView: typeof SafeAreaView,
    ScrollView: typeof ScrollView,
    View: typeof View,
    Text: typeof Text,
    TouchableOpacity: typeof TouchableOpacity,
    EMOTIONS_GROUPED: typeof EMOTIONS_GROUPED,
  };
  console.log("EventCapture component check:", componentCheck);
  
  // Check for undefined components
  const undefinedComponents = Object.entries(componentCheck)
    .filter(([_, type]) => type === 'undefined')
    .map(([name]) => name);
  
  if (undefinedComponents.length > 0) {
    console.error("UNDEFINED COMPONENTS FOUND:", undefinedComponents);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 20 }}>
        <Text style={{ color: 'red', fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
          ERROR: Undefined Components
        </Text>
        <Text style={{ color: '#f87171', fontSize: 14 }}>
          {undefinedComponents.join(', ')}
        </Text>
      </View>
    );
  }

  // Check if EMOTIONS_GROUPED is defined
  if (!EMOTIONS_GROUPED || typeof EMOTIONS_GROUPED === 'undefined') {
    console.error("CRITICAL: EMOTIONS_GROUPED is undefined!");
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 20 }}>
        <Text style={{ color: 'red', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>ERROR: EMOTIONS_GROUPED is undefined</Text>
        <Text style={{ color: '#f87171', fontSize: 14 }}>Check emotions.ts export</Text>
      </View>
    );
  }

  const closeAllModals = () => {
    setIsProgressModalOpen(false);
    setIsLevelModalOpen(false);
    setShowBadgeGallery(false);
  };

  const openProgressModal = () => {
    setIsLevelModalOpen(false);
    setIsProgressModalOpen(true);
  };

  const openLevelModal = () => {
    setIsProgressModalOpen(false);
    setIsLevelModalOpen(true);
  };

  const translateLevelName = (name?: string | null) => {
    const key = name ? `levels.${name.toLowerCase()}` : 'levels.explorer';
    const localized = t(key);
    return localized === key ? (name || t('levels.explorer')) : localized;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressHeader}>
          <TouchableOpacity
            style={[styles.dayCard, isLight && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.85}
            onPress={openProgressModal}
          >
            <View style={styles.cardRow}>
              <Text style={[styles.dayTitle, isLight && { color: colors.text }]}>
                {language === 'zh'
                  ? `第${stats?.journeyDay ?? 0}/7 天`
                  : `${t('journey.dayLabel') || 'Day'} ${stats?.journeyDay ?? 0}/7`}
              </Text>
              <View style={styles.viewDetails}>
              <Text style={[styles.viewDetailsText, isLight && { color: colors.accent }]}>{t('capture.viewDetails')}</Text>
                <Feather name="chevron-right" size={16} color="#93c5fd" />
              </View>
            </View>
            <Text style={[styles.daySubtitle, isLight && { color: colors.textSecondary }]}>{t('capture.nextUnlock')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.journeyCard, isLight && { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.85}
            onPress={openLevelModal}
          >
            <View style={styles.cardRow}>
              <View style={styles.journeyTitleRow}>
                <Feather name="trending-up" size={16} color="#93c5fd" />
                <Text style={[styles.journeyTitleText, isLight && { color: colors.text }]}>{t('capture.levelBadges')}</Text>
              </View>
              <View style={styles.journeyPillColumn}>
                <TouchableOpacity
                  style={[
                    styles.pillBase,
                    styles.pillWide,
                    isLight && { backgroundColor: colors.inputBackground, borderColor: colors.border },
                  ]}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    openLevelModal();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.badgeEarnedText, isLight && { color: colors.text }]}>
                    {`${t('badge.badges') || 'Badges'} ${badgeCount}/12`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.journeyLevelRow}>
              <Text style={[styles.journeyLevelText, isLight && { color: colors.text }]} numberOfLines={1}>
                {`${t('journey.level') || 'Level'} ${stats?.level ?? 1} · ${translateLevelName(stats?.levelName)} · ${stats?.allTimeXP ?? 0} XP`}
              </Text>
              <TouchableOpacity
                style={[
                  styles.pillBase,
                  styles.pillWide,
                  styles.statPill,
                  isLight && { backgroundColor: colors.inputBackground, borderColor: colors.border },
                ]}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  openLevelModal();
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.statPillText, isLight && { color: colors.text }]}>
                  {`${t('capture.weeklyXP')} ${stats?.weeklyXP ?? 0} XP`}
                </Text>
                <Feather name="chevron-right" size={16} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>

        {lastSavedMomentId && (
          <View style={styles.dailyReflectionsContainer}>
            <DailyReflections
              momentId={lastSavedMomentId}
              onComplete={() => {}}
            />
          </View>
        )}

        {showOnboarding && (
          <View style={styles.onboardingCard}>
            <View style={styles.onboardingHeader}>
              <View style={styles.onboardingTitleRow}>
                <Feather name="info" size={20} color="#60a5fa" />
                <Text style={styles.onboardingTitle}>{t('capture.quickGuide')}</Text>
              </View>
              <TouchableOpacity onPress={dismissOnboarding}>
                <Feather name="x" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <Text style={styles.onboardingText}>
              <Text style={styles.onboardingBold}>{t('capture.personLabel')}</Text> {t('capture.selectPerson')}{'\n'}
              <Text style={styles.onboardingBold}>{t('capture.whatLabel')}</Text> {t('capture.whatPlaceholder')}{'\n'}
              <Text style={styles.onboardingBold}>{t('capture.feelLabel')}</Text> {t('capture.feel')}{'\n'}
              <Text style={styles.onboardingBold}>{t('capture.tagsLabel')}</Text> {t('capture.tags')}
            </Text>
            <TouchableOpacity onPress={dismissOnboarding} style={styles.dismissButton}>
              <Text style={styles.dismissButtonText}>{t('capture.dontShowAgain')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.header}>
          <Feather name="zap" size={20} color="#60a5fa" />
          <Text style={[styles.title, { color: colors.text }]}>{t('capture.title')}</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('capture.subtitle')}</Text>

        <View style={styles.divider} />

        {/* Contact Selection */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.text }]}>{t('capture.who')}</Text>
            <Text style={styles.required}>*</Text>
          </View>

          {!showNewContact ? (
            <View>
              <TouchableOpacity
                onPress={() => setShowContactPicker(!showContactPicker)}
                style={[
                  styles.contactPickerButton,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    shadowColor: '#000',
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 3,
                  },
                ]}
              >
                <Text style={[styles.contactPickerText, { color: colors.text }, !selectedContactId && { color: colors.textTertiary }]}>
                  {selectedContactId
                    ? contacts.find(c => c.id === selectedContactId)?.name || t('capture.selectPerson')
                    : t('capture.selectPerson')}
                </Text>
                <Feather name={showContactPicker ? "chevron-up" : "chevron-down"} size={20} color={colors.textTertiary} />
              </TouchableOpacity>

              {showContactPicker && (
                <View
                  style={[
                    styles.contactPickerDropdown,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      shadowColor: '#000',
                      shadowOpacity: 0.18,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 10 },
                      elevation: 6,
                    },
                  ]}
                >
                  <ScrollView style={styles.contactPickerList} nestedScrollEnabled>
                    {contacts.map((contact) => (
                      <TouchableOpacity
                        key={contact.id}
                        onPress={() => {
                          setSelectedContactId(contact.id);
                          setShowContactPicker(false);
                        }}
                        style={[
                          styles.contactPickerItem,
                          { borderBottomColor: colors.border },
                          selectedContactId === contact.id && { backgroundColor: colors.backgroundSecondary },
                        ]}
                      >
                        <View style={styles.contactPickerItemContent}>
                          <Text style={[styles.contactPickerItemText, { color: colors.text }]}>
                            {contact.name} ({t(`relationship.${contact.relationship_type}`)})
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteContact(contact.id)}
                          style={styles.deleteContactButton}
                        >
                          <Feather name="trash-2" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity
                onPress={() => setShowNewContact(true)}
                style={styles.addContactButton}
              >
                <Feather name="user-plus" size={16} color="#60a5fa" />
                <Text style={styles.addContactText}>{t('capture.addNewPerson')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.newContactCard, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <TextInput
                value={newContact.name}
                onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                placeholder={t('contact.name')}
                placeholderTextColor={colors.textTertiary}
                style={[styles.newContactInput, { backgroundColor: colors.background, borderColor: colors.inputBorder, color: colors.text }]}
              />

              <Text style={[styles.label, { color: colors.text }]}>{t('relationship.type') || 'Relationship type'}</Text>
              <View style={styles.relChipsRow}>
                {RELATIONSHIP_TYPES.map((type) => {
                  const selected = newContact.relationship_type === type.value;
                  return (
                    <TouchableOpacity
                      key={type.value}
                      onPress={() => setNewContact({ ...newContact, relationship_type: type.value })}
                      style={[
                        styles.relChip,
                        selected && styles.relChipSelected,
                        { borderColor: selected ? '#3b82f6' : colors.inputBorder, backgroundColor: selected ? 'rgba(59,130,246,0.12)' : colors.inputBackground },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.relChipText, { color: selected ? '#3b82f6' : colors.text }]}>{t(type.key)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.newContactActions}>
                <TouchableOpacity
                  onPress={handleAddContact}
                  style={styles.addButton}
                >
                  <Text style={styles.addButtonText}>{t('contact.addPerson')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowNewContact(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>{t('settings.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* What Happened */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.text }]}>{t('capture.what')}</Text>
            <Text style={styles.required}>*</Text>
          </View>
          <TextInput
            value={whatHappened}
            onChangeText={setWhatHappened}
            placeholder={t('capture.whatPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
            textAlignVertical="top"
          />

          <View style={styles.uploadSection}>
            {uploadedFiles.length === 0 ? (
              <TouchableOpacity
                onPress={handlePickImage}
                style={styles.uploadButton}
              >
                <Feather name="upload" size={16} color={colors.textTertiary} />
              <Text style={[styles.uploadButtonText, { color: colors.textTertiary }]}>{t('capture.attach')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={styles.uploadButton}
                >
                  <Feather name="upload" size={16} color="#9ca3af" />
                  <Text style={styles.uploadButtonText}>{t('capture.attach')}</Text>
                </TouchableOpacity>

                {uploadedFiles.length > 0 && (
                  <View style={styles.filesList}>
                    {uploadedFiles.map((file, index) => (
                      <View key={index} style={[styles.fileItem, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                        {file.type === 'image' ? (
                          <Image source={{ uri: file.uri }} style={styles.filePreview} />
                        ) : (
                          <View style={[styles.fileIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                            <Feather name="file-text" size={24} color={colors.textTertiary} />
                          </View>
                        )}
                        <View style={styles.fileInfo}>
                          <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{file.fileName}</Text>
                          <Text style={[styles.fileSize, { color: colors.textTertiary }]}>
                            {(file.fileSize / 1024).toFixed(1)} KB
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveFile(index)}
                          style={styles.removeFileButton}
                        >
                          <Feather name="x" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Emotions - compact quick pick */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.text }]}>{t('capture.feel')}</Text>
            <Text style={styles.required}>*</Text>
          </View>

          <View style={styles.quickEmotionRow}>
            {['happy', 'loved', 'calm', 'neutral', 'sad', 'angry', 'anxious'].map((val) => {
              const isSelected = selectedEmotion === val;
              return (
                <TouchableOpacity
                  key={val}
                  onPress={() => {
                    setSelectedEmotion(val);
                    setSelectedColor(getSuggestedColorForEmotion(val));
                  }}
                  style={[
                    styles.quickEmotionChip,
                    { borderColor: isSelected ? '#3b82f6' : colors.inputBorder, backgroundColor: isSelected ? '#1f2937' : colors.inputBackground },
                  ]}
                >
                  <Text style={styles.emotionEmoji}>{getEmotionEmoji(val)}</Text>
                  <Text style={[styles.quickEmotionLabel, { color: colors.text }]}>{t(`emotion.${val}`)}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setShowEmotionModal(true)}
              style={[styles.moreEmotionChip, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}
            >
              <Feather name="more-horizontal" size={18} color={colors.textTertiary} />
              <Text style={[styles.quickEmotionLabel, { color: colors.textTertiary }]}>{t('capture.moreEmotions') || 'More'}</Text>
            </TouchableOpacity>
          </View>

          {selectedEmotion && (
            <View style={styles.intensityContainer}>
              <Text style={[styles.intensityLabel, { color: colors.textSecondary }]}>
                {t('patterns.avgIntensity')}: {emotionIntensity}/5
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={5}
                step={1}
                value={emotionIntensity}
                onValueChange={setEmotionIntensity}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor={colors.border}
                thumbTintColor="#3b82f6"
              />
            </View>
          )}
        </View>

        {/* Color Picker */}
        <View style={styles.section}>
          <View style={styles.colorHeader}>
            <View style={styles.colorHeaderLeft}>
              <Feather name="edit" size={16} color={colors.textTertiary} />
              <Text style={[styles.colorHeaderText, { color: colors.text }]}>{t('capture.chooseColor')}</Text>
              <Text style={[styles.optional, { color: colors.textTertiary }]}>{t('capture.optional')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowColorMeanings(!showColorMeanings)}
              style={styles.infoButton}
            >
              <Feather name="info" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {showColorMeanings && (
            <View style={[styles.colorMeaningsCard, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <Text style={[styles.colorMeaningsTitle, { color: colors.text }]}>{t('capture.colorMeanings')}</Text>
              <View style={styles.colorMeaningsList}>
                {COLOR_PALETTE.map((color) => (
                  <View key={color.hex} style={styles.colorMeaningItem}>
                    <View style={[styles.colorSwatch, { backgroundColor: color.hex }]} />
                    <View style={styles.colorMeaningText}>
                      <Text style={[styles.colorName, { color: color.hex }]}>
                        {t(`colors.${color.name.toLowerCase()}`) || color.name}:
                      </Text>
                      <Text style={[styles.colorMeaning, { color: colors.textSecondary }]}>
                        {t(`colors.meaning.${color.name.toLowerCase()}`) || color.meaning}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.colorHelpText}>
            <Feather name="help-circle" size={16} color={colors.textTertiary} />
            <Text style={[styles.colorHelpTextContent, { color: colors.textSecondary }]}>
              {t('capture.colorHelp')}
            </Text>
          </View>

          {selectedColor && (
            <View style={[styles.selectedColorCard, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <View style={[styles.selectedColorSwatch, { backgroundColor: selectedColor }]} />
              <View>
                <Text style={[styles.selectedColorName, { color: colors.text }]}>
                  {(() => {
                    const meta = COLOR_PALETTE.find(c => c.hex === selectedColor);
                    if (!meta) return '';
                    return t(`colors.${meta.name.toLowerCase()}`) || meta.name;
                  })()}
                </Text>
                <Text style={[styles.selectedColorMeaning, { color: colors.textSecondary }]}>
                  {(() => {
                    const meta = COLOR_PALETTE.find(c => c.hex === selectedColor);
                    if (!meta) return '';
                    return t(`colors.meaning.${meta.name.toLowerCase()}`) || meta.meaning;
                  })()}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.colorGrid}>
            {COLOR_PALETTE.map((color) => (
              <TouchableOpacity
                key={color.hex}
                onPress={() => setSelectedColor(color.hex)}
                style={[
                  styles.colorButton,
                  selectedColor === color.hex && styles.colorButtonSelected,
                  { backgroundColor: color.hex }
                ]}
              />
            ))}
          </View>
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.text }]}>{t('capture.tags')}</Text>
            <Text style={[styles.optional, { color: colors.textTertiary }]}>{t('capture.tagsOptional')}</Text>
          </View>

          <View style={styles.tagHelpText}>
            <Feather name="help-circle" size={16} color={colors.textTertiary} />
            <Text style={[styles.tagHelpTextContent, { color: colors.textSecondary }]}>
              {t('capture.tagsHelp')}
            </Text>
          </View>

          <View style={styles.tagInputContainer}>
          <TextInput
            value={tagInput}
            onChangeText={setTagInput}
            onFocus={() => setShowTagSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
            onSubmitEditing={() => handleAddTag()}
            placeholder={t('capture.tagsPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            style={[styles.tagInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
          />

            {showTagSuggestions && getSuggestedTags().length > 0 && (
              <View style={[styles.tagSuggestions, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                {getSuggestedTags().slice(0, 8).map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => handleAddTag(tag)}
                    style={styles.tagSuggestionItem}
                  >
                    <Text style={[styles.tagSuggestionText, { color: colors.textSecondary }]}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.infoBackground, borderColor: colors.info }]}>
                  <Text style={[styles.tagText, { color: colors.info }]}>{tag}</Text>
                  <TouchableOpacity onPress={() => handleRemoveTag(tag)}>
                    <Feather name="x" size={14} color={colors.info} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          {!showNotes ? (
            <TouchableOpacity
              onPress={() => setShowNotes(true)}
              style={styles.addNotesButton}
            >
            <Text style={styles.addNotesText}>{t('capture.addDetails')}</Text>
            </TouchableOpacity>
          ) : (
            <View>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text }]}>{t('capture.notes')}</Text>
                <Text style={[styles.optional, { color: colors.textTertiary }]}>{t('capture.notesOptional')}</Text>
              </View>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('capture.notesPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                style={[styles.notesInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                textAlignVertical="top"
              />
            </View>
          )}
        </View>

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !isFormValid}
            style={[
              styles.submitButton,
              { backgroundColor: isFormValid ? selectedColor : '#3b82f6', opacity: isFormValid ? 1 : 0.6 }
            ]}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>{getButtonText()}</Text>
            )}
          </TouchableOpacity>

          {!isFormValid && (
            <View style={styles.warningCard}>
              <Feather name="info" size={16} color="#d97706" />
              <Text style={styles.warningText}>
                {t('capture.requiredFieldsWarning')}
              </Text>
            </View>
          )}

          {success && (
            <View style={styles.successCard}>
              <Feather name="check-circle" size={16} color="#22c55e" />
              <Text style={styles.successText}>{t('capture.success')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Emotion full sheet */}
      <Modal
        visible={showEmotionModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEmotionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('capture.chooseEmotion') || 'Choose emotion'}</Text>
              <TouchableOpacity onPress={() => setShowEmotionModal(false)}>
                <Feather name="x" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {(['positive', 'neutral', 'negative'] as const).map((cat) => (
                <View key={cat} style={styles.emotionCategory}>
                  <View style={styles.categoryHeader}>
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: cat === 'positive' ? '#4ade80' : cat === 'neutral' ? '#9ca3af' : '#f87171' },
                      ]}
                    />
                    <Text style={[styles.categoryLabel, { color: colors.textTertiary }]}>{cat.toUpperCase()}</Text>
                  </View>
                  <View style={styles.emotionGrid}>
                    {(EMOTIONS_GROUPED?.[cat] || []).map((emotion) => {
                      const isSelected = selectedEmotion === emotion.value;
                      return (
                        <TouchableOpacity
                          key={emotion.value}
                          onPress={() => {
                            setSelectedEmotion(emotion.value);
                            setSelectedColor(getSuggestedColorForEmotion(emotion.value));
                            setShowEmotionModal(false);
                          }}
                          style={[
                            styles.emotionButton,
                            isSelected && styles.emotionButtonSelected,
                            { backgroundColor: isSelected ? '#1f2937' : colors.card, borderColor: isSelected ? '#3b82f6' : colors.inputBorder },
                          ]}
                        >
                          <Text style={styles.emotionEmoji}>{emotion.emoji}</Text>
                          <Text style={[styles.emotionLabel, { color: colors.textTertiary }, isSelected && [styles.emotionLabelSelected, { color: colors.text }]]}>
                            {t(`emotion.${emotion.value}`)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* #region agent log */}
      {/* debug hook placeholder */}
      {/* #endregion */}
      <JourneyDetailsSheet
        isOpen={isProgressModalOpen}
        onClose={closeAllModals}
        title={t('journey.progressTitle')}
        currentDay={distinctDays}
        totalDays={7}
        nextUnlock={distinctDays < 7 ? t('journey.nextUnlock') : ''}
        daysUntilUnlock={Math.max(0, 7 - distinctDays)}
        todayTasks={[
          {
            id: 'log-moment',
            label: t('journey.task.logMoment'),
            completed: distinctDays > 0,
            statusText: distinctDays > 0 ? t('common.done') : t('common.notStarted'),
            action: () => {
              closeAllModals();
            },
          },
          {
            id: 'answer-reflections',
            label: t('journey.task.answerReflections'),
            completed: completedReflections >= 3,
            statusText: completedReflections >= 3 ? t('common.done') : `${completedReflections}/3`,
            action: () => {
              closeAllModals();
              onNavigate?.('patterns', { scrollToReflections: true });
            },
          },
          {
            id: 'review-patterns',
            label: t('journey.task.reviewPatterns'),
            completed: viewedPatternsToday,
            statusText: viewedPatternsToday ? t('common.done') : t('common.available'),
            action: () => {
              const today = new Date().toISOString().split('T')[0];
              AsyncStorage.setItem('patterns_viewed_date', today);
              setViewedPatternsToday(true);
              closeAllModals();
              onNavigate?.('patterns');
            },
          },
        ]}
        onPrimaryCTA={() => {
          closeAllModals();
          if (completedReflections < 3) {
            onNavigate?.('patterns', { scrollToReflections: true });
          }
        }}
        primaryCTALabel={completedReflections < 3 ? t('journey.task.answerReflections') : t('journey.task.logMoment')}
        onNavigate={onNavigate}
      />

      <LevelBadgesModal
        isOpen={isLevelModalOpen}
        onClose={closeAllModals}
        level={stats?.level ?? 1}
        levelName={stats?.levelName || 'Explorer'}
        allTimeXP={stats?.allTimeXP ?? 0}
        weeklyXP={stats?.weeklyXP ?? 0}
        onOpenBadges={() => {
          closeAllModals();
          setShowBadgeGallery(true);
        }}
      />

      <BadgeGallery
        isOpen={showBadgeGallery}
        onClose={() => setShowBadgeGallery(false)}
        currentActiveBadgeId={stats?.activeBadgeId ?? null}
        onBadgeSelected={() => {}}
      />
    </SafeAreaView>
  );
}

type LevelBadgesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  level: number;
  levelName: string;
  allTimeXP: number;
  weeklyXP: number;
  onOpenBadges: () => void;
  nextBadge?: { name: string; icon: string; progressCurrent: number; progressTarget: number };
};

function LevelBadgesModal({ isOpen, onClose, level, levelName, allTimeXP, weeklyXP, onOpenBadges, nextBadge }: LevelBadgesModalProps) {
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const colors = getThemeColors(resolvedTheme === 'light');
  const isLight = resolvedTheme === 'light';
  const translateLevelName = (name?: string | null) => {
    const key = name ? `levels.${name.toLowerCase()}` : 'levels.explorer';
    const localized = t(key);
    return localized === key ? (name || t('levels.explorer')) : localized;
  };
  const currentMin = LEVEL_THRESHOLDS[Math.max(0, Math.min(level - 1, LEVEL_THRESHOLDS.length - 1))];
  const nextThreshold = LEVEL_THRESHOLDS[Math.min(level, LEVEL_THRESHOLDS.length - 1)];
  const isMaxLevel = level >= LEVEL_THRESHOLDS.length;
  const gainedThisLevel = Math.max(0, allTimeXP - currentMin);
  const neededThisLevel = Math.max(1, (isMaxLevel ? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] : nextThreshold) - currentMin);
  const progressPct = Math.min(1, gainedThisLevel / neededThisLevel);

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.levelModalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.levelModalSheet,
            isLight && { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.levelModalHeader}>
          <Text style={[styles.levelModalTitle, isLight && { color: colors.text }]}>{t('capture.levelBadgesTitle')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.levelCloseButton}>
              <Feather name="x" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.levelModalContent}>
            <View
              style={[
                styles.levelStatCard,
                isLight && { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.levelStatLabel, isLight && { color: colors.textSecondary }]}>{t('capture.currentLevel')}</Text>
              <Text style={[styles.levelStatValue, isLight && { color: colors.text }]}>{`${t('journey.level') || 'Level'} ${level} · ${translateLevelName(levelName)}`}</Text>
              <Text style={[styles.levelStatSub, isLight && { color: colors.textSecondary }]}>{`${allTimeXP} XP · ${weeklyXP} ${t('journey.thisWeek')}`}</Text>
              <View
                style={[
                  styles.levelProgressBar,
                  isLight && { backgroundColor: colors.inputBackground, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.levelProgressFill,
                    { width: `${progressPct * 100}%` },
                    isLight && { backgroundColor: colors.accent },
                  ]}
                />
              </View>
              <Text style={[styles.levelProgressText, isLight && { color: colors.textSecondary }]}>
                {isMaxLevel ? t('journey.maxLevel') : `${gainedThisLevel} / ${neededThisLevel} XP ${t('journey.nextLevel')}`}
              </Text>
            </View>

            <TouchableOpacity style={styles.levelPrimaryButton} onPress={onOpenBadges} activeOpacity={0.85}>
              <Feather name="award" size={16} color="#0b1220" />
              <Text style={styles.levelPrimaryButtonText}>{t('badge.gallery')}</Text>
              <Feather name="chevron-right" size={16} color="#0b1220" />
            </TouchableOpacity>

            {nextBadge && (
              <View
                style={[
                  styles.nextBadgeCard,
                  isLight && { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.nextBadgeHeader}>
                  <Text style={[styles.nextBadgeTitle, isLight && { color: colors.textSecondary }]}>{t('badge.unlocked') || 'Next badge'}</Text>
                  <Text style={styles.nextBadgeIcon}>{nextBadge.icon || '🎖️'}</Text>
                </View>
                <Text style={[styles.nextBadgeName, isLight && { color: colors.text }]}>{nextBadge.name}</Text>
                <View
                  style={[
                    styles.levelProgressBar,
                    isLight && { backgroundColor: colors.inputBackground, borderColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.levelProgressFill,
                      { width: `${Math.min(100, (nextBadge.progressCurrent / Math.max(1, nextBadge.progressTarget)) * 100)}%` },
                      { backgroundColor: '#fbbf24' },
                    ]}
                  />
                </View>
                <Text style={[styles.levelProgressText, isLight && { color: colors.textSecondary }]}>
                  {`${nextBadge.progressCurrent}/${nextBadge.progressTarget}`}
                </Text>
                <View style={styles.nextBadgeCTA}>
                  <Text style={[styles.nextBadgeCTAtext, isLight && { color: colors.accent }]}>{t('badge.earnBadges')}</Text>
                  <Feather name="chevron-right" size={16} color="#93c5fd" />
                </View>
              </View>
            )}

            <View
              style={[
                styles.xpBreakdown,
                isLight && { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.xpBreakdownTitle, isLight && { color: colors.text }]}>{t('xp.howWorks') || 'How XP works'}</Text>
              {[
                { label: t('xp.logMoment') || 'Log a moment', value: '+10 XP' },
                { label: t('xp.completeReflections') || 'Complete daily reflections', value: '+15 XP' },
                { label: t('xp.depthBonus') || 'Depth bonus (2+ details)', value: '+5 XP' },
                { label: t('xp.oncePerAction') || 'XP awarded once per action', value: '' },
              ].map((item, idx) => (
                <View key={idx} style={styles.xpRow}>
                  <Text style={[styles.xpRowLabel, isLight && { color: colors.textSecondary }]}>{item.label}</Text>
                  <Text style={[styles.xpRowValue, isLight && { color: colors.text }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 200,
  },
  progressHeader: { gap: 12, paddingHorizontal: 16, paddingTop: 8, marginBottom: 12 },
  dayCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    backgroundColor: 'rgba(37,99,235,0.12)',
    padding: 14,
    gap: 6,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTitle: { color: '#e5e7eb', fontSize: 16, fontWeight: '700' },
  daySubtitle: { color: '#93c5fd', fontSize: 12, marginTop: 2 },
  viewDetails: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewDetailsText: { color: '#93c5fd', fontWeight: '600' },
  journeyCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.3)', backgroundColor: '#111827', padding: 14, gap: 8 },
  journeyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journeyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  journeyTitleText: { color: '#e5e7eb', fontSize: 16, fontWeight: '700' },
  pillBase: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(148,163,184,0.5)', backgroundColor: 'rgba(148,163,184,0.12)' },
  badgeEarnedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(148,163,184,0.5)', backgroundColor: 'rgba(148,163,184,0.12)' },
  badgeEarnedText: { color: '#e5e7eb', fontSize: 12, fontWeight: '600', lineHeight: 16, minHeight: 16 },
  journeyLevelText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginTop: 2, flex: 1 },
  journeyPillColumn: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 6, minWidth: 150 },
  statPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(148,163,184,0.5)', backgroundColor: 'rgba(148,163,184,0.12)', minHeight: 32, justifyContent: 'center' },
  statPillText: { color: '#e5e7eb', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  pillWide: { minWidth: 140, justifyContent: 'center' },
  journeyLevelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  journeyStatusContainer: {
    marginBottom: 24,
  },
  levelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    paddingTop: 40,
  },
  levelModalSheet: {
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#1f2937',
  },
  levelModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  levelModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e5e7eb',
  },
  levelCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelModalContent: { gap: 12 },
  levelStatCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0f172a',
    padding: 14,
    gap: 6,
  },
  levelStatLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  levelStatValue: { color: '#e5e7eb', fontSize: 16, fontWeight: '700' },
  levelStatSub: { color: '#cbd5e1', fontSize: 12 },
  levelProgressBar: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#0b1220',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  levelProgressFill: { height: '100%', backgroundColor: '#3b82f6' },
  levelProgressText: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  levelPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fbbf24',
  },
  levelPrimaryButtonText: { color: '#0b1220', fontWeight: '700', fontSize: 14 },
  nextBadgeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0f172a',
    padding: 14,
    gap: 6,
  },
  nextBadgeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextBadgeTitle: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  nextBadgeIcon: { fontSize: 20 },
  nextBadgeName: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  nextBadgeCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  nextBadgeCTAtext: { color: '#93c5fd', fontWeight: '700', fontSize: 13 },
  xpBreakdown: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0f172a',
    padding: 12,
    gap: 8,
  },
  xpBreakdownTitle: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  xpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xpRowLabel: { color: '#cbd5e1', fontSize: 12 },
  xpRowValue: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },
  dailyReflectionsContainer: {
    marginBottom: 24,
  },
  onboardingCard: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  onboardingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  onboardingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onboardingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  onboardingText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  onboardingBold: {
    color: '#fff',
    fontWeight: '600',
  },
  dismissButton: {
    marginTop: 8,
  },
  dismissButtonText: {
    color: '#60a5fa',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  required: {
    color: '#ef4444',
    fontSize: 14,
  },
  optional: {
    fontSize: 12,
  },
  contactPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  contactPickerText: {
    color: '#f1f5f9',
    fontSize: 16,
    flex: 1,
  },
  contactPickerPlaceholder: {
    color: '#6b7280',
  },
  contactPickerDropdown: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 12,
    maxHeight: 220,
    overflow: 'hidden',
  },
  contactPickerList: {
    maxHeight: 220,
  },
  contactPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  contactPickerItemSelected: {
  },
  contactPickerItemContent: {
    flex: 1,
  },
  contactPickerItemText: {
    fontSize: 16,
  },
  deleteContactButton: {
    padding: 8,
    marginLeft: 8,
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addContactText: {
    color: '#60a5fa',
    fontSize: 14,
  },
  newContactCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  newContactInput: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  relChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  relChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  relChipSelected: {},
  relChipText: { fontSize: 14, fontWeight: '600' },
  newContactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 120,
    maxHeight: 120,
  },
  uploadSection: {
    marginTop: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadButtonText: {
    fontSize: 14,
  },
  filesList: {
    marginTop: 12,
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  filePreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 14,
  },
  fileSize: {
    fontSize: 12,
  },
  removeFileButton: {
    padding: 6,
  },
  emotionCategories: {
    gap: 16,
  },
  emotionCategory: {
    gap: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionButton: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    gap: 4,
  },
  emotionButtonSelected: {
    borderWidth: 2,
  },
  emotionEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  emotionLabel: {
    fontSize: 12,
  },
  emotionLabelSelected: {
    fontWeight: '500',
  },
  quickEmotionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickEmotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  moreEmotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickEmotionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  intensityContainer: {
    marginTop: 16,
    height: 52,
  },
  intensityLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  colorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorHeaderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoButton: {
    padding: 4,
  },
  colorMeaningsCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  colorMeaningsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  colorMeaningsList: {
    gap: 8,
  },
  colorMeaningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginTop: 2,
  },
  colorMeaningText: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  colorName: {
    fontSize: 12,
    fontWeight: '500',
  },
  colorMeaning: {
    fontSize: 12,
    marginLeft: 4,
  },
  colorHelpText: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  colorHelpTextContent: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  selectedColorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 68,
  },
  selectedColorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  selectedColorName: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectedColorMeaning: {
    fontSize: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  colorButton: {
    width: '30%',
    height: 40,
    borderRadius: 12,
  },
  colorButtonSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  tagHelpText: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  tagHelpTextContent: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  tagInputContainer: {
    position: 'relative',
  },
  tagInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  tagSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 192,
    zIndex: 10,
  },
  tagSuggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagSuggestionText: {
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 14,
  },
  addNotesButton: {
    marginTop: 8,
  },
  addNotesText: {
    color: '#60a5fa',
    fontSize: 14,
  },
  notesInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 96,
    maxHeight: 96,
  },
  submitSection: {
    marginTop: 24,
    marginBottom: 96,
  },
  submitButton: {
    width: '100%',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#b45309',
    lineHeight: 18,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    color: '#22c55e',
  },
});
