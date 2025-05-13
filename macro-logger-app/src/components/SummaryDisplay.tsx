import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';

// Update SummaryData type based on new SQL function returns
interface SummaryData {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  entry_count: number;
  days_logged: number;
  week_start_display?: string; // Date string YYYY-MM-DD
  week_end_display?: string;   // Date string YYYY-MM-DD
  month_display?: string;      // Formatted string e.g., "January 2023"
}

interface SummaryDisplayProps {
  session: Session;
}

// Helper function to format date as YYYY-MM-DD (Can be shared if needed)
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// --- SummaryCard Component (Extracted and Refined) ---
interface SummaryCardProps {
  titleBase: string;
  data: SummaryData | null;
  loading: boolean;
  periodType: 'week' | 'month';
  isCurrentPeriod: () => boolean;
  changePeriod: (offset: number) => void;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ titleBase, data, loading, periodType, isCurrentPeriod, changePeriod }) => {
    const cardBaseClasses = "p-4 sm:p-5 border border-gray-200/80 rounded-xl shadow-md bg-white";
    const titleClasses = "text-base sm:text-lg font-semibold text-blue-700 mb-1 text-center mx-2 flex-grow";
    const navButtonClasses = "p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40 disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1";

    let displayTitle = titleBase;
    const disableNext = isCurrentPeriod();

    if(periodType === 'week') {
        const weekStart = data?.week_start_display ? new Date(data.week_start_display + 'T00:00:00') : null;
        const weekEnd = data?.week_end_display ? new Date(data.week_end_display + 'T00:00:00') : null;
        if(weekStart && weekEnd) {
            displayTitle = `Week: ${weekStart.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${weekEnd.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;
        } else if (!loading && data) { // Show default week title only if data is loaded but dates are missing
            displayTitle = 'Weekly Summary';
        } else if (!loading && !data) {
            displayTitle = 'Weekly: (No Data)';
        }
    }
    
    if(periodType === 'month') {
        displayTitle = data?.month_display || (loading ? titleBase : 'Monthly: (No Data)');
    }

    return (
        <div className={`${cardBaseClasses} flex flex-col min-h-[300px]`}> 
             <div className="flex justify-between items-center mb-3 sm:mb-4">
                 <button onClick={() => changePeriod(-1)} className={navButtonClasses}>
                     <span className="material-icons-outlined text-xl">chevron_left</span>
                 </button>
                 <h3 className={titleClasses}>{displayTitle}</h3>
                 <button 
                    onClick={() => changePeriod(1)} 
                    disabled={disableNext} 
                    className={navButtonClasses}
                 >
                     <span className="material-icons-outlined text-xl">chevron_right</span>
                 </button>
            </div>

            <div className="flex-grow flex flex-col justify-center"> 
                {loading ? (
                    <p className="text-center text-gray-500 py-10">Loading...</p>
                ) : !data || data.entry_count === 0 ? (
                    <div className="text-center text-gray-400 py-10 px-4">
                        <span className="material-icons-outlined text-4xl mb-2 opacity-70">upcoming</span>
                        <p className="text-sm font-medium text-gray-500">No entries recorded</p>
                        <p className="text-xs text-gray-400">Log some food to see your summary here.</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-200/80">
                            <h4 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider mb-1.5 sm:mb-2">Totals</h4>
                            <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-1 text-sm">
                                <span>Calories:</span> <span className="font-semibold text-gray-800 text-right">{data.total_calories.toLocaleString()}</span>
                                <span>Protein:</span> <span className="font-semibold text-gray-800 text-right">{data.total_protein.toLocaleString()} g</span>
                                <span>Carbs:</span> <span className="font-semibold text-gray-800 text-right">{data.total_carbs.toLocaleString()} g</span>
                                <span>Fats:</span> <span className="font-semibold text-gray-800 text-right">{data.total_fats.toLocaleString()} g</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider mb-1.5 sm:mb-2">Daily Averages</h4>
                            <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-1 text-sm">
                                {data.days_logged > 0 ? (
                                    <>
                                        <span>Calories:</span> <span className="font-semibold text-gray-800 text-right">{(data.total_calories / data.days_logged).toFixed(0)}</span>
                                        <span>Protein:</span> <span className="font-semibold text-gray-800 text-right">{(data.total_protein / data.days_logged).toFixed(1)} g</span>
                                        <span>Carbs:</span> <span className="font-semibold text-gray-800 text-right">{(data.total_carbs / data.days_logged).toFixed(1)} g</span>
                                        <span>Fats:</span> <span className="font-semibold text-gray-800 text-right">{(data.total_fats / data.days_logged).toFixed(1)} g</span>
                                    </>
                                ) : (
                                    <span className="col-span-2 text-center text-gray-400 text-xs">No entries to average.</span>
                                )}
                             </div>
                             <p className="text-xs text-gray-400 mt-2 sm:mt-3 text-center">Based on {data.days_logged} {data.days_logged === 1 ? 'day' : 'days'} with entries.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ session }) => {
  const [weeklySummary, setWeeklySummary] = useState<SummaryData | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<SummaryData | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const fetchSummaries = useCallback(async (weekTargetDate: Date, monthTargetDate: Date) => {
    // Reset loading states for each fetch attempt for individual cards
    setLoadingWeekly(true);
    setLoadingMonthly(true);
    setError(null);

    const weekDateStr = formatDate(weekTargetDate);
    const monthYear = monthTargetDate.getFullYear();
    const monthNum = monthTargetDate.getMonth() + 1;

    // Fetch weekly summary
    try {
      const { data: weeklyData, error: weeklyError } = await supabase.rpc(
        'get_weekly_summary',
        { p_user_id: session.user.id, p_target_date: weekDateStr }
      );
      if (weeklyError) throw new Error(`Weekly Summary: ${weeklyError.message}`);
      setWeeklySummary(weeklyData && weeklyData.length > 0 ? weeklyData[0] : { entry_count: 0, days_logged: 0, total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0 });
    } catch (err: any) {
      console.error('Error fetching weekly summary:', err);
      setError(prevError => prevError ? `${prevError}; ${err.message}` : err.message);
      setWeeklySummary(null);
    } finally {
      setLoadingWeekly(false);
    }

    // Fetch monthly summary
    try {
        const { data: monthlyData, error: monthlyError } = await supabase.rpc(
          'get_monthly_summary',
          { p_user_id: session.user.id, p_year: monthYear, p_month: monthNum }
        );
        if (monthlyError) throw new Error(`Monthly Summary: ${monthlyError.message}`);
        setMonthlySummary(monthlyData && monthlyData.length > 0 ? monthlyData[0] : { entry_count: 0, days_logged: 0, total_calories: 0, total_protein: 0, total_carbs: 0, total_fats: 0 });
    } catch (err: any) {
        console.error('Error fetching monthly summary:', err);
        setError(prevError => prevError ? `${prevError}; ${err.message}` : err.message);
        setMonthlySummary(null);
    } finally {
        setLoadingMonthly(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    if (session) {
      fetchSummaries(currentWeekDate, currentMonthDate);
    }
  }, [session, currentWeekDate, currentMonthDate, fetchSummaries]);

  const changeWeek = (offset: number) => {
    setCurrentWeekDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + offset * 7);
      return newDate;
    });
  };

  const changeMonth = (offset: number) => {
    setCurrentMonthDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const isCurrentWeek = useCallback(() => {
    const today = new Date();
    const startOfThisWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const tempCurrentWeekDate = new Date(currentWeekDate); // Create a new date object to avoid mutating state
    const startOfTargetWeek = new Date(tempCurrentWeekDate.getFullYear(), tempCurrentWeekDate.getMonth(), tempCurrentWeekDate.getDate() - tempCurrentWeekDate.getDay());
    return startOfThisWeek.toDateString() === startOfTargetWeek.toDateString();
  }, [currentWeekDate]);

  const isCurrentMonth = useCallback(() => {
      const today = new Date();
      return today.getFullYear() === currentMonthDate.getFullYear() && today.getMonth() === currentMonthDate.getMonth();
  }, [currentMonthDate]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 text-center">Summaries</h2>
       {error && (
          <p className="text-center text-sm p-3 rounded-md border border-red-300 bg-red-100 text-red-800">
            Error: {error}
          </p>
        )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <SummaryCard 
          titleBase="Weekly Summary" 
          data={weeklySummary} 
          loading={loadingWeekly} 
          periodType='week'
          isCurrentPeriod={isCurrentWeek}
          changePeriod={(offset) => changeWeek(offset)}
        />
        <SummaryCard 
          titleBase="Monthly Summary" 
          data={monthlySummary} 
          loading={loadingMonthly} 
          periodType='month'
          isCurrentPeriod={isCurrentMonth}
          changePeriod={(offset) => changeMonth(offset)}
        />
      </div>
    </div>
  );
};

export default SummaryDisplay; 