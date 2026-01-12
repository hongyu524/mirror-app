import { useEffect, useState, useCallback } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useAuth } from '../contexts/AuthContext.native';
import { ensureStatsDoc } from '../lib/game';

export type GameStats = {
  allTimeXP?: number;
  weeklyXP?: number;
  weeklyKey?: string;
  level?: number;
  levelName?: string;
  journeyDay?: number;
  journeyProgress?: number;
  momentsCount?: number;
  reflectionsCount?: number;
  streakDays?: number;
  bestStreakDays?: number;
  todayQuests?: {
    momentDone?: boolean;
    reflectionsDone?: boolean;
    patternsReviewed?: boolean;
  };
  lastMomentAt?: any;
  lastReflectionAt?: any;
  activeBadgeId?: string | null;
};

export function useGameState() {
  const { user } = useAuth();
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStats(null);
      setLoading(false);
      return;
    }
    let unsub = () => {};
    const init = async () => {
      setLoading(true);
      await ensureStatsDoc(user.uid);
      const ref = doc(db, 'users', user.uid, 'stats', 'main');
      unsub = onSnapshot(ref, (snap) => {
        setStats(snap.data() as GameStats);
        setLoading(false);
      });
    };
    init();
    return () => {
      unsub();
    };
  }, [user]);

  const refresh = useCallback(() => {
    // snapshot keeps live data; refresh hook present for API symmetry
    return;
  }, []);

  return { stats, loading, refresh };
}
