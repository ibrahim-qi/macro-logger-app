import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import CircularProgress from './CircularProgress';

interface UserGoals {
  daily_calories_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fats_goal: number;
}

interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface MacroGoalsCardProps {
  session: Session;
  dailyTotals: DailyTotals;
  selectedDate: Date;
  onGoalsClick?: () => void; // Optional callback to open settings
}

const MacroGoalsCard: React.FC<MacroGoalsCardProps> = ({ 
  session, 
  dailyTotals, 
  selectedDate,
  onGoalsClick 
}) => {
  const [userGoals, setUserGoals] = useState<UserGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user goals from database
  const fetchUserGoals = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('user_goals')
        .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No goals set yet - create default goals
          const { data: insertData, error: insertError } = await supabase
            .from('user_goals')
            .insert({
              user_id: session.user.id,
              daily_calories_goal: 2000,
              daily_protein_goal: 150,
              daily_carbs_goal: 250,
              daily_fats_goal: 65
            })
            .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
            .single();

          if (insertError) throw insertError;
          setUserGoals(insertData);
        } else {
          throw error;
        }
      } else {
        setUserGoals(data);
      }
    } catch (err: any) {
      console.error('Error fetching user goals:', err);
      setError('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchUserGoals();
    }
  }, [session]);

  // Calculate percentages
  const getPercentage = (current: number, goal: number): number => {
    return goal > 0 ? (current / goal) * 100 : 0;
  };

  // Format display values
  const formatValue = (value: number, type: 'calories' | 'grams'): string => {
    if (type === 'calories') {
      return `${Math.round(value)}`;
    }
    return `${value.toFixed(1)}g`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6 mb-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-slate-700"></div>
          <p className="text-sm text-stone-500 mt-2">Loading goals...</p>
        </div>
      </div>
    );
  }

  if (error || !userGoals) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6 mb-6">
        <div className="text-center py-8">
          <div className="text-stone-400 mb-4">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-stone-500 mb-3">Unable to load macro goals</p>
          <button
            onClick={fetchUserGoals}
            className="text-xs text-slate-700 hover:text-slate-800 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-medium text-slate-700">
            {isToday ? "Today's Progress" : "Daily Progress"}
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            {isToday ? 'Your macro targets' : selectedDate.toLocaleDateString()}
          </p>
        </div>
        
        {onGoalsClick && (
          <button
            onClick={onGoalsClick}
            className="p-2 text-stone-400 hover:text-slate-700 hover:bg-stone-100 rounded-full transition-colors"
            aria-label="Adjust goals"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress Circles - Compact Single Row */}
      <div className="grid grid-cols-4 gap-3">
        {/* Calories */}
        <div className="flex justify-center">
          <CircularProgress
            percentage={getPercentage(dailyTotals.calories, userGoals.daily_calories_goal)}
            value={formatValue(dailyTotals.calories, 'calories')}
            label="Calories"
            color="calories"
            size={80}
          />
        </div>

        {/* Protein */}
        <div className="flex justify-center">
          <CircularProgress
            percentage={getPercentage(dailyTotals.protein, userGoals.daily_protein_goal)}
            value={formatValue(dailyTotals.protein, 'grams')}
            label="Protein"
            color="protein"
            size={80}
          />
        </div>

        {/* Carbs */}
        <div className="flex justify-center">
          <CircularProgress
            percentage={getPercentage(dailyTotals.carbs, userGoals.daily_carbs_goal)}
            value={formatValue(dailyTotals.carbs, 'grams')}
            label="Carbs"
            color="carbs"
            size={80}
          />
        </div>

        {/* Fats */}
        <div className="flex justify-center">
          <CircularProgress
            percentage={getPercentage(dailyTotals.fats, userGoals.daily_fats_goal)}
            value={formatValue(dailyTotals.fats, 'grams')}
            label="Fats"
            color="fats"
            size={80}
          />
        </div>
      </div>

      {/* Goals Summary */}
      <div className="mt-6 pt-4 border-t border-stone-100">
        <div className="text-center">
          <div className="text-xs text-stone-500 mb-2">Daily Goals</div>
          <div className="text-xs text-stone-600 space-x-4">
            <span>{Math.round(userGoals.daily_calories_goal)} cal</span>
            <span>•</span>
            <span>{userGoals.daily_protein_goal}g protein</span>
            <span>•</span>
            <span>{userGoals.daily_carbs_goal}g carbs</span>
            <span>•</span>
            <span>{userGoals.daily_fats_goal}g fats</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MacroGoalsCard;
