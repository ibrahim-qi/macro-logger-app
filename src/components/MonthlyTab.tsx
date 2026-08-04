import React from 'react';
import { Link } from 'react-router-dom';
import MacroStatGrid from './MacroStatGrid';
import LoadingState from './LoadingState';
import { getStatsEmptyBody, getStatsEmptyCta, getStatsEmptyTitle, getTabLoadingLabel } from '../copy/experience';

interface SummaryData {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  entry_count: number;
  days_logged: number;
  month_display?: string;
}

interface MonthlyTabProps {
  data: SummaryData | null;
  previousData: SummaryData | null;
  loading: boolean;
  isActive: boolean;
  isCurrentMonth: () => boolean;
  changeMonth: (offset: number) => void;
}

const EmptyChartIcon = () => (
  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const MonthlyTab: React.FC<MonthlyTabProps> = ({
  data,
  previousData,
  loading,
  isActive,
  isCurrentMonth,
  changeMonth,
}) => {
  const displayTitle = data?.month_display || 'This month';

  return (
    <div className={`transition-all duration-300 ease-out space-y-6 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => changeMonth(-1)} className="stats-nav-btn" aria-label="Previous month">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h3 className="type-card-title">{displayTitle}</h3>
          <p className="section-label mt-1">Monthly</p>
        </div>

        <button type="button" onClick={() => changeMonth(1)} disabled={isCurrentMonth()} className="stats-nav-btn" aria-label="Next month">
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
            label={getTabLoadingLabel('monthly')}
            sublabel="Summarising your logged meals"
          />
        ) : !data || data.entry_count === 0 ? (
          <div className="stats-empty">
            <div className="stats-empty__icon"><EmptyChartIcon /></div>
            <h3 className="stats-empty__title">{getStatsEmptyTitle()}</h3>
            <p className="stats-empty__body">{getStatsEmptyBody()}</p>
            <Link to="/log" className="btn-primary max-w-[14rem] mx-auto mt-4">
              {getStatsEmptyCta()}
            </Link>
          </div>
        ) : (
          <div>
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
                  <div className="stats-avg-value text-macro-calories">
                    {(data.total_calories / data.days_logged).toFixed(0)} cal/day
                  </div>
                  <div className="stats-avg-label">
                    Average across {data.days_logged} {data.days_logged === 1 ? 'day' : 'days'}
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

export default MonthlyTab;
