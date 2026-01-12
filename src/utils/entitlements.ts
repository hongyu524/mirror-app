import { UserProfile } from './types';

export function isPremium(user: UserProfile | null | undefined) {
  return user?.plan === 'premium';
}

export function canUseGuided(user: UserProfile | null | undefined) {
  return isPremium(user);
}

export function canUseProInsights(user: UserProfile | null | undefined) {
  return isPremium(user);
}

export function canUseGameMode(user: UserProfile | null | undefined) {
  return isPremium(user);
}
