import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import TabNavigation from './TabNavigation';
import WeeklyTab from './WeeklyTab';
import MonthlyTab from './MonthlyTab';

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

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ session }) => {
  const [weeklySummary, setWeeklySummary] = useState<SummaryData | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<SummaryData | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState('weekly');

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-medium text-slate-700 text-center">Summary</h1>
        <p className="text-sm text-stone-500 text-center mt-1">Your nutrition overview</p>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="text-center mb-6">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <TabNavigation
        tabs={[
          { id: 'weekly', label: 'Weekly' },
          { id: 'monthly', label: 'Monthly' }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-6"
      />

      {/* Tab Content */}
      <div className="relative">
        {activeTab === 'weekly' ? (
          <WeeklyTab
            data={weeklySummary}
            previousData={null} // Disabled until proper previous data fetching is implemented
            loading={loadingWeekly}
            isActive={true}
            currentWeekDate={currentWeekDate}
            isCurrentWeek={isCurrentWeek}
            changeWeek={changeWeek}
          />
        ) : (
          <MonthlyTab
            data={monthlySummary}
            previousData={null} // Disabled until proper previous data fetching is implemented
            loading={loadingMonthly}
            isActive={true}
            currentMonthDate={currentMonthDate}
            isCurrentMonth={isCurrentMonth}
            changeMonth={changeMonth}
          />
        )}
      </div>
    </div>
  );
};

export default SummaryDisplay;