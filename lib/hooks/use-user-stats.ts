'use client';

import { useCallback, useEffect, useState } from 'react';

export type AchievementProgress = { current: number; target: number; pct: number } | null;

export type UserAchievementItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  category: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: AchievementProgress;
};

export type UserStats = {
  user: {
    id: string;
    name: string;
    email: string;
    xp: number;
    level: number;
    levelName: string;
    streak: number;
    bestStreak: number;
    dailyGoal: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
    createdAt: string;
  } | null;
  performances: Array<{
    subject: string;
    topic: string;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    avgTimeSpent: number;
    lastPracticed: string;
  }>;
  totalQuestions: number;
  totalCorrect: number;
  accuracyRate: number;
  todayCount: number;
  dailyGoal: number;
  dueCount: number;
  masteredCount: number;
  daily: Array<{ date: string; total: number; correct: number; accuracy: number }>;
  weekHistory: Array<{ answeredAt: string; isCorrect: boolean; subject: string }>;
  achievements: UserAchievementItem[];
  unlockedCount: number;
  totalAchievements: number;
};

/**
 * Cache em nível de módulo: Sidebar, Header, Dashboard e Perfil montam na mesma
 * navegação, e sem isso cada um dispararia o próprio fetch de /api/performance.
 */
let cache: UserStats | null = null;
let inflight: Promise<UserStats> | null = null;
const subscribers = new Set<(s: UserStats | null) => void>();

async function load(): Promise<UserStats> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/api/performance')
      .then(async (res) => {
        if (!res.ok) throw new Error('Falha ao carregar estatísticas');
        const json = (await res.json()) as UserStats;
        cache = json;
        return json;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function publish(next: UserStats | null) {
  cache = next;
  subscribers.forEach((fn) => fn(next));
}

/** Invalida o cache (ex.: depois de responder uma questão) e notifica quem está montado. */
export function invalidateUserStats() {
  cache = null;
  subscribers.forEach((fn) => fn(null));
}

export function useUserStats() {
  const [data, setData] = useState<UserStats | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    subscribers.add(setData);

    if (!cache) {
      setLoading(true);
      load()
        .then((json) => {
          if (!active) return;
          setData(json);
          setError(null);
        })
        .catch((e: Error) => {
          if (!active) return;
          setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      setData(cache);
      setLoading(false);
    }

    return () => {
      active = false;
      subscribers.delete(setData);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/performance');
      if (!res.ok) throw new Error('Falha ao carregar estatísticas');
      publish((await res.json()) as UserStats);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refresh };
}
