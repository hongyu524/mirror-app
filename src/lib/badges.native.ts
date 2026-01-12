import { collection, doc, getDocs, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import {
  BADGE_DEFINITIONS,
  getBadgeDefinition,
  getBadgesByCategory,
  getCategoryName,
} from './badges.shared';
import type { BadgeDefinition, BadgeCriteriaType } from './badges.types';

export type UserBadge = {
  badge_id: string;
  earned_at?: string | null;
  criteria_value?: number | null;
};

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  if (!userId) return [];
  const snap = await getDocs(collection(db, 'users', userId, 'badges'));
  return snap.docs.map((d) => ({
    badge_id: d.id,
    earned_at: d.data().earnedAt || null,
    criteria_value: d.data().progressCurrent || 0,
  }));
}

export async function hasBadge(userId: string, badgeId: string): Promise<boolean> {
  if (!userId || !badgeId) return false;
  const ref = doc(db, 'users', userId, 'badges', badgeId);
  const snap = await getDoc(ref);
  return snap.exists() && !!snap.data()?.earned;
}

export async function awardBadge(
  userId: string,
  badgeId: string,
  criteriaValue: number = 0
): Promise<{ success: boolean; alreadyEarned: boolean; badge?: BadgeDefinition }> {
  const badgeDef = getBadgeDefinition(badgeId);
  if (!badgeDef || !userId) {
    return { success: false, alreadyEarned: false };
  }
  const ref = doc(db, 'users', userId, 'badges', badgeId);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data()?.earned) {
    return { success: true, alreadyEarned: true, badge: badgeDef };
  }
  await setDoc(
    ref,
    {
      earned: true,
      earnedAt: serverTimestamp(),
      progressCurrent: badgeDef.threshold,
      progressTarget: badgeDef.threshold,
      progressText: `${badgeDef.threshold}/${badgeDef.threshold}`,
      category: badgeDef.category,
    },
    { merge: true }
  );
  return { success: true, alreadyEarned: false, badge: badgeDef };
}

export async function checkAndAwardBadges(
  userId: string,
  criteriaType: BadgeCriteriaType,
  currentValue: number,
  emotionType?: string
): Promise<BadgeDefinition[]> {
  if (!userId) return [];
  const earned: BadgeDefinition[] = [];
  for (const def of BADGE_DEFINITIONS) {
    if (def.criteriaType !== criteriaType) continue;
    if (def.emotionType && def.emotionType !== emotionType) continue;
    if (currentValue >= (def.threshold || 0)) {
      const res = await awardBadge(userId, def.id, currentValue);
      if (res.success) earned.push(def);
    }
  }
  return earned;
}

export async function setActiveBadge(userId: string, badgeId: string | null): Promise<boolean> {
  if (!userId) return false;
  const statsRef = doc(db, 'users', userId, 'stats', 'main');
  await setDoc(statsRef, { activeBadgeId: badgeId }, { merge: true });
  return true;
}

export async function getActiveBadge(userId: string): Promise<BadgeDefinition | null> {
  if (!userId) return null;
  const statsRef = doc(db, 'users', userId, 'stats', 'main');
  const snap = await getDoc(statsRef);
  const activeId = snap.exists() ? snap.data()?.activeBadgeId : null;
  if (!activeId) return null;
  return getBadgeDefinition(activeId) || null;
}

export { BADGE_DEFINITIONS, getBadgeDefinition, getBadgesByCategory, getCategoryName };
export type { BadgeDefinition, BadgeCriteriaType };

