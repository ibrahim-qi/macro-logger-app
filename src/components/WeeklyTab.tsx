import React from 'react';
import { Link } from 'react-router-dom';
import MacroStatGrid from './MacroStatGrid';
import LoadingState from './LoadingState';
import { SahhaMark } from './SahhaBrand';
import { getStatsEmptyBody, getStatsEmptyCta, getStatsEmptyTitle, getTabLoadingLabel } from '../copy/experience';

interface SummaryData {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  entry_count: number;
  days_logged: number;
  week_start_display?: string;
  week_end_display?: string;
}

interface WeeklyTabProps {
  data: SummaryData | null;
  previousData: SummaryData | null;
  loading: boolean;
  isActive: boolean;
  isCurrentWeek: () => boolean;
  changeWeek: (offset: number) => void;
}

const WeeklyTab: React.FC<WeeklyTabProps> = ({
  data,
  previousData,
  loading,
  isActive,
  isCurrentWeek,
  changeWeek,
}) => {
  let displayTitle = 'This week';
  if (data) {
    const weekStart = data.week_start_display ? new Date(data.week_start_display + 'T00:00:00') : null;
    const weekEnd = data.week_end_display ? new Date(data.week_end_display + 'T00:00:00') : null;
    if (weekStart && weekEnd) {
      displayTitle = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
  }

  return (
    <div className={`transition-all duration-300 ease-out space-y-6 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => changeWeek(-1)} className="stats-nav-btn" aria-label="Previous week">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h3 className="type-card-title">{displayTitle}</h3>
          <p className="section-label mt-1">Weekly</p>
        </div>

        <button type="button" onClick={() => changeWeek(1)} disabled={isCurrentWeek()} className="stats-nav-btn" aria-label="Next week">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="card-elevated p-6">
        {loading ? (
          <LoadingState
            compact
            showMark={false}
            label={getTabLoadingLabel('weekly')}
            sublabel="Summarising your logged meals"
          />
        ) : !data || data.entry_count === 0 ? (
          <div className="stats-empty">
            <div className="stats-empty__icon">
              <SahhaMark className="brand-mark--header-lg" />
            </div>
            <h3 className="stats-empty__title">{getStatsEmptyTitle()}</h3>
            <p className="stats-empty__body">{getStatsEmptyBody()}</p>
            <Link to="/log" className="btn-primary max-w-[14rem] mx-auto mt-4">
              {getStatsEmptyCta()}
            </Link>
          </div>
        ) : (
          <div>
            {data.days_logged > 0 && (
              <div className="stats-hero">
                <p className="stats-hero-num tabular-nums">
                  {Math.round(data.total_calories / data.days_logged)}
                </p>
                <p className="stats-hero-label">avg cal / day</p>
                <p className="stats-hero-meta">
                  {data.days_logged} {data.days_logged === 1 ? 'day' : 'days'} logged · {Math.round(data.total_calories)} total
                </p>
              </div>
            )}

            <MacroStatGrid
              size="lg"
              showTrend
              values={{
                calories: data.total_calories,
                protein: data.total_protein,
                carbs: data.total_carbs,
                fats: data.total_fats,
              }}
              previousValues={previousData ? {
                calories: previousData.total_calories,
                protein: previousData.total_protein,
                carbs: previousData.total_carbs,
                fats: previousData.total_fats,
              } : null}
            />

            {data.days_logged > 0 && (
              <div className="stats-divider mt-6">
                <div className="text-center mb-4">
                  <div className="stats-avg-label">
                    Daily averages
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="macro-stat macro-stat--protein">
                    <div className="macro-stat__value macro-stat__value--sm">
                      {(data.total_protein / data.days_logged).toFixed(1)}g
                    </div>
                    <div className="macro-stat__label">Protein/day</div>
                  </div>
                  <div className="macro-stat macro-stat--carbs">
                    <div className="macro-stat__value macro-stat__value--sm">
                      {(data.total_carbs / data.days_logged).toFixed(1)}g
                    </div>
                    <div className="macro-stat__label">Carbs/day</div>
                  </div>
                  <div className="macro-stat macro-stat--fats">
                    <div className="macro-stat__value macro-stat__value--sm">
                      {(data.total_fats / data.days_logged).toFixed(1)}g
                    </div>
                    <div className="macro-stat__label">Fats/day</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyTab;
