import React, { useCallback, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import SavedFoodManager from '../components/SavedFoodManager';
import type { SavedFoodItem } from '../components/SavedFoodManager';
import MealParseInput from '../components/MealParseInput';
import type { MealParseInputHandle } from '../components/MealParseInput';
import MealParseReview from '../components/MealParseReview';
import LogHero from '../components/LogHero';
import { useDayContext } from '../hooks/useDayContext';
import { useUserExperience } from '../context/userExperience';
import { useToast } from '../context/toast';
import { getLogSuccessToast } from '../copy/experience';
import { supabase } from '../supabaseClient';
import { hapticSuccess, hapticLight } from '../utils/haptics';
import { createTimestampForDate } from '../utils/localDate';
import { invokeParseMeal, toParseErrorPayload } from '../utils/parseMeal';
import type { ParseMealResponse, ParseProgressState } from '../types/mealParse';
import type { ParseErrorPayload } from '../utils/parseRejection.ts';
import { advanceParseProgress } from '../utils/parseMeal';

interface LogPageProps {
  session: Session;
}

const LogPage: React.FC<LogPageProps> = ({ session }) => {
  const mealParseRef = useRef<MealParseInputHandle>(null);
  const retryAbortRef = useRef<AbortController | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewTranscript, setReviewTranscript] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseMealResponse | null>(null);
  const [parseError, setParseError] = useState<ParseErrorPayload | null>(null);
  const [logDate, setLogDate] = useState<Date>(new Date());
  const [showSaved, setShowSaved] = useState(false);
  const { refresh: refreshExperience, timezone } = useUserExperience();
  const dayContext = useDayContext(session, logDate, timezone);
  const { showToast } = useToast();

  const [parseMode, setParseMode] = useState<'voice' | 'text' | null>(null);
  const [parseProgress, setParseProgress] = useState<ParseProgressState | null>(null);

  const resetReview = useCallback(() => {
    retryAbortRef.current?.abort();
    retryAbortRef.current = null;
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
    setParseProgress(mode === 'voice' ? { current: 'transcribing' } : { current: 'identifying' });
  }, []);

  const handleTranscript = useCallback((transcript: string) => {
    setReviewTranscript(transcript);
    hapticLight();
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

  const handleParseError = useCallback((payload: ParseErrorPayload) => {
    setReviewLoading(false);
    setParseError(payload);
    setParseProgress(null);
    setReviewOpen(true);
    if (payload.kind === 'rejection') {
      hapticLight();
    }
  }, []);

  const handleParseRetry = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Abort any in-flight voice/text parse generation before restarting from text.
    mealParseRef.current?.cancel();
    setReviewLoading(true);
    setParseError(null);
    setParseResult(null);
    setReviewTranscript(trimmed);
    // Correction/retry always restarts from text and skips STT.
    setParseMode('text');
    setParseProgress({ current: 'identifying' });
    retryAbortRef.current?.abort();
    const controller = new AbortController();
    retryAbortRef.current = controller;

    try {
      const data = await invokeParseMeal(
        { text: trimmed },
        {
          onProgress: (stage) => {
            setParseProgress((prev) => advanceParseProgress(prev, stage));
          },
          signal: controller.signal,
        },
      );
      setParseResult(data);
      setReviewTranscript(data.transcript ?? trimmed);
      setParseError(null);
      setParseProgress(null);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setParseError(toParseErrorPayload(err));
      setParseProgress(null);
    } finally {
      if (retryAbortRef.current === controller) retryAbortRef.current = null;
      if (!controller.signal.aborted) setReviewLoading(false);
    }
  }, []);

  const handleCorrectTranscript = useCallback((text: string) => {
    void handleParseRetry(text);
  }, [handleParseRetry]);

  const handleVoiceRetry = useCallback(() => {
    resetReview();
    window.setTimeout(() => mealParseRef.current?.focusMic(), 0);
  }, [resetReview]);

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
      <div className="log-page__stage">
        <LogHero selectedDate={logDate} onDateChange={setLogDate} />

        <MealParseInput
          ref={mealParseRef}
          reviewActive={reviewOpen}
          onParseStart={handleParseStart}
          onTranscript={handleTranscript}
          onParseProgress={handleParseProgress}
          onParsed={handleParsed}
          onParseError={handleParseError}
        />
      </div>

      <section className={`log-secondary ${showSaved ? 'log-secondary--open' : ''}`} aria-label="Quick add">
        <button
          type="button"
          onClick={() => setShowSaved((v) => !v)}
          className="log-secondary__link"
          aria-expanded={showSaved}
        >
          {showSaved ? 'Hide saved foods' : 'Saved foods'}
        </button>
        {showSaved && (
          <div className="log-secondary__panel">
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
        parseError={parseError?.message ?? null}
        parseErrorKind={parseError?.kind}
        parseRejectionReason={parseError?.reason}
        result={parseResult}
        selectedDate={logDate}
        dayContext={dayContext}
        onClose={resetReview}
        onLogged={handleLogged}
        onRetry={handleParseRetry}
        onRetryVoice={handleVoiceRetry}
        onCorrectTranscript={handleCorrectTranscript}
      />
    </div>
  );
};

export default LogPage;
