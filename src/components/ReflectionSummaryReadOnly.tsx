import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext.native';

type Props = {
  answeredCount: number;
  total: number;
  completed: boolean;
  onEdit?: () => void;
};

export function ReflectionSummaryReadOnly({ answeredCount, total, completed, onEdit }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="edit-3" size={18} color="#9ca3af" />
          <Text style={styles.title}>{t('reflection.todayTitle')}</Text>
        </View>
        <View style={[styles.pill, { borderColor: completed ? '#22c55e' : '#334155' }]}>
          <Text style={[styles.pillText, { color: completed ? '#22c55e' : '#cbd5e1' }]}>
            {answeredCount}/{total}
          </Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        {completed ? (t('reflection.completeHint') || t('common.done')) : (t('reflection.quickHint') || '')}
      </Text>
      <TouchableOpacity style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editText}>{t('reflection.editCta') || t('common.edit') || 'Edit'}</Text>
        <Feather name="chevron-right" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8, borderColor: '#1f2937', backgroundColor: '#0b1220' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
  subtitle: { fontSize: 14, color: '#cbd5e1' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '700' },
  editButton: { marginTop: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
