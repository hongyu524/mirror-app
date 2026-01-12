export type DailyQuestProgress = {
  quest_logged_moment?: boolean;
  quest_answered_reflection?: boolean;
  quest_added_detail?: boolean;
};

export async function getTodaysQuestProgress(_userId: string): Promise<DailyQuestProgress | null> {
  return null;
}

export async function updateQuestProgress(_userId: string, _updates: DailyQuestProgress) {
  return;
}

export async function checkAndAwardMilestones(_userId: string) {
  return [];
}

export async function getUserMilestonesWithDetails(_userId: string) {
  return [];
}
