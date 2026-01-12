export const EMOTIONS_GROUPED = {
  positive: [
    { emoji: '😊', value: 'happy' },
    { emoji: '😄', value: 'excited' },
    { emoji: '🥰', value: 'loved' },
    { emoji: '😌', value: 'calm' },
  ],
  neutral: [
    { emoji: '😕', value: 'confused' },
    { emoji: '😐', value: 'neutral' },
  ],
  negative: [
    { emoji: '😢', value: 'sad' },
    { emoji: '😠', value: 'angry' },
    { emoji: '😰', value: 'anxious' },
    { emoji: '😔', value: 'hurt' },
    { emoji: '😤', value: 'frustrated' },
    { emoji: '😞', value: 'disappointed' },
    { emoji: '😖', value: 'overwhelmed' },
  ],
};

export type EmotionCategory = 'positive' | 'neutral' | 'negative';

export const EMOTION_COLORS: Record<EmotionCategory, {
  bg: string;
  border: string;
  text: string;
  gradient: string;
  ring: string;
  dot: string;
}> = {
  positive: {
    bg: 'bg-green-600',
    border: 'border-green-500/20',
    text: 'text-green-400',
    gradient: 'from-green-500 to-green-400',
    ring: 'ring-green-500',
    dot: 'bg-green-400',
  },
  neutral: {
    bg: 'bg-gray-600',
    border: 'border-gray-500/20',
    text: 'text-gray-400',
    gradient: 'from-gray-500 to-gray-400',
    ring: 'ring-gray-500',
    dot: 'bg-gray-400',
  },
  negative: {
    bg: 'bg-orange-600',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    gradient: 'from-orange-500 to-orange-400',
    ring: 'ring-orange-500',
    dot: 'bg-orange-400',
  },
};

export function getEmotionCategory(emotion: string): EmotionCategory {
  const allPositive = EMOTIONS_GROUPED.positive.map(e => e.value);
  const allNeutral = EMOTIONS_GROUPED.neutral.map(e => e.value);

  if (allPositive.includes(emotion)) return 'positive';
  if (allNeutral.includes(emotion)) return 'neutral';
  return 'negative';
}

export function getEmotionColor(emotion: string) {
  const category = getEmotionCategory(emotion);
  return EMOTION_COLORS[category];
}

export function getEmotionEmoji(emotion: string): string {
  for (const category of Object.values(EMOTIONS_GROUPED)) {
    const found = category.find(e => e.value === emotion);
    if (found) return found.emoji;
  }
  return '😐';
}

export const COLOR_PALETTE = [
  { name: 'Red', hex: '#ef4444', meaning: 'Passion, Anger, Energy' },
  { name: 'Orange', hex: '#f97316', meaning: 'Enthusiasm, Warmth, Excitement' },
  { name: 'Amber', hex: '#f59e0b', meaning: 'Confidence, Success, Pride' },
  { name: 'Yellow', hex: '#fbbf24', meaning: 'Joy, Optimism, Happiness' },
  { name: 'Lime', hex: '#84cc16', meaning: 'Growth, Renewal, Fresh Start' },
  { name: 'Green', hex: '#10b981', meaning: 'Balance, Calm, Harmony' },
  { name: 'Teal', hex: '#14b8a6', meaning: 'Clarity, Focus, Peace' },
  { name: 'Cyan', hex: '#06b6d4', meaning: 'Tranquility, Communication' },
  { name: 'Blue', hex: '#3b82f6', meaning: 'Trust, Stability, Reflection' },
  { name: 'Indigo', hex: '#6366f1', meaning: 'Intuition, Wisdom, Depth' },
  { name: 'Purple', hex: '#a855f7', meaning: 'Imagination, Spirituality' },
  { name: 'Magenta', hex: '#ec4899', meaning: 'Love, Care, Compassion' },
];

export function getSuggestedColorForEmotion(emotion: string): string {
  const emotionColorMap: Record<string, string> = {
    happy: '#fbbf24',
    excited: '#f97316',
    loved: '#ec4899',
    calm: '#10b981',
    confused: '#6366f1',
    neutral: '#3b82f6',
    sad: '#06b6d4',
    angry: '#ef4444',
    anxious: '#a855f7',
    hurt: '#ec4899',
    frustrated: '#f59e0b',
    disappointed: '#14b8a6',
    overwhelmed: '#6366f1',
  };
  return emotionColorMap[emotion] || COLOR_PALETTE[0].hex;
}
