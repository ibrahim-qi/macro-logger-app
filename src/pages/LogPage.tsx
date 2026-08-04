import React, { useCallback, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import SavedFoodManager from '../components/SavedFoodManager';
import type { SavedFoodItem } from '../components/SavedFoodManager';
import MealParseInput from '../components/MealParseInput';
import type { MealParseInputHandle } from '../components/MealParseInput';
import MealParseReview from '../components/MealParseReview';
import LogHero from '../components/LogHero';
import { useDayContext } from '../hooks/useDayContext';
import { useUserExperience } from '../context/UserExperienceContext';
import { useToast } from '../context/ToastContext';
import { getLogSuccessToast } from '../copy/experience';
import { supabase } from '../supabaseClient';
import { hapticSuccess } from '../utils/haptics';
import { createTimestampForDate } from '../utils/localDate';
import { formatInvokeError, invokeParseMeal } from '../utils/parseMeal';
import type { ParseMealResponse, ParseProgressState } from '../types/mealParse';
import { advanceParseProgress } from '../utils/parseMeal';

interface LogPageProps {
  session: Session;
}

const LogPage: React.FC<LogPageProps> = ({ session }) => {
  const mealParseRef = useRef<MealParseInputHandle>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewTranscript, setReviewTranscript] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseMealResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [logDate, setLogDate] = useState<Date>(new Date());
  const [showSaved, setShowSaved] = useState(false);
  const { refresh: refreshExperience, timezone } = useUserExperience();
  const dayContext = useDayContext(session, logDate, timezone);
  const { showToast } = useToast();

  const [parseMode, setParseMode] = useState<'voice' | 'text' | null>(null);
  const [parseProgress, setParseProgress] = useState<ParseProgressState | null>(null);

  const resetReview = useCallback(() => {
    mealParseRef.current?.cancel();
    setReviewOpen(false);
    setReviewLoading(false);
    setReviewTranscript(null);
    setParseResult(null);
    setParseError(null);
    setParseMode(null);
    setParseProgress(null);
  }, []);

  const handleParseStart = useCallback(({ mode, previewText }: { mode: 'voice' | 'text'; previewText?: string }) => {
    setParseMode(mode);
    setReviewOpen(true);
    setReviewLoading(true);
    setParseResult(null);
    setParseError(null);
    setReviewTranscript(previewText ?? null);
    setParseProgress(mode === 'voice' ? { current: 'transcribing' } : null);
  }, []);

  const handleTranscript = useCallback((transcript: string) => {
    setReviewTranscript(transcript);
  }, []);

  const handleParseProgress = useCallback((stage: ParseProgressState['current']) => {
    setParseProgress((prev) => advanceParseProgress(prev, stage));
  }, []);

  const handleParsed = useCallback((result: ParseMealResponse) => {
    setParseResult(result);
    setReviewTranscript(result.transcript ?? null);
    setReviewLoading(false);
    setParseError(null);
    setParseProgress(null);
  }, []);

  const handleLogged = useCallback(() => {
    refreshExperience();
    resetReview();
  }, [refreshExperience, resetReview]);

  const handleParseError = useCallback((message: string) => {
    setReviewLoading(false);
    setParseError(message);
    setParseProgress(null);
    setReviewOpen(true);
  }, []);

  const handleParseRetry = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setReviewLoading(true);
    setParseError(null);
    setParseResult(null);
    setReviewTranscript(trimmed);

    try {
      const data = await invokeParseMeal({ text: trimmed });
      setParseResult(data);
      setReviewTranscript(data.transcript ?? trimmed);
      setParseError(null);
    } catch (err: unknown) {
      setParseError(formatInvokeError(err));
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const handleSavedFoodSelect = async (food: SavedFoodItem) => {
    const { error } = await supabase.from('food_entries').insert({
      user_id: session.user.id,
      food_name: food.food_name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
      quantity: 1,
      created_at: createTimestampForDate(logDate),
    });

    if (error) {
      showToast('Could not add that saved food. Try again.');
      return;
    }

    hapticSuccess();
    showToast(getLogSuccessToast(food.calories));
    setShowSaved(false);
    refreshExperience();
  };

  return (
    <div className="log-page">
      <LogHero selectedDate={logDate} onDateChange={setLogDate} />

      <MealParseInput
        ref={mealParseRef}
        onParseStart={handleParseStart}
        onTranscript={handleTranscript}
        onParseProgress={handleParseProgress}
        onParsed={handleParsed}
        onParseError={handleParseError}
      />

      <section className="log-secondary" aria-label="Quick add">
        <button
          type="button"
          onClick={() => setShowSaved((v) => !v)}
          className="log-secondary__trigger"
        >
          <div>
            <p className="section-label">Quick add</p>
            <p className="log-secondary__title">Saved foods</p>
          </div>
          <svg
            className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${showSaved ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showSaved && (
          <div className="px-5 pb-5 border-t border-[var(--color-border-soft)]">
            <SavedFoodManager session={session} onFoodSelect={handleSavedFoodSelect} />
          </div>
        )}
      </section>

      <MealParseReview
        session={session}
        isOpen={reviewOpen}
        loading={reviewLoading}
        parseMode={parseMode ?? 'voice'}
        transcript={reviewTranscript}
        parseProgress={parseProgress}
        parseError={parseError}
        result={parseResult}
        selectedDate={logDate}
        dayContext={dayContext}
        onClose={resetReview}
        onLogged={handleLogged}
        onRetry={handleParseRetry}
      />
    </div>
  );
};

export default LogPage;
