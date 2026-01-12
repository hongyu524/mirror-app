import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext.native';
import { useAuth } from '../contexts/AuthContext.native';
import { getThemeColors } from '../lib/themeColors';
import { db } from '../firebase/firebaseConfig';

type ReflectionSummaryProps = {
  onNavigate?: () => void;
};

type ReflectionDoc = {
  support_answer?: string | null;
  reframe_answer?: string | null;
  boundary_answer?: string | null;
  completed_at?: any;
};

export function ReflectionSummary({}: ReflectionSummaryProps) {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const colors = getThemeColors(resolvedTheme === 'light');

  const [reflection, setReflection] = useState<ReflectionDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setReflection(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const todayKey = new Date().toISOString().split('T')[0];
        const ref = doc(db, 'users', user.uid, 'reflections', todayKey);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setReflection(snap.data() as ReflectionDoc);
        } else {
          setReflection(null);
        }
      } catch (err) {
        console.error('ReflectionSummary load failed', err);
        setReflection(null);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const hasAnswers =
    reflection?.support_answer || reflection?.reframe_answer || reflection?.boundary_answer;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Today's Reflections</Text>
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.text} />
          <Text style={[styles.subtitle, { color: colors.textSecondary, marginLeft: 8 }]}>
            Loading...
          </Text>
        </View>
      ) : !user ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Sign in to see reflections.</Text>
      ) : !hasAnswers ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          No reflection answers yet today.
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {reflection?.support_answer && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Support:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{reflection.support_answer}</Text>
            </View>
          )}
          {reflection?.reframe_answer && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Reframe:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{reflection.reframe_answer}</Text>
            </View>
          )}
          {reflection?.boundary_answer && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Boundary:</Text>
              <Text style={[styles.value, { color: colors.text }]}>{reflection.boundary_answer}</Text>
            </View>
          )}
          {reflection?.completed_at && (
            <Text style={[styles.footer, { color: colors.textTertiary }]}>
              These insights influence your patterns.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: { fontSize: 13, width: 80 },
  value: { fontSize: 14, flexShrink: 1 },
  footer: { fontSize: 12, marginTop: 6 },
});
