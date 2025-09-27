import React from 'react';
import CircularProgress from './CircularProgress';

interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface UserGoals {
  daily_calories_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fats_goal: number;
}

interface GoalsTabProps {
  dailyTotals: DailyTotals;
  userGoals: UserGoals | null;
  loading: boolean;
  selectedDate: Date;
  onGoalsClick: () => void;
  isActive: boolean;
}

const GoalsTab: React.FC<GoalsTabProps> = ({
  dailyTotals,
  userGoals,
  loading,
  selectedDate,
  onGoalsClick,
  isActive
}) => {
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

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  if (loading) {
    return (
      <div className={`
        transition-all duration-300 ease-out
        ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
      `}>
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700 mb-4"></div>
          <p className="text-sm text-stone-500">Loading your goals...</p>
        </div>
      </div>
    );
  }

  if (!userGoals) {
    return (
      <div className={`
        transition-all duration-300 ease-out
        ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
      `}>
        <div className="text-center py-16">
          <div className="text-stone-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-stone-700 mb-2">Set Your Goals</h3>
          <p className="text-sm text-stone-500 mb-6 max-w-xs mx-auto">
            Configure your daily macro targets to track your progress
          </p>
          <button
            onClick={onGoalsClick}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            Set Goals
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      space-y-6 transition-all duration-300 ease-out
      ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-700">
            {isToday ? "Today's Progress" : "Daily Progress"}
          </h3>
          <p className="text-sm text-stone-500 mt-1">
            {isToday ? 'Your macro targets' : selectedDate.toLocaleDateString()}
          </p>
        </div>
        
        <button
          onClick={onGoalsClick}
          className="p-2 text-stone-400 hover:text-slate-700 hover:bg-stone-100 rounded-full transition-all duration-200"
          aria-label="Adjust goals"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Main Progress Circles - Large and Centered */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-8">
        <div className="grid grid-cols-2 gap-8">
          {/* Calories */}
          <div className="flex justify-center">
            <CircularProgress
              percentage={getPercentage(dailyTotals.calories, userGoals.daily_calories_goal)}
              value={formatValue(dailyTotals.calories, 'calories')}
              label="Calories"
              color="calories"
              size={130}
            />
          </div>

          {/* Protein */}
          <div className="flex justify-center">
            <CircularProgress
              percentage={getPercentage(dailyTotals.protein, userGoals.daily_protein_goal)}
              value={formatValue(dailyTotals.protein, 'grams')}
              label="Protein"
              color="protein"
              size={130}
            />
          </div>

          {/* Carbs */}
          <div className="flex justify-center">
            <CircularProgress
              percentage={getPercentage(dailyTotals.carbs, userGoals.daily_carbs_goal)}
              value={formatValue(dailyTotals.carbs, 'grams')}
              label="Carbs"
              color="carbs"
              size={130}
            />
          </div>

          {/* Fats */}
          <div className="flex justify-center">
            <CircularProgress
              percentage={getPercentage(dailyTotals.fats, userGoals.daily_fats_goal)}
              value={formatValue(dailyTotals.fats, 'grams')}
              label="Fats"
              color="fats"
              size={130}
            />
          </div>
        </div>
      </div>

      {/* Goals Summary Card */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6">
        <div className="text-center space-y-4">
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">Daily Targets</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-stone-600">
                <span className="font-medium text-stone-900">{Math.round(userGoals.daily_calories_goal)}</span> calories
              </div>
              <div className="text-stone-600">
                <span className="font-medium text-stone-900">{userGoals.daily_protein_goal}g</span> protein
              </div>
              <div className="text-stone-600">
                <span className="font-medium text-stone-900">{userGoals.daily_carbs_goal}g</span> carbs
              </div>
              <div className="text-stone-600">
                <span className="font-medium text-stone-900">{userGoals.daily_fats_goal}g</span> fats
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-stone-100">
            <button
              onClick={onGoalsClick}
              className="text-sm text-slate-700 hover:text-slate-800 font-medium transition-colors"
            >
              Adjust Goals →
            </button>
          </div>
        </div>
      </div>


    </div>
  );
};

export default GoalsTab;
