import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ExperienceContext, UserGoals, UserProfile } from '../types/experience';
import { computeStreak, datesFromTimestamps } from '../utils/streak';
import {
  formatDateKey,
  getFirstName,
  getMealPeriod,
  getTimeOfDay,
} from '../utils/experience';
import { localDayBounds } from '../utils/localDate';
import { ensureProfile, fetchProfile, syncProfileTimezone, updateDisplayName } from '../utils/profile';
import { supabase } from '../supabaseClient';

interface UserExperienceValue {
  profile: UserProfile | null;
  experience: ExperienceContext;
  loading: boolean;
  needsName: boolean;
  needsGoals: boolean;
  needsMicIntro: boolean;
  refresh: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  completeMicIntro: () => void;
}

const MIC_INTRO_KEY = 'sahha_mic_intro';

const emptyTotals = { calories: 0, protein: 0, carbs: 0, fats: 0 };

const defaultExperience: ExperienceContext = {
  displayName: null,
  firstName: null,
  timeOfDay: getTimeOfDay(),
  mealPeriod: getMealPeriod(),
  goals: null,
  todayTotals: emptyTotals,
  entryCount: 0,
  streak: 0,
  caloriesRemaining: null,
  proteinRemaining: null,
  hasLoggedToday: false,
  weeklyDaysLogged: null,
};

const UserExperienceContext = createContext<UserExperienceValue | null>(null);

async function fetchGoals(userId: string): Promise<UserGoals | null> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function fetchTodayTotals(userId: string) {
  const { dayStart, dayEnd } = localDayBounds(new Date());

  const { data, error } = await supabase
    .from('food_entries')
    .select('calories, protein, carbs, fats, quantity')
    .eq('user_id', userId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if (error || !data) {
    return { totals: emptyTotals, entryCount: 0 };
  }

  const totals = data.reduce(
    (acc, entry) => {
      const q = entry.quantity || 1;
      acc.calories += (entry.calories || 0) * q;
      acc.protein += (entry.protein || 0) * q;
      acc.carbs += (entry.carbs || 0) * q;
      acc.fats += (entry.fats || 0) * q;
      return acc;
    },
    { ...emptyTotals },
  );

  return { totals, entryCount: data.length };
}

async function fetchStreak(userId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const { data, error } = await supabase
    .from('food_entries')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  if (error || !data) return 0;
  return computeStreak(datesFromTimestamps(data.map((row) => row.created_at)));
}

async function fetchWeeklyDaysLogged(userId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_weekly_summary', {
    p_user_id: userId,
    p_target_date: formatDateKey(),
  });

  if (error || !data?.length) return null;
  return data[0].days_logged ?? null;
}

function buildExperience(
  profile: UserProfile | null,
  goals: UserGoals | null,
  todayTotals: typeof emptyTotals,
  entryCount: number,
  streak: number,
  weeklyDaysLogged: number | null,
): ExperienceContext {
  const displayName = profile?.display_name ?? null;
  const firstName = getFirstName(displayName);
  const now = new Date();

  const caloriesRemaining = goals
    ? Math.max(0, goals.daily_calories_goal - todayTotals.calories)
    : null;
  const proteinRemaining = goals
    ? Math.max(0, goals.daily_protein_goal - todayTotals.protein)
    : null;

  return {
    displayName,
    firstName,
    timeOfDay: getTimeOfDay(now),
    mealPeriod: getMealPeriod(now),
    goals,
    todayTotals,
    entryCount,
    streak,
    caloriesRemaining,
    proteinRemaining,
    hasLoggedToday: entryCount > 0,
    weeklyDaysLogged,
  };
}

export function UserExperienceProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [experience, setExperience] = useState<ExperienceContext>(defaultExperience);
  const [loading, setLoading] = useState(true);
  const [micIntroDone, setMicIntroDone] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(MIC_INTRO_KEY) === '1',
  );

  const refresh = useCallback(async () => {
    const userId = session.user.id;

    const [
      profileRow,
      goals,
      today,
      streak,
      weeklyDaysLogged,
    ] = await Promise.all([
      fetchProfile(userId).then(async (row) => {
        const resolved = row ?? await ensureProfile(userId, session.user.email);
        if (resolved) {
          await syncProfileTimezone(userId);
        }
        return resolved;
      }),
      fetchGoals(userId),
      fetchTodayTotals(userId),
      fetchStreak(userId),
      fetchWeeklyDaysLogged(userId),
    ]);

    setProfile(profileRow);
    setExperience(buildExperience(
      profileRow,
      goals,
      today.totals,
      today.entryCount,
      streak,
      weeklyDaysLogged,
    ));
    setLoading(false);
  }, [session.user.email, session.user.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setDisplayName = useCallback(async (name: string) => {
    const updated = await updateDisplayName(session.user.id, name);
    if (updated) {
      setProfile(updated);
      setExperience((prev) => buildExperience(
        updated,
        prev.goals,
        prev.todayTotals,
        prev.entryCount,
        prev.streak,
        prev.weeklyDaysLogged,
      ));
    }
  }, [session.user.id]);

  const needsName = !loading && !profile?.display_name?.trim();
  const needsGoals = !loading && !needsName && !experience.goals;
  const needsMicIntro = !loading && !needsName && !needsGoals && !micIntroDone;

  const completeMicIntro = useCallback(() => {
    localStorage.setItem(MIC_INTRO_KEY, '1');
    setMicIntroDone(true);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      experience,
      loading,
      needsName,
      needsGoals,
      needsMicIntro,
      refresh,
      setDisplayName,
      completeMicIntro,
    }),
    [profile, experience, loading, needsName, needsGoals, needsMicIntro, refresh, setDisplayName, completeMicIntro],
  );

  return (
    <UserExperienceContext.Provider value={value}>
      {children}
    </UserExperienceContext.Provider>
  );
}

export function useUserExperience() {
  const ctx = useContext(UserExperienceContext);
  if (!ctx) {
    throw new Error('useUserExperience must be used within UserExperienceProvider');
  }
  return ctx;
}
