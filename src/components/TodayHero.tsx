import React from 'react';
import { Link } from 'react-router-dom';
import DayMetrics from './DayMetrics';
import { getGreeting, getNoGoalsHeroMessage, getSetTargetsCta, getTodayContextLine } from '../copy/experience';
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
  const contextLine = getTodayContextLine(experience);

  return (
    <section className="today-summary">
      <div className="today-summary__canopy" aria-hidden="true" />

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

      {contextLine && (
        <p className="today-summary__context">{contextLine}</p>
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

      <Link to="/log" className="today-summary__action">
        Log a meal
      </Link>
    </section>
  );
};

export default TodayHero;
