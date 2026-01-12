export type BadgeCategory = 'getting_started' | 'consistency' | 'depth' | 'emotion' | 'insight';

export type BadgeCriteriaType =
  | 'moments_logged'
  | 'reflections_completed'
  | 'tags_added'
  | 'emotion_logged'
  | 'patterns_viewed'
  | 'streak_days';

export type BadgeDefinition = {
  id: string;
  name: string;
  icon: string;
  category: BadgeCategory;
  description: string;
  criteriaType: BadgeCriteriaType;
  threshold: number;
  emotionType?: string;
  xpReward: number;
};


