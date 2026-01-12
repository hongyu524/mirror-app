import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.native';
import type { BadgeDefinition } from '../lib/badges.native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { computeLevel, getCurrentWeekKey, LEVEL_THRESHOLDS } from '../lib/game';

export type ProgressModel = {
  totalXP: number;
  weeklyXP: number;
  streakDays: number;
  level: number;
  levelName: string;
  currentLevelMinXP: number;
  nextLevelXP: number | null;
  progressToNext: number;
  xpRemaining: number | null;
  isMaxLevel: boolean;
  activeBadge: BadgeDefinition | null;
};

export function useProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; levelName: string } | null>(null);
  const progressRef = useRef<ProgressModel | null>(null);
  
  // Keep progressRef in sync with progress state
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const loadProgress = useCallback(async () => {
    if (!user) {
      setProgress(null);
      setLoading(false);
      return;
    }
    const ref = doc(db, 'users', user.uid, 'stats', 'main');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const weekKey = getCurrentWeekKey();
      await setDoc(ref, {
        allTimeXP: 0,
        weeklyXP: 0,
        weeklyKey: weekKey,
        level: 1,
        activeBadgeId: null,
        momentsCount: 0,
        reflectionsCount: 0,
      });
    }
    const statsSnap = await getDoc(ref);
    const stats = statsSnap.data() || {};
    const level = computeLevel(stats.allTimeXP || 0);
    const nextThreshold = LEVEL_THRESHOLDS.find((t) => t > (stats.allTimeXP || 0)) || null;
    const currentMin = LEVEL_THRESHOLDS[level - 1] || 0;
    const isMaxLevel = level === LEVEL_THRESHOLDS.length;
    const progressToNext = isMaxLevel
      ? 1
      : ((stats.allTimeXP || 0) - currentMin) / ((nextThreshold || currentMin) - currentMin || 1);
    const xpRemaining = isMaxLevel ? null : (nextThreshold || 0) - (stats.allTimeXP || 0);

    const model: ProgressModel = {
      totalXP: stats.allTimeXP || 0,
      weeklyXP: stats.weeklyXP || 0,
      streakDays: stats.streakDays || 0,
      level,
      levelName: `Level ${level}`,
      currentLevelMinXP: currentMin,
      nextLevelXP: nextThreshold,
      progressToNext,
      xpRemaining,
      isMaxLevel,
      activeBadge: stats.activeBadgeId ? { id: stats.activeBadgeId } as any : null,
    };

    setProgress(model);
    setLevelUpInfo(null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    // no realtime channel in Firebase stub
  }, [user, loadProgress]);

  const clearLevelUp = () => setLevelUpInfo(null);

  return {
    progress,
    loading,
    refresh: loadProgress,
    levelUpInfo,
    clearLevelUp,
  };
}

