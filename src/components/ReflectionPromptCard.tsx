import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext.native';
import { useTheme } from '../contexts/ThemeContext.native';
import { useLanguage } from '../contexts/LanguageContext.native';
import { getThemeColors } from '../lib/themeColors';
import { db } from '../firebase/firebaseConfig';

type ReflectionPrompt = {
  id: string;
  prompt_text: string;
  category: string;
  quick_choices: string[];
};

type ReflectionAnswer = {
  quick_choice?: string;
  notes?: string | null;
};

type ReflectionPromptCardProps = {
  prompt: ReflectionPrompt;
  existingAnswer?: ReflectionAnswer;
  onAnswerSaved?: () => void;
};

export function ReflectionPromptCard({ prompt, existingAnswer, onAnswerSaved }: ReflectionPromptCardProps) {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();
  const colors = getThemeColors(resolvedTheme === 'light');

  const [selectedChoice, setSelectedChoice] = useState<string>(existingAnswer?.quick_choice || '');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // if existingAnswer changes, sync selection
    if (existingAnswer?.quick_choice) {
      setSelectedChoice(existingAnswer.quick_choice);
    }
  }, [existingAnswer]);

  const handleChoiceSelect = async (choice: string) => {
    if (!user) return;
    setSelectedChoice(choice);
    setSaving(true);
    try {
      const ref = doc(db, 'users', user.uid, 'reflections', 'prompts', prompt.id);
      const answer: ReflectionAnswer = { quick_choice: choice };
      await setDoc(ref, answer, { merge: true });
      if (onAnswerSaved) onAnswerSaved();
    } catch (err) {
      console.error('Failed to save reflection answer', err);
    }
    setSaving(false);
  };

  // ensure quick choices array
  const choices: string[] = Array.isArray(prompt.quick_choices)
    ? prompt.quick_choices
    : [];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.category, { color: colors.textSecondary }]}>
          {prompt.category}
        </Text>
      </View>
      <Text style={[styles.prompt, { color: colors.text }]}>{prompt.prompt_text}</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.text} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('common.loading') || 'Loading...'}</Text>
        </View>
      ) : (
        <View style={styles.choices}>
          {choices.map((choice) => {
            const isSelected = selectedChoice === choice;
            return (
              <TouchableOpacity
                key={choice}
                onPress={() => handleChoiceSelect(choice)}
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
                  {choice}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prompt: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  choiceText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 14 },
});
