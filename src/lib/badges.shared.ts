import { BadgeCategory, BadgeCriteriaType, BadgeDefinition } from './badges.types';

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    icon: '🌱',
    category: 'getting_started',
    description: 'Logged your first moment',
    criteriaType: 'moments_logged',
    threshold: 1,
    xpReward: 10,
  },
  {
    id: 'reflection_starter',
    name: 'Reflection Starter',
    icon: '💭',
    category: 'getting_started',
    description: 'Completed your first daily reflection',
    criteriaType: 'reflections_completed',
    threshold: 1,
    xpReward: 15,
  },
  {
    id: 'three_in_a_row',
    name: 'Building Momentum',
    icon: '🔥',
    category: 'consistency',
    description: 'Completed reflections on 3 different days',
    criteriaType: 'reflections_completed',
    threshold: 3,
    xpReward: 25,
  },
  {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    icon: '⚡',
    category: 'consistency',
    description: 'Completed reflections on 7 different days',
    criteriaType: 'reflections_completed',
    threshold: 7,
    xpReward: 50,
  },
  {
    id: 'depth_builder',
    name: 'Depth Builder',
    icon: '📝',
    category: 'depth',
    description: 'Added tags or notes to 5 moments',
    criteriaType: 'tags_added',
    threshold: 5,
    xpReward: 20,
  },
  {
    id: 'detail_master',
    name: 'Detail Master',
    icon: '🎯',
    category: 'depth',
    description: 'Added tags or notes to 20 moments',
    criteriaType: 'tags_added',
    threshold: 20,
    xpReward: 40,
  },
  {
    id: 'calm_finder',
    name: 'Calm Finder',
    icon: '🕊️',
    category: 'emotion',
    description: 'Logged "Calm" emotion 5 times',
    criteriaType: 'emotion_logged',
    threshold: 5,
    emotionType: 'Calm',
    xpReward: 20,
  },
  {
    id: 'hard_truth',
    name: 'Raw Honesty',
    icon: '💢',
    category: 'emotion',
    description: 'Logged difficult emotions (Hurt/Angry) 3 times',
    criteriaType: 'emotion_logged',
    threshold: 3,
    emotionType: 'Hurt',
    xpReward: 30,
  },
  {
    id: 'joy_seeker',
    name: 'Joy Seeker',
    icon: '✨',
    category: 'emotion',
    description: 'Logged "Happy" or "Excited" 10 times',
    criteriaType: 'emotion_logged',
    threshold: 10,
    emotionType: 'Happy',
    xpReward: 25,
  },
  {
    id: 'pattern_hunter',
    name: 'Pattern Hunter',
    icon: '🔍',
    category: 'insight',
    description: 'Viewed your patterns page 3 times',
    criteriaType: 'patterns_viewed',
    threshold: 3,
    xpReward: 15,
  },
  {
    id: 'streak_starter',
    name: 'Streak Starter',
    icon: '🌟',
    category: 'consistency',
    description: 'Maintained a 3-day streak',
    criteriaType: 'streak_days',
    threshold: 3,
    xpReward: 30,
  },
  {
    id: 'committed',
    name: 'Fully Committed',
    icon: '🏆',
    category: 'consistency',
    description: 'Maintained a 7-day streak',
    criteriaType: 'streak_days',
    threshold: 7,
    xpReward: 60,
  },
];

export function getBadgeDefinition(badgeId: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.id === badgeId);
}

export function getBadgesByCategory(category: BadgeCategory): BadgeDefinition[] {
  return BADGE_DEFINITIONS.filter(b => b.category === category);
}

export function getCategoryName(category: BadgeCategory): string {
  const names: Record<BadgeCategory, string> = {
    getting_started: 'Getting Started',
    consistency: 'Consistency',
    depth: 'Detail & Depth',
    emotion: 'Emotional Range',
    insight: 'Self-Insight',
  };
  return names[category];
}


