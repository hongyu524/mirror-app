export type UserProgress = {
  total_xp: number;
  weekly_xp: number;
  current_level: number;
};

export const LEVEL_THRESHOLDS: { xp: number }[] = [{ xp: 0 }, { xp: 100 }];

export function getUserProgress(_userId: string): Promise<UserProgress | null> {
  return Promise.resolve({
    total_xp: 0,
    weekly_xp: 0,
    current_level: 1,
  });
}

export function getLevelInfo(level: number) {
  return { name: 'Beginner', xp: LEVEL_THRESHOLDS[Math.min(level, LEVEL_THRESHOLDS.length - 1)].xp };
}

export function calculateLevelProgress(_totalXp: number) {
  return { percentage: 0, needed: 100, current: 0, isMaxLevel: false };
}

export async function awardMomentXP(_userId: string, _amount: number) {
  return;
}
