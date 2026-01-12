export type UserProfile = {
  plan?: 'free' | 'premium';
  reflection_style?: 'guided' | 'free';
  daily_reminder_enabled?: boolean;
  daily_reminder_time?: string;
};
