import React from 'react';

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

interface DayMetricsProps {
  dailyTotals: DailyTotals;
  userGoals: UserGoals;
  variant?: 'today' | 'targets';
}

const pct = (current: number, goal: number) => (goal > 0 ? Math.min(100, (current / goal) * 100) : 0);

const DayMetrics: React.FC<DayMetricsProps> = ({ dailyTotals, userGoals, variant = 'today' }) => {
  const calPct = pct(dailyTotals.calories, userGoals.daily_calories_goal);
  const remaining = Math.round(userGoals.daily_calories_goal - dailyTotals.calories);
  const goalReached = dailyTotals.calories >= userGoals.daily_calories_goal;

  const calMeta = variant === 'today'
    ? (goalReached ? 'Goal reached' : `${remaining.toLocaleString()} remaining`)
    : `${Math.round(userGoals.daily_calories_goal)} cal goal`;

  const calUnit = variant === 'today'
    ? 'cal'
    : `of ${Math.round(userGoals.daily_calories_goal)} cal`;

  const macros = [
    { key: 'protein', short: 'P', label: 'Protein', current: dailyTotals.protein, goal: userGoals.daily_protein_goal },
    { key: 'carbs', short: 'C', label: 'Carbs', current: dailyTotals.carbs, goal: userGoals.daily_carbs_goal },
    { key: 'fats', short: 'F', label: 'Fats', current: dailyTotals.fats, goal: userGoals.daily_fats_goal },
  ] as const;

  return (
    <div className={`day-metrics ${variant === 'today' ? 'day-metrics--today' : ''}`}>
      <div className="day-metrics__cal">
        <span className="day-metrics__cal-value">{Math.round(dailyTotals.calories).toLocaleString()}</span>
        <span className="day-metrics__cal-unit">{calUnit}</span>
        <div className="day-metrics__cal-bar" role="progressbar" aria-valuenow={calPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="day-metrics__cal-fill" style={{ width: `${calPct}%` }} />
        </div>
        <p className="day-metrics__cal-meta">{calMeta}</p>
      </div>

      {variant === 'today' ? (
        <div className="day-metrics__row" aria-label="Macros today">
          {macros.map(({ key, short, label, current }) => (
            <span key={key} className="day-metrics__stat" aria-label={`${label} ${Math.round(current)} grams`}>
              <span className={`day-metrics__stat-key day-metrics__stat-key--${key}`} aria-hidden="true">{short}</span>
              <span className="day-metrics__stat-val">{Math.round(current)}g</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="day-metrics__grid">
          {macros.map(({ key, label, current, goal }) => (
            <div key={key} className="day-metrics__cell">
              <div className="day-metrics__cell-head">
                <span className={`day-metrics__dot day-metrics__dot--${key}`} aria-hidden="true" />
                <span className="day-metrics__label">{label}</span>
              </div>
              <span className="day-metrics__value">
                {`${Math.round(current)}/${goal}g`}
              </span>
              <div className="day-metrics__track">
                <div
                  className={`day-metrics__fill day-metrics__fill--${key}`}
                  style={{ width: `${pct(current, goal)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DayMetrics;
