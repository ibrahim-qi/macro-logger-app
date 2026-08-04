import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import TabNavigation from './TabNavigation';
import WeeklyTab from './WeeklyTab';
import MonthlyTab from './MonthlyTab';
import SummaryDisplayHeader from './SummaryDisplayHeader';
import { formatLocalDateKey } from '../utils/localDate';

interface SummaryData {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  entry_count: number;
  days_logged: number;
  week_start_display?: string;
  week_end_display?: string;
  month_display?: string;
}

interface SummaryDisplayProps {
  session: Session;
}

const formatDate = (date: Date): string => formatLocalDateKey(date);

const emptySummary: SummaryData = {
  entry_count: 0,
  days_logged: 0,
  total_calories: 0,
  total_protein: 0,
  total_carbs: 0,
  total_fats: 0,
};

const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ session }) => {
  const [weeklySummary, setWeeklySummary] = useState<SummaryData | null>(null);
  const [previousWeeklySummary, setPreviousWeeklySummary] = useState<SummaryData | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<SummaryData | null>(null);
  const [previousMonthlySummary, setPreviousMonthlySummary] = useState<SummaryData | null>(null);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('weekly');

  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  const fetchSummaries = useCallback(async (weekTargetDate: Date, monthTargetDate: Date) => {
    setLoadingWeekly(true);
    setLoadingMonthly(true);
    setError(null);

    const weekDateStr = formatDate(weekTargetDate);
    const prevWeekDate = new Date(weekTargetDate);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const prevWeekDateStr = formatDate(prevWeekDate);

    const monthYear = monthTargetDate.getFullYear();
    const monthNum = monthTargetDate.getMonth() + 1;
    const prevMonthDate = new Date(monthTargetDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonthYear = prevMonthDate.getFullYear();
    const prevMonthNum = prevMonthDate.getMonth() + 1;

    try {
      const [
        { data: weeklyData, error: weeklyError },
        { data: prevWeeklyData, error: prevWeeklyError },
      ] = await Promise.all([
        supabase.rpc('get_weekly_summary', { p_user_id: session.user.id, p_target_date: weekDateStr }),
        supabase.rpc('get_weekly_summary', { p_user_id: session.user.id, p_target_date: prevWeekDateStr }),
      ]);

      if (weeklyError) throw new Error(`Weekly Summary: ${weeklyError.message}`);
      if (prevWeeklyError) throw new Error(`Previous Week: ${prevWeeklyError.message}`);

      setWeeklySummary(weeklyData && weeklyData.length > 0 ? weeklyData[0] : { ...emptySummary });
      setPreviousWeeklySummary(
        prevWeeklyData && prevWeeklyData.length > 0 && prevWeeklyData[0].entry_count > 0
          ? prevWeeklyData[0]
          : null,
      );
    } catch (err: unknown) {
      console.error('Error fetching weekly summary:', err);
      const message = err instanceof Error ? err.message : 'Could not load weekly summary';
      setError((prev) => (prev ? `${prev}; ${message}` : message));
      setWeeklySummary(null);
      setPreviousWeeklySummary(null);
    } finally {
      setLoadingWeekly(false);
    }

    try {
      const [
        { data: monthlyData, error: monthlyError },
        { data: prevMonthlyData, error: prevMonthlyError },
      ] = await Promise.all([
        supabase.rpc('get_monthly_summary', { p_user_id: session.user.id, p_year: monthYear, p_month: monthNum }),
        supabase.rpc('get_monthly_summary', { p_user_id: session.user.id, p_year: prevMonthYear, p_month: prevMonthNum }),
      ]);

      if (monthlyError) throw new Error(`Monthly Summary: ${monthlyError.message}`);
      if (prevMonthlyError) throw new Error(`Previous Month: ${prevMonthlyError.message}`);

      setMonthlySummary(monthlyData && monthlyData.length > 0 ? monthlyData[0] : { ...emptySummary });
      setPreviousMonthlySummary(
        prevMonthlyData && prevMonthlyData.length > 0 && prevMonthlyData[0].entry_count > 0
          ? prevMonthlyData[0]
          : null,
      );
    } catch (err: unknown) {
      console.error('Error fetching monthly summary:', err);
      const message = err instanceof Error ? err.message : 'Could not load monthly summary';
      setError((prev) => (prev ? `${prev}; ${message}` : message));
      setMonthlySummary(null);
      setPreviousMonthlySummary(null);
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
    setCurrentWeekDate((prevDate) => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + offset * 7);
      return newDate;
    });
  };

  const changeMonth = (offset: number) => {
    setCurrentMonthDate((prevDate) => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const isCurrentWeek = useCallback(() => {
    const today = new Date();
    const startOfThisWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const tempCurrentWeekDate = new Date(currentWeekDate);
    const startOfTargetWeek = new Date(tempCurrentWeekDate.getFullYear(), tempCurrentWeekDate.getMonth(), tempCurrentWeekDate.getDate() - tempCurrentWeekDate.getDay());
    return startOfThisWeek.toDateString() === startOfTargetWeek.toDateString();
  }, [currentWeekDate]);

  const isCurrentMonth = useCallback(() => {
    const today = new Date();
    return today.getFullYear() === currentMonthDate.getFullYear() && today.getMonth() === currentMonthDate.getMonth();
  }, [currentMonthDate]);

  return (
    <div>
      <SummaryDisplayHeader weeklyDaysLogged={weeklySummary?.days_logged} />

      {error && (
        <div className="text-center mb-5">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      <TabNavigation
        tabs={[
          { id: 'weekly', label: 'Weekly' },
          { id: 'monthly', label: 'Monthly' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="segment-tabs--minimal"
      />

      <div className="relative">
        {activeTab === 'weekly' ? (
          <WeeklyTab
            data={weeklySummary}
            previousData={previousWeeklySummary}
            loading={loadingWeekly}
            isActive={true}
            isCurrentWeek={isCurrentWeek}
            changeWeek={changeWeek}
          />
        ) : (
          <MonthlyTab
            data={monthlySummary}
            previousData={previousMonthlySummary}
            loading={loadingMonthly}
            isActive={true}
            isCurrentMonth={isCurrentMonth}
            changeMonth={changeMonth}
          />
        )}
      </div>
    </div>
  );
};

export default SummaryDisplay;
