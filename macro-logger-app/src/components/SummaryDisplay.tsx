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
    const disableNext = isCurrentPeriod();

    let displayTitle = titleBase;
    if(periodType === 'week') {
        const weekStart = data?.week_start_display ? new Date(data.week_start_display + 'T00:00:00') : null;
        const weekEnd = data?.week_end_display ? new Date(data.week_end_display + 'T00:00:00') : null;
        if(weekStart && weekEnd) {
            displayTitle = `${weekStart.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${weekEnd.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;
        } else {
            displayTitle = 'This Week';
        }
    }
    
    if(periodType === 'month') {
        displayTitle = data?.month_display || 'This Month';
    }

    return (
        <div className="mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
                {/* Clean Header */}
                <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-stone-25">
                    <button 
                        onClick={() => changePeriod(-1)} 
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                    >
                        <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    
                    <div className="text-center">
                        <h3 className="text-base font-medium text-stone-900">{displayTitle}</h3>
                        <p className="text-xs text-stone-500 mt-1">{periodType === 'week' ? 'Weekly' : 'Monthly'} Summary</p>
                    </div>
                    
                    <button 
                        onClick={() => changePeriod(1)} 
                        disabled={disableNext}
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors disabled:opacity-30"
                    >
                        <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-stone-500">Loading...</p>
                        </div>
                    ) : !data || data.entry_count === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-stone-400 mb-4">
                                <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <p className="text-sm text-stone-500">No data for this period</p>
                        </div>
                    ) : (
                        <div>
                            {/* Main Stats */}
                            <div className="grid grid-cols-2 gap-8 mb-6">
                                <div className="text-center">
                                    <div className="text-3xl font-light text-slate-700 mb-1">
                                        {data.total_calories.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-stone-500 uppercase tracking-wide">Total Calories</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-light text-stone-700 mb-1">
                                        {data.total_protein.toLocaleString()}g
                                    </div>
                                    <div className="text-xs text-stone-500 uppercase tracking-wide">Total Protein</div>
                                </div>
                            </div>

                            {/* Daily Average */}
                            {data.days_logged > 0 && (
                                <div className="pt-4 border-t border-stone-100">
                                    <div className="text-center">
                                        <div className="text-lg font-light text-stone-800">
                                            {(data.total_calories / data.days_logged).toFixed(0)} cal/day
                                        </div>
                                        <div className="text-xs text-stone-500 mt-1">
                                            Average across {data.days_logged} {data.days_logged === 1 ? 'day' : 'days'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
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
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-medium text-slate-700 text-center">Summary</h1>
        <p className="text-sm text-stone-500 text-center mt-1">Your nutrition overview</p>
      </div>
      
      {error && (
        <div className="text-center mb-8">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      
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
  );
};

export default SummaryDisplay; 