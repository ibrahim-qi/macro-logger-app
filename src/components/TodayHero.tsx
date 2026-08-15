import React from 'react';
import DayMetrics from './DayMetrics';
import { getGreeting, getNoGoalsHeroMessage, getSetTargetsCta } from '../copy/experience';
import { useUserExperience } from '../context/userExperience';

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

interface TodayHeroProps {
  dailyTotals: DailyTotals;
  userGoals: UserGoals | null;
  streak: number;
  onSetTargets?: () => void;
}

const TodayHero: React.FC<TodayHeroProps> = ({ dailyTotals, userGoals, streak, onSetTargets }) => {
  const { experience } = useUserExperience();

  return (
    <section className="today-summary">
      {userGoals ? (
        <DayMetrics dailyTotals={dailyTotals} userGoals={userGoals} variant="today" />
      ) : (
        <div className="today-summary__empty-block">
          <p className="today-summary__empty">{getNoGoalsHeroMessage()}</p>
          {onSetTargets && (
            <button type="button" onClick={onSetTargets} className="btn-primary today-summary__targets-btn">
              {getSetTargetsCta()}
            </button>
          )}
        </div>
      )}

      <p className="today-summary__whisper">
        {getGreeting(experience)}
        {streak > 1 && (
          <>
            <span className="today-summary__whisper-dot" aria-hidden="true">·</span>
            {streak}-day streak
          </>
        )}
      </p>
    </section>
  );
};

export default TodayHero;
