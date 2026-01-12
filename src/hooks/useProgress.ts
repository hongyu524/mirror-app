import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
  activeBadge: null;
};

export function useProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<ProgressModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; levelName: string } | null>(null);
  const progressRef = useRef<ProgressModel | null>(null);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const loadProgress = useCallback(() => {
    if (!user) {
      setProgress(null);
      setLoading(false);
      return;
    }

    const baseline: ProgressModel = {
      totalXP: 0,
      weeklyXP: 0,
      streakDays: 0,
      level: 1,
      levelName: 'Beginner',
      currentLevelMinXP: 0,
      nextLevelXP: 100,
      progressToNext: 0,
      xpRemaining: 100,
      isMaxLevel: false,
      activeBadge: null,
    };
    setProgress(baseline);
    setLevelUpInfo(null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const clearLevelUp = () => setLevelUpInfo(null);

  return { progress, loading, refresh: loadProgress, levelUpInfo, clearLevelUp };
}
