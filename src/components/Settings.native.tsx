import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext.native';
import { useTheme } from '../contexts/ThemeContext.native';
import { useLanguage } from '../contexts/LanguageContext.native';
import { getThemeColors } from '../lib/themeColors';
import { db } from '../firebase/firebaseConfig';

type Profile = {
  plan?: 'free' | 'premium';
  reflection_style?: 'guided' | 'free';
  daily_reminder_enabled?: boolean;
  daily_reminder_time?: string;
};

export function Settings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const colors = getThemeColors(resolvedTheme === 'light');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as Profile;
          setProfile(data);
          if (data.daily_reminder_time) setReminderTime(data.daily_reminder_time);
        } else {
          setProfile({ plan: 'free', reflection_style: 'guided', daily_reminder_enabled: false, daily_reminder_time: '09:00' });
        }
      } catch (err) {
        console.error('Load profile failed', err);
        setProfile({ plan: 'free', reflection_style: 'guided', daily_reminder_enabled: false, daily_reminder_time: '09:00' });
      }
      setLoading(false);
    };
    loadProfile();
  }, [user]);

  const saveProfilePatch = async (patch: Partial<Profile>) => {
    if (!user) return;
    setSaving(true);
    try {
      const ref = doc(db, 'users', user.uid);
      await setDoc(ref, patch, { merge: true });
      setProfile((prev) => ({ ...(prev || {}), ...patch }));
    } catch (err) {
      console.error('Save profile failed', err);
      Alert.alert('Error', 'Could not save settings. Please try again.');
    }
    setSaving(false);
  };

  const updatePlan = (plan: 'free' | 'premium') => {
    const reflection_style = plan === 'premium' ? 'guided' : 'free';
    saveProfilePatch({ plan, reflection_style });
  };

  const updateReminder = (enabled: boolean, time?: string) => {
    const newTime = time || reminderTime || '09:00';
    setReminderTime(newTime);
    saveProfilePatch({ daily_reminder_enabled: enabled, daily_reminder_time: newTime });
  };

  const handleExportData = () => {
    Alert.alert('Coming soon', 'Export will be available after Firebase data migration is complete.');
  };

  const handleDeleteAll = () => {
    Alert.alert('Coming soon', 'Delete all data will be available after Firebase data migration is complete.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('settings.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('settings.subtitle')}</Text>
        </View>

        {loading ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
            <ActivityIndicator color={colors.text} />
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{t('common.loading') || 'Loading...'}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.appearance')}</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() => setTheme('light')}
                  style={[styles.pill, theme === 'light' && styles.pillActive]}
                >
                  <Feather name="sun" size={16} color={theme === 'light' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.pillText, { color: theme === 'light' ? '#fff' : colors.textSecondary }]}>{t('settings.lightMode')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTheme('dark')}
                  style={[styles.pill, theme === 'dark' && styles.pillActive]}
                >
                  <Feather name="moon" size={16} color={theme === 'dark' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.pillText, { color: theme === 'dark' ? '#fff' : colors.textSecondary }]}>{t('settings.darkMode')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTheme('system')}
                  style={[styles.pill, theme === 'system' && styles.pillActive]}
                >
                  <Feather name="smartphone" size={16} color={theme === 'system' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.pillText, { color: theme === 'system' ? '#fff' : colors.textSecondary }]}>{t('settings.systemDefault')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.language')}</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() => setLanguage('en')}
                  style={[styles.pill, language === 'en' && styles.pillActive]}
                >
                  <Feather name="flag" size={16} color={language === 'en' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.pillText, { color: language === 'en' ? '#fff' : colors.textSecondary }]}>{t('settings.english')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLanguage('zh')}
                  style={[styles.pill, language === 'zh' && styles.pillActive]}
                >
                  <Feather name="flag" size={16} color={language === 'zh' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.pillText, { color: language === 'zh' ? '#fff' : colors.textSecondary }]}>{t('settings.chinese')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.account')}</Text>
              <View style={styles.accountRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.body, { color: colors.text }]}>{user?.email}</Text>
                  <Text style={[styles.caption, { color: colors.textSecondary }]}>{t('settings.signedInAs')}</Text>
                </View>
                <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
                  <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.reflectionExperience')}</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>
                {t('settings.reflectionSubtitle')}
              </Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>
                {t('settings.currentPlan')}: {profile?.plan === 'premium' ? t('settings.planPremium') : t('settings.planFree')}
              </Text>
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => updatePlan('premium')}
                  style={[
                    styles.option,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    profile?.plan === 'premium' && styles.optionActive,
                  ]}
                >
                  <Text style={[styles.optionTitle, { color: profile?.plan === 'premium' ? '#fff' : colors.text }]}>{t('settings.planPremium')}</Text>
                  <Text style={[styles.optionText, { color: colors.textSecondary }]}>
                    {t('settings.premiumCopy')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updatePlan('free')}
                  style={[
                    styles.option,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    profile?.plan !== 'premium' && styles.optionActive,
                  ]}
                >
                  <Text style={[styles.optionTitle, { color: profile?.plan !== 'premium' ? '#fff' : colors.text }]}>{t('settings.planFree')}</Text>
                  <Text style={[styles.optionText, { color: colors.textSecondary }]}>
                    {t('settings.freeCopy')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.notifications')}</Text>
              <View style={styles.rowBetween}>
                <Text style={[styles.body, { color: colors.textSecondary }]}>{t('settings.enableReminder') || 'Enable daily reminder'}</Text>
                <Switch
                  value={!!profile?.daily_reminder_enabled}
                  onValueChange={(v) => updateReminder(v)}
                  trackColor={{ true: '#3b82f6', false: colors.border }}
                  thumbColor={profile?.daily_reminder_enabled ? '#fff' : '#e5e7eb'}
                />
              </View>
              {profile?.daily_reminder_enabled && (
                <View style={[styles.rowBetween, { marginTop: 8 }]}>
                  <Text style={[styles.body, { color: colors.textSecondary }]}>{t('settings.time') || 'Time'}</Text>
                  <TextInput
                    value={reminderTime}
                    onChangeText={(text) => updateReminder(true, text)}
                    placeholder="09:00"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.timeInput, { borderColor: colors.border, color: colors.text }]}
                  />
                </View>
              )}
              <Text style={[styles.helper, { color: colors.textTertiary, marginTop: 8 }]}>
                {profile?.daily_reminder_enabled
                  ? t('settings.reminderOn') || "We'll gently remind you to check in"
                  : t('settings.reminderOff') || 'Stay on track with a daily reminder'}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.dataManagement')}</Text>
              <TouchableOpacity style={styles.dataButton} onPress={handleExportData}>
                <Feather name="download" size={16} color="#e5e7eb" />
                <Text style={styles.dataButtonText}>
                  {t('settings.exportData')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dataButton, { backgroundColor: '#7f1d1d' }]} onPress={handleDeleteAll}>
                <Feather name="trash-2" size={16} color="#e5e7eb" />
                <Text style={styles.dataButtonText}>
                  {t('settings.deleteData')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings.privacy')}</Text>
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>{t('settings.privacyText1')}</Text>
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>{t('settings.privacyText2')}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: '#312e2a', borderColor: '#92400e' }]}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Feather name="alert-triangle" size={18} color="#fbbf24" />
                <Text style={[styles.cardTitle, { color: '#fbbf24' }]}>{t('settings.disclaimer')}</Text>
              </View>
              <Text style={[styles.cardText, { color: '#f5e7c3' }]}>{t('settings.disclaimerText1')}</Text>
              <Text style={[styles.cardText, { color: '#f5e7c3' }]}>{t('settings.disclaimerText2')}</Text>
            </View>

            <View style={styles.footer}>
              <View style={styles.logoBox}>
                <Image source={require('../../assets/mirror_logo.png')} style={styles.footerLogo} resizeMode="contain" />
              </View>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>{t('app.tagline')}</Text>
            </View>

            {saving && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <ActivityIndicator color={colors.text} />
                <Text style={{ color: colors.textSecondary }}>Saving...</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 120 },
  header: { alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '600' },
  subtitle: { fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardText: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  pillText: { fontSize: 14, fontWeight: '500' },
  body: { fontSize: 14 },
  caption: { fontSize: 12 },
  signOutButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#ef4444' },
  signOutText: { color: '#fff', fontWeight: '600' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  option: { borderWidth: 1, borderRadius: 12, padding: 12, backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)' },
  optionActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  optionTitle: { fontSize: 14, fontWeight: '600' },
  optionText: { fontSize: 13, lineHeight: 18 },
  helper: { fontSize: 12, lineHeight: 18 },
  timeInput: {
    minWidth: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    textAlign: 'center',
  },
  dataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  dataButtonText: { color: '#e5e7eb', fontWeight: '600' },
  footer: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  logoBox: { width: 96, height: 96, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 12 },
  footerLogo: { width: '100%', height: '100%' },
});
