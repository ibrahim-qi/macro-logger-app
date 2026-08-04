import React from 'react';
import LoadingState from './LoadingState';
import DayMetrics from './DayMetrics';
import { getTabLoadingLabel } from '../copy/experience';

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
  dailyTotals, userGoals, loading, selectedDate, onGoalsClick, isActive,
}) => {
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  if (loading) {
    return (
      <div className={isActive ? 'opacity-100' : 'opacity-0'}>
        <LoadingState
          compact
          label={getTabLoadingLabel('goals')}
          sublabel="Your daily nutrition targets"
        />
      </div>
    );
  }

  if (!userGoals) {
    return (
      <div className={`empty-panel ${isActive ? 'opacity-100' : 'opacity-0'}`}>
        <h3 className="empty-panel__title">Set your targets</h3>
        <p className="empty-panel__body">Daily calorie and macro goals help Sahha track your progress calmly, without pressure.</p>
        <button type="button" onClick={onGoalsClick} className="btn-primary max-w-[14rem] mx-auto">
          Set targets
        </button>
      </div>
    );
  }

  return (
    <div className={`goals-tab transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="goals-tab__header">
        <div>
          <p className="section-label">{isToday ? 'Today' : selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
          <h3 className="type-card-title mt-0.5">Your targets</h3>
        </div>
        <button type="button" onClick={onGoalsClick} className="goals-tab__settings" aria-label="Adjust targets">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>

      <DayMetrics dailyTotals={dailyTotals} userGoals={userGoals} variant="targets" />

      <button type="button" onClick={onGoalsClick} className="btn-ghost w-full py-3 mt-5">
        Adjust targets
      </button>
    </div>
  );
};

export default GoalsTab;
