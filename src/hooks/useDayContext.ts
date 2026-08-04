import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { localDayBounds } from '../utils/localDate';

export interface DayContext {
  daily_calories_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fats_goal: number;
  dayCalories: number;
}

export function useDayContext(session: Session, selectedDate: Date, timeZone?: string) {
  const [context, setContext] = useState<DayContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchContext = async () => {
      const { dayStart, dayEnd } = localDayBounds(selectedDate, timeZone);

      const [goalsRes, entriesRes] = await Promise.all([
        supabase
          .from('user_goals')
          .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('food_entries')
          .select('calories, quantity')
          .eq('user_id', session.user.id)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
      ]);

      if (cancelled) return;

      const dayCalories = entriesRes.data
        ? entriesRes.data.reduce((acc, e) => acc + (e.calories || 0) * (e.quantity || 1), 0)
        : 0;

      if (goalsRes.data) {
        setContext({ ...goalsRes.data, dayCalories });
      } else {
        setContext(null);
      }
    };

    fetchContext();
    return () => { cancelled = true; };
  }, [session.user.id, selectedDate, timeZone]);

  return context;
}
