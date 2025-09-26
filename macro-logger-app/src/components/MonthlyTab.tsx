import React from 'react';

// Update SummaryData type based on new SQL function returns
interface SummaryData {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  entry_count: number;
  days_logged: number;
  month_display?: string;      // Formatted string e.g., "January 2023"
}

// Trend Indicator Component
interface TrendIndicatorProps {
  value: number;
  previousValue: number;
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({ value, previousValue }) => {
  const percentChange = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0;
  const isUp = percentChange > 5;
  const isDown = percentChange < -5;
  const isNeutral = !isUp && !isDown;

  if (isNeutral || previousValue === 0) return null;

  return (
    <div className="flex items-center justify-center mt-1">
      <div className={`flex items-center text-xs font-medium ${
        isUp ? 'text-green-600' : isDown ? 'text-red-500' : 'text-stone-500'
      }`}>
        {isUp ? (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {Math.abs(percentChange).toFixed(0)}%
      </div>
    </div>
  );
};

interface MonthlyTabProps {
  data: SummaryData | null;
  previousData: SummaryData | null;
  loading: boolean;
  isActive: boolean;
  currentMonthDate: Date;
  isCurrentMonth: () => boolean;
  changeMonth: (offset: number) => void;
}

const MonthlyTab: React.FC<MonthlyTabProps> = ({
  data,
  previousData,
  loading,
  isActive,
  currentMonthDate,
  isCurrentMonth,
  changeMonth
}) => {
  const disableNext = isCurrentMonth();

  const displayTitle = data?.month_display || 'This Month';

  return (
    <div className={`
      transition-all duration-300 ease-out space-y-6
      ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
    `}>
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => changeMonth(-1)} 
          className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="text-center">
          <h3 className="text-lg font-medium text-slate-700">{displayTitle}</h3>
          <p className="text-sm text-stone-500 mt-1">Monthly Summary</p>
        </div>
        
        <button 
          onClick={() => changeMonth(1)} 
          disabled={disableNext}
          className="p-2 hover:bg-stone-100 rounded-full transition-colors disabled:opacity-30"
          aria-label="Next month"
        >
          <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-slate-700 mb-4"></div>
            <p className="text-sm text-stone-500">Loading monthly data...</p>
          </div>
        ) : !data || data.entry_count === 0 ? (
          <div className="text-center py-12">
            <div className="text-stone-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-stone-700 mb-2">No data for this month</h3>
            <p className="text-sm text-stone-500">Start logging your meals to see your monthly summary</p>
          </div>
        ) : (
          <div>
            {/* Main Stats - 4 Column Macro Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-light text-slate-700 mb-1">
                  {data.total_calories.toLocaleString()}
                </div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Calories</div>
                <TrendIndicator 
                  value={data.total_calories} 
                  previousValue={previousData?.total_calories || 0} 
                />
              </div>
              <div className="text-center">
                <div className="text-2xl font-light text-slate-700 mb-1">
                  {data.total_protein.toLocaleString()}g
                </div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Protein</div>
                <TrendIndicator 
                  value={data.total_protein} 
                  previousValue={previousData?.total_protein || 0} 
                />
              </div>
              <div className="text-center">
                <div className="text-2xl font-light text-slate-700 mb-1">
                  {data.total_carbs.toLocaleString()}g
                </div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Carbs</div>
                <TrendIndicator 
                  value={data.total_carbs} 
                  previousValue={previousData?.total_carbs || 0} 
                />
              </div>
              <div className="text-center">
                <div className="text-2xl font-light text-slate-700 mb-1">
                  {data.total_fats.toLocaleString()}g
                </div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Fats</div>
                <TrendIndicator 
                  value={data.total_fats} 
                  previousValue={previousData?.total_fats || 0} 
                />
              </div>
            </div>

            {/* Daily Averages */}
            {data.days_logged > 0 && (
              <div className="pt-6 border-t border-stone-100">
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-light text-stone-800">
                      {(data.total_calories / data.days_logged).toFixed(0)} cal/day
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                      Average across {data.days_logged} {data.days_logged === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                  
                  {/* Average Macros */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm font-light text-stone-800">
                        {(data.total_protein / data.days_logged).toFixed(1)}g
                      </div>
                      <div className="text-xs text-stone-500 uppercase tracking-wide">Protein/day</div>
                    </div>
                    <div>
                      <div className="text-sm font-light text-stone-800">
                        {(data.total_carbs / data.days_logged).toFixed(1)}g
                      </div>
                      <div className="text-xs text-stone-500 uppercase tracking-wide">Carbs/day</div>
                    </div>
                    <div>
                      <div className="text-sm font-light text-stone-800">
                        {(data.total_fats / data.days_logged).toFixed(1)}g
                      </div>
                      <div className="text-xs text-stone-500 uppercase tracking-wide">Fats/day</div>
                    </div>
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
