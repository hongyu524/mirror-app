import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { BADGE_DEFINITIONS, getBadgeDefinition } from './badges.shared';

export const LEVEL_THRESHOLDS = [0, 50, 200, 600, 1500, 3500, 7500];
export const LEVEL_NAMES = ['levels.beginner', 'levels.explorer', 'levels.seeker', 'levels.adept', 'levels.navigator', 'levels.guide', 'levels.sage'];

export function getCurrentDateKey(d = new Date()) {
  return d.toISOString().split('T')[0];
}

export function getCurrentWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const week = weekNo.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-W${week}`;
}

export function computeLevel(allTimeXP: number) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (allTimeXP >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(level, LEVEL_THRESHOLDS.length);
}

export function computeLevelName(level: number) {
  return LEVEL_NAMES[Math.min(Math.max(level, 1), LEVEL_NAMES.length) - 1] || 'levels.explorer';
}

function statsRef(uid: string) {
  return doc(db, 'users', uid, 'stats', 'main');
}

export async function ensureStatsDoc(uid: string) {
  const ref = statsRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const weekKey = getCurrentWeekKey();
    await setDoc(ref, {
      allTimeXP: 0,
      weeklyXP: 0,
      weeklyKey: weekKey,
      level: 1,
      levelName: computeLevelName(1),
      activeBadgeId: null,
      momentsCount: 0,
      reflectionsCount: 0,
      streakDays: 0,
      bestStreakDays: 0,
      journeyDay: 0,
      journeyWeekKey: weekKey,
    });
  }
}

export async function awardXpOnce(
  uid: string,
  eventId: string,
  amount: number,
  metadata?: Record<string, any>
) {
  if (!uid || !eventId || amount <= 0) return { awarded: false, level: null };
  const xpRef = doc(db, 'users', uid, 'xp_events', eventId);
  const sRef = statsRef(uid);
  const weekKey = getCurrentWeekKey();

  const result = await runTransaction(db, async (tx) => {
    const xpSnap = await tx.get(xpRef);
    if (xpSnap.exists()) {
      return { awarded: false, level: null };
    }

    const statsSnap = await tx.get(sRef);
    const stats = statsSnap.exists() ? statsSnap.data() : {};
    const weeklyXP = stats.weeklyKey === weekKey ? stats.weeklyXP || 0 : 0;
    const allTimeXP = stats.allTimeXP || 0;
    const newAll = allTimeXP + amount;
    const newWeekly = weeklyXP + amount;
    const level = computeLevel(newAll);
    const levelName = computeLevelName(level);

    tx.set(
      xpRef,
      {
        amount,
        createdAt: serverTimestamp(),
        weekKey,
        metadata: metadata || {},
      },
      { merge: true }
    );

    tx.set(
      sRef,
      {
        weeklyKey: weekKey,
        weeklyXP: newWeekly,
        allTimeXP: newAll,
        level,
        levelName,
      },
      { merge: true }
    );

    return { awarded: true, level };
  });

  return result;
}

export async function reconcileWeeklyReset(uid: string) {
  const ref = statsRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const stats = snap.data();
  const weekKey = getCurrentWeekKey();
  if (stats.weeklyKey !== weekKey) {
    await updateDoc(ref, { weeklyKey: weekKey, weeklyXP: 0 });
  }
}

export async function reconcileStatsFromData(uid: string) {
  const ref = statsRef(uid);
  await ensureStatsDoc(uid);

  const [momentsSnap, reflectionsSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'moments')),
    getDocs(collection(db, 'users', uid, 'daily_reflections')),
  ]);

  const momentsCount = momentsSnap.size;
  let reflectionsCount = 0;
  const reflectionDates: string[] = [];
  let lastMomentAt: any = null;
  let lastReflectionAt: any = null;
  let depthMoments = 0;
  const emotionCounts: Record<string, number> = {};

  momentsSnap.forEach((docSnap) => {
    const d = docSnap.data() as any;
    const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt ? new Date(d.createdAt) : null;
    if (createdAt && (!lastMomentAt || createdAt > lastMomentAt)) lastMomentAt = createdAt;
    if ((d.tags && d.tags.length) || d.note) depthMoments += 1;
    if (d.emotion) {
      emotionCounts[d.emotion] = (emotionCounts[d.emotion] || 0) + 1;
    }
  });

  reflectionsSnap.forEach((docSnap) => {
    const d = docSnap.data() as any;
    if (d.completed) {
      reflectionsCount += 1;
      const dateKey = d.dateKey || docSnap.id;
      reflectionDates.push(dateKey);
      const completedAt = d.completedAt?.toDate ? d.completedAt.toDate() : d.completedAt ? new Date(d.completedAt) : null;
      if (completedAt && (!lastReflectionAt || completedAt > lastReflectionAt)) lastReflectionAt = completedAt;
    }
  });

  // streak calculations
  const sortedDates = reflectionDates
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 0;
  let bestStreak = 0;
  let prev: Date | null = null;
  sortedDates.forEach((date) => {
    if (!prev) {
      streak = 1;
    } else {
      const diff = (prev.getTime() - date.getTime()) / 86400000;
      if (diff === 1) {
        streak += 1;
      } else if (diff > 1) {
        // break
        streak = 1;
      }
    }
    bestStreak = Math.max(bestStreak, streak);
    prev = date;
  });

  const today = getCurrentDateKey();
  const hasToday = reflectionDates.includes(today);
  if (!hasToday) {
    // reset current streak to 0 if no reflection today
    streak = 0;
  }

  // journey day: distinct days with moments in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const journeyDays = new Set<string>();
  momentsSnap.forEach((docSnap) => {
    const d = docSnap.data() as any;
    const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt ? new Date(d.createdAt) : null;
    if (createdAt && createdAt >= sevenDaysAgo) {
      journeyDays.add(createdAt.toISOString().split('T')[0]);
    }
  });
  const journeyDay = Math.min(7, journeyDays.size);

  const updates: any = {
    momentsCount,
    reflectionsCount,
    streakDays: streak,
    bestStreakDays: bestStreak,
    journeyDay,
    lastMomentAt: lastMomentAt || null,
    lastReflectionAt: lastReflectionAt || null,
    depthMoments,
    emotionCounts,
  };

  await setDoc(ref, updates, { merge: true });
  return updates;
}

export async function reconcileBadges(uid: string) {
  const statsSnap = await getDoc(statsRef(uid));
  if (!statsSnap.exists()) return;
  const stats = statsSnap.data() as any;

  // Load supplemental data
  const [momentsSnap, reflectionsSnap] = await Promise.all([
    getDocs(collection(db, 'users', uid, 'moments')),
    getDocs(collection(db, 'users', uid, 'daily_reflections')),
  ]);

  const reflectionsDays = new Set<string>();
  reflectionsSnap.forEach((d) => {
    const data = d.data() as any;
    if (data.completed) reflectionsDays.add(data.dateKey || d.id);
  });

  let tagsNotesCount = 0;
  const emotionCounts: Record<string, number> = {};
  momentsSnap.forEach((d) => {
    const data = d.data() as any;
    if ((data.tags && data.tags.length) || data.note) tagsNotesCount += 1;
    if (data.emotion) {
      emotionCounts[data.emotion] = (emotionCounts[data.emotion] || 0) + 1;
    }
  });

  const badgeWrites: Promise<any>[] = [];

  for (const def of BADGE_DEFINITIONS) {
    let progressCurrent = 0;
    const target = def.threshold || 0;

    switch (def.criteriaType) {
      case 'moments_logged':
        progressCurrent = stats.momentsCount || 0;
        break;
      case 'reflections_completed':
        progressCurrent = reflectionsDays.size;
        break;
      case 'tags_added':
        progressCurrent = tagsNotesCount;
        break;
      case 'emotion_logged':
        progressCurrent = emotionCounts[def.emotionType || ''] || 0;
        break;
      case 'streak_days':
        progressCurrent = stats.streakDays || 0;
        break;
      case 'patterns_viewed':
        progressCurrent = stats.patternsViewed || 0;
        break;
      default:
        progressCurrent = 0;
    }

    const earned = progressCurrent >= target && target > 0;
    const badgeRef = doc(db, 'users', uid, 'badges', def.id);
    badgeWrites.push(
      setDoc(
        badgeRef,
        {
          earned,
          earnedAt: earned ? serverTimestamp() : null,
          progressCurrent,
          progressTarget: target,
          progressText: `${progressCurrent}/${target}`,
          category: def.category,
        },
        { merge: true }
      )
    );
  }

  await Promise.all(badgeWrites);
}

export async function reconcileDailyQuests(uid: string, todayKey: string) {
  const [momentsSnap, reflectionDoc] = await Promise.all([
    getDocs(
      query(collection(db, 'users', uid, 'moments'), orderBy('createdAt', 'desc'))
    ),
    getDoc(doc(db, 'users', uid, 'daily_reflections', todayKey)),
  ]);

  const hasMomentToday = momentsSnap.docs.some((d) => {
    const data = d.data() as any;
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null;
    if (!createdAt) return false;
    return createdAt.toISOString().split('T')[0] === todayKey;
  });

  const reflectionsCompleted = reflectionDoc.exists() && !!reflectionDoc.data()?.completed;

  // award for daily reflections
  if (reflectionsCompleted) {
    await awardXpOnce(uid, `DAILY_REFLECTIONS_COMPLETED_${todayKey}`, 15, { dateKey: todayKey });
  }

  // award for moment complete
  if (hasMomentToday) {
    await awardXpOnce(uid, `MOMENT_COMPLETED_${todayKey}`, 10, { dateKey: todayKey });
  }
}
