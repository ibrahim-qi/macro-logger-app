import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Modal from './Modal';
import MacroLine from './MacroLine';
import type { ParsedFoodItem, ParseMealResponse, ParseProgressState } from '../types/mealParse';
import type { DayContext } from '../hooks/useDayContext';
import { sumItemMacros } from '../utils/mealTotals';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { getReviewHint, getResearchTrustLine, getParseErrorTitle, getRejectionTitle, getTranscriptCorrectLabel, getTranscriptReparseConfirm, isLongParseTranscript } from '../copy/experience';
import type { ParseErrorKind, ParseRejectionCode } from '../utils/parseRejection.ts';
import { useUserExperience } from '../context/userExperience';
import { upsertSavedFoods } from '../utils/savedFoods';
import { localDayBounds, createTimestampForDate } from '../utils/localDate';
import { useCountUp } from '../hooks/useCountUp';
import {
  extractReferenceAmount,
  formatServingLabel,
  servingWeightPresets,
  scaleItemByReferenceAmount,
} from '../utils/servingWeight';
import MealParseLoading from './MealParseLoading';
import TranscriptCorrectBlock from './TranscriptCorrectBlock';

type ParseMode = 'voice' | 'text';

interface MealParseReviewProps {
  session: Session;
  isOpen: boolean;
  loading?: boolean;
  parseMode?: ParseMode;
  transcript?: string | null;
  parseProgress?: ParseProgressState | null;
  parseError?: string | null;
  parseErrorKind?: ParseErrorKind;
  parseRejectionReason?: ParseRejectionCode;
  result: ParseMealResponse | null;
  selectedDate: Date;
  dayContext?: DayContext | null;
  onClose: () => void;
  onLogged: () => void;
  onRetry?: (text: string) => void;
  onRetryVoice?: () => void;
  /** Abort in-flight parse and restart from corrected transcript (skip STT). */
  onCorrectTranscript?: (text: string) => void;
}

interface UserGoals {
  daily_calories_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fats_goal: number;
}

const QUANTITY_STEP = 0.5;
const QUANTITY_MIN = 0.5;
const LOADER_EXIT_MS = 380;

type ReviewItem = ParsedFoodItem & { id: string; from_saved_food?: boolean };

function toReviewItems(items: ParsedFoodItem[]): ReviewItem[] {
  return items.map((item) => ({ ...item, id: crypto.randomUUID() }));
}

function shouldAutoVerify(item: ParsedFoodItem): boolean {
  return item.confidence === 'high'
    || item.evidence_status === 'uk_evidence'
    || item.evidence_status === 'user_saved';
}

function requiresManualReview(item: ParsedFoodItem): boolean {
  if (item.evidence_status === 'unavailable') return true;
  return item.calories === 0 && item.protein === 0 && item.carbs === 0 && item.fats === 0;
}

function userAdjustedProvenance(): Pick<ParsedFoodItem, 'from_saved_food' | 'evidence_status' | 'source_note' | 'source_title' | 'source_url'> {
  return {
    from_saved_food: false,
    evidence_status: 'ai_estimate',
    source_note: 'Adjusted by user',
    source_title: 'Adjusted by user',
    source_url: undefined,
  };
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function provenanceLabel(item: ParsedFoodItem): string | null {
  switch (item.evidence_status) {
    case 'uk_evidence': return item.source_title ? `UK evidence · ${item.source_title}` : 'UK evidence';
    case 'user_saved': return 'Your saved food';
    case 'ai_estimate': return 'AI estimate';
    case 'unavailable': return 'Nutrition unavailable';
    default: return null;
  }
}

const MealParseReview: React.FC<MealParseReviewProps> = ({
  session,
  isOpen,
  loading = false,
  parseMode = 'voice',
  transcript,
  parseProgress,
  parseError,
  parseErrorKind = 'failure',
  parseRejectionReason,
  result,
  selectedDate,
  dayContext,
  onClose,
  onLogged,
  onRetry,
  onRetryVoice,
  onCorrectTranscript,
}) => {
  const navigate = useNavigate();
  const { experience, timezone } = useUserExperience();
  const [items, setItems] = useState<ReviewItem[]>(() => toReviewItems(result?.items ?? []));
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [rememberIds, setRememberIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [servingEditId, setServingEditId] = useState<string | null>(null);
  const [toolsExpandedId, setToolsExpandedId] = useState<string | null>(null);
  const [customGrams, setCustomGrams] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [userGoals, setUserGoals] = useState<UserGoals | null>(null);
  const [dayCalories, setDayCalories] = useState(0);
  const [loadingVisible, setLoadingVisible] = useState(loading);
  const [contentReady, setContentReady] = useState(!loading && Boolean(result));
  const [retryDraft, setRetryDraft] = useState('');
  const [userTouched, setUserTouched] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const lastTranscriptRef = useRef<string | null>(null);

  const scrollToRow = (id: string) => {
    document.getElementById(`meal-review-row-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const pulseRow = (id: string) => {
    const row = document.getElementById(`meal-review-row-${id}`);
    if (!row) return;
    row.classList.add('meal-review-row--pulse');
    window.setTimeout(() => row.classList.remove('meal-review-row--pulse'), 650);
  };

  const scrollToFirstUnverified = () => {
    const first = items.find((item) => !verified.has(item.id));
    if (!first) return;
    scrollToRow(first.id);
    pulseRow(first.id);
  };

  useEffect(() => {
    if (parseError) {
      setRetryDraft(transcript?.trim() ?? '');
    }
  }, [parseError, transcript]);

  useEffect(() => {
    if (loading) {
      setLoadingVisible(true);
      setContentReady(false);
      return;
    }

    if (result) {
      setContentReady(true);
      const timer = window.setTimeout(() => {
        setLoadingVisible(false);
      }, LOADER_EXIT_MS);
      return () => window.clearTimeout(timer);
    }

    setLoadingVisible(false);
    setContentReady(false);
  }, [loading, result]);

  useEffect(() => {
    if (!result) return;
    const reviewItems = toReviewItems(result.items ?? []);
    setItems(reviewItems);
    setError(null);
    setVerified(new Set(reviewItems.filter(shouldAutoVerify).map((item) => item.id)));
    setRememberIds(new Set());
    setEditingId(null);
    setOpenMenuId(null);
    setUserTouched(false);
  }, [result]);

  useEffect(() => {
    if (!editingId) return;
    const row = document.getElementById(`meal-review-row-${editingId}`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [editingId]);

  useEffect(() => {
    if (!loading) {
      lastTranscriptRef.current = null;
      return;
    }
    const trimmed = transcript?.trim();
    if (trimmed && trimmed !== lastTranscriptRef.current) {
      lastTranscriptRef.current = trimmed;
      hapticLight();
    }
  }, [transcript, loading]);

  useEffect(() => {
    if (wasLoadingRef.current && !loading && result) {
      hapticSuccess();
    }
    wasLoadingRef.current = loading;
  }, [loading, result]);

  useEffect(() => {
    if (dayContext) {
      setUserGoals(dayContext);
      setDayCalories(dayContext.dayCalories);
      return;
    }

    if (!isOpen) return;

    const fetchContext = async () => {
      const { dayStart, dayEnd } = localDayBounds(selectedDate, timezone);

      const [goalsRes, entriesRes] = await Promise.all([
        supabase
          .from('user_goals')
          .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('food_entries')
          .select('calories, quantity')
          .eq('user_id', session.user.id)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
      ]);

      if (goalsRes.data) setUserGoals(goalsRes.data);

      if (entriesRes.data) {
        const total = entriesRes.data.reduce(
          (acc, e) => acc + (e.calories || 0) * (e.quantity || 1),
          0,
        );
        setDayCalories(total);
      } else {
        setDayCalories(0);
      }
    };

    fetchContext();
  }, [isOpen, selectedDate, session.user.id, dayContext, timezone]);

  useEffect(() => {
    if (!openMenuId) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const totals = useMemo(() => sumItemMacros(items), [items]);
  const animatedCalories = useCountUp(Math.round(totals.calories), contentReady && !loading && Boolean(result));

  const unverifiedCount = items.filter((item) => !verified.has(item.id)).length;
  const allVerified = items.length > 0 && unverifiedCount === 0;

  const afterLogCalories = dayCalories + totals.calories;
  const calorieGoalPct = userGoals
    ? Math.min(100, (afterLogCalories / userGoals.daily_calories_goal) * 100)
    : 0;

  const markUnverified = (id: string) => {
    setVerified((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const updateItem = (id: string, patch: Partial<ParsedFoodItem>) => {
    setUserTouched(true);
    markUnverified(id);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              ...userAdjustedProvenance(),
            }
          : item,
      ),
    );
  };

  const adjustQuantity = (id: string, delta: number) => {
    hapticLight();
    setUserTouched(true);
    markUnverified(id);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = Math.max(QUANTITY_MIN, Math.round((item.quantity + delta) * 2) / 2);
        return { ...item, quantity: next, ...userAdjustedProvenance() };
      }),
    );
  };

  const openServingEdit = (item: ReviewItem) => {
    hapticLight();
    setServingEditId(item.id);
    setToolsExpandedId(item.id);
    setCustomGrams(String(extractReferenceAmount(item)?.value ?? ''));
    setEditingId(null);
    setOpenMenuId(null);
  };

  const applyServingWeight = (id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount < 10 || amount > 2000) return;
    hapticLight();
    setUserTouched(true);
    markUnverified(id);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return { ...scaleItemByReferenceAmount(item, Math.round(amount)), id: item.id };
      }),
    );
    setCustomGrams(String(Math.round(amount)));
  };

  const toggleVerified = (id: string) => {
    hapticLight();
    setUserTouched(true);
    setServingEditId((current) => (current === id ? null : current));
    setVerified((prev) => {
      const next = new Set(prev);
      const wasVerified = next.has(id);
      if (wasVerified) {
        next.delete(id);
        setRememberIds((remember) => {
          if (!remember.has(id)) return remember;
          const updated = new Set(remember);
          updated.delete(id);
          return updated;
        });
      } else {
        next.add(id);
        const nextUnverifiedId = items.find((item) => item.id !== id && !next.has(item.id))?.id;
        if (nextUnverifiedId) {
          window.setTimeout(() => scrollToRow(nextUnverifiedId), 0);
        }
      }
      return next;
    });
  };

  const handleRowMainActivate = (itemId: string, event?: React.MouseEvent | React.KeyboardEvent) => {
    if (event && 'target' in event) {
      const target = event.target as HTMLElement;
      if (target.closest('button, input, textarea, a, [role="menu"]')) return;
    }
    if (editingId === itemId) return;
    toggleVerified(itemId);
  };

  const toggleRemember = (id: string) => {
    hapticLight();
    setRememberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const verifyAllRemaining = () => {
    hapticSuccess();
    setUserTouched(true);
    setVerified((prev) => {
      const next = new Set(prev);
      items.forEach((item) => {
        if (!requiresManualReview(item)) next.add(item.id);
      });
      return next;
    });
  };

  const removeItem = (id: string) => {
    setUserTouched(true);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setVerified((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setEditingId((current) => (current === id ? null : current));
    setOpenMenuId(null);
  };

  const handleLogAll = async () => {
    if (items.length === 0 || !allVerified) return;
    setLogging(true);
    setError(null);
    try {
      const entries = items.map((item) => ({
        user_id: session.user.id,
        food_name: item.food_name,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        quantity: item.quantity,
        created_at: createTimestampForDate(selectedDate),
      }));
      const { error: insertError } = await supabase.from('food_entries').insert(entries);
      if (insertError) throw insertError;

      const foodsToRemember = items
        .filter((item) => rememberIds.has(item.id))
        .map((item) => ({
          food_name: item.food_name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
        }));

      if (foodsToRemember.length > 0) {
        await upsertSavedFoods(session.user.id, foodsToRemember);
      }

      hapticSuccess();
      const totalCalories = items.reduce(
        (sum, item) => sum + item.calories * item.quantity,
        0,
      );
      onLogged();
      onClose();
      navigate('/', {
        state: {
          logSuccess: {
            calories: totalCalories,
            loggedAt: Date.now(),
          },
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save entries');
    } finally {
      setLogging(false);
    }
  };

  const displayTranscript = transcript ?? result?.transcript ?? null;
  const showParseError = Boolean(parseError) && !loadingVisible;
  const loadingSheetVariant = loadingVisible && isLongParseTranscript(displayTranscript)
    ? 'sheet-compact-tall'
    : 'sheet-compact';
  const isRejection = parseErrorKind === 'rejection';
  const errorTranscript = (retryDraft.trim() || transcript?.trim() || '');
  const canCorrectErrorTranscript = Boolean(onRetry) && Boolean(errorTranscript) && (
    !isRejection || parseRejectionReason === 'no_meal_detected'
  );

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (loadingVisible) {
      onClose();
      return;
    }
    if (
      contentReady
      && result
      && userTouched
      && !window.confirm('Discard this meal review?')
    ) {
      return;
    }
    onClose();
  };

  const footer = showParseError ? (
    isRejection && parseRejectionReason === 'nothing_eaten' ? (
      <button type="button" onClick={handleDismiss} className="w-full btn-primary py-3">
        Done
      </button>
    ) : isRejection && parseRejectionReason === 'no_speech' ? (
      <div className="flex gap-3">
        <button type="button" onClick={handleDismiss} className="flex-1 btn-ghost py-3">
          Close
        </button>
        <button type="button" onClick={() => onRetryVoice?.()} className="flex-1 btn-primary py-3">
          Try again
        </button>
      </div>
    ) : (
      <button type="button" onClick={handleDismiss} className="w-full btn-ghost py-3">
        Close
      </button>
    )
  ) : loadingVisible ? (
    parseMode === 'voice' && onRetryVoice && displayTranscript?.trim() ? (
      <div className="parse-sheet-actions">
        <button type="button" onClick={handleDismiss} className="parse-sheet-cancel">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onRetryVoice()}
          className="parse-sheet-retake"
        >
          Retake
        </button>
      </div>
    ) : (
      <button type="button" onClick={handleDismiss} className="parse-sheet-cancel">
        Cancel
      </button>
    )
  ) : (
    <div className="meal-review-footer">
      {!allVerified && items.length > 0 && (
        <div className="meal-review-footer__summary" aria-live="polite">
          <span className="meal-review-footer__total tabular-nums">{Math.round(totals.calories)} cal</span>
          <span className="meal-review-footer__meta">
            {unverifiedCount > 0
              ? `${unverifiedCount} to confirm`
              : 'Ready to log'}
          </span>
        </div>
      )}
      <div className="meal-review-footer__actions">
        {!allVerified && unverifiedCount > 1 && (
          <button
            type="button"
            onClick={verifyAllRemaining}
            className="meal-review-footer__verify-all"
          >
            Verify all
          </button>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={handleDismiss} className="flex-1 btn-ghost py-3">
            Cancel
          </button>
          <button
            type="button"
            onClick={allVerified ? handleLogAll : scrollToFirstUnverified}
            disabled={logging || items.length === 0}
            className="flex-1 btn-primary"
          >
            {logging
              ? 'Saving…'
              : !allVerified
                ? `Verify ${unverifiedCount} item${unverifiedCount === 1 ? '' : 's'}`
                : `Log ${items.length} item${items.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      ariaLabel={loadingVisible ? 'Working on your meal' : undefined}
      variant={loadingVisible ? loadingSheetVariant : 'sheet'}
      footerTone={loadingVisible ? 'minimal' : 'default'}
      title={
        loadingVisible
          ? undefined
          : showParseError
            ? (isRejection ? getRejectionTitle() : getParseErrorTitle())
            : 'Verify your meal'
      }
      footer={footer}
    >
      <div className={`meal-review-stage ${loadingVisible ? 'meal-review-stage--loading' : ''} ${contentReady ? 'meal-review-stage--ready' : ''}`}>
        {loadingVisible && (
          <MealParseLoading
            transcript={displayTranscript}
            stage={parseProgress?.current ?? null}
            mode={parseMode}
            exiting={contentReady && !loading}
            onCorrectTranscript={onCorrectTranscript}
          />
        )}

        {contentReady && result && !loadingVisible && (
          <div className="meal-review-stage__content">
          <div className="meal-review-hero meal-review-hero--reveal">
            <p className="meal-review-hero__calories tabular-nums">{animatedCalories}</p>
            <p className="meal-review-hero__label">calories</p>
            <MacroLine
              protein={totals.protein}
              carbs={totals.carbs}
              fats={totals.fats}
              className="mt-2"
            />
          </div>

          {userGoals && (
            <div className="meal-review-goal">
              <div className="meal-review-goal__header">
                <span>After logging</span>
                <span className="tabular-nums">
                  {Math.round(afterLogCalories)} / {Math.round(userGoals.daily_calories_goal)} cal
                </span>
              </div>
              <div className="meal-review-goal__track" aria-hidden="true">
                <div
                  className="meal-review-goal__fill"
                  style={{ width: `${calorieGoalPct}%` }}
                />
              </div>
            </div>
          )}

          {displayTranscript && (
            <div className="meal-review-context">
              <TranscriptCorrectBlock
                transcript={displayTranscript}
                label="You said"
                canEdit={Boolean(onCorrectTranscript)}
                onCorrect={(text) => {
                  if (
                    userTouched
                    && !window.confirm(getTranscriptReparseConfirm())
                  ) {
                    return;
                  }
                  onCorrectTranscript?.(text);
                }}
                className="meal-review-context__correct"
              />
              {result.research_used && (
                <p className="meal-review-context__trust section-label">{getResearchTrustLine()}</p>
              )}
              {result.notes && (
                <p className="meal-review-context__notes">{result.notes}</p>
              )}
            </div>
          )}

          {!allVerified && items.length > 0 && (
            <p className="meal-review-hint">
              {getReviewHint(experience)}
            </p>
          )}

          {items.length > 0 && (
            <ul className="meal-review-list">
              {items.map((item, index) => {
                const qty = item.quantity || 1;
                const itemCalories = Math.round(item.calories * qty);
                const isVerified = verified.has(item.id);
                const isEditing = editingId === item.id;
                const isMenuOpen = openMenuId === item.id;
                const isUncertain = !isVerified && item.confidence === 'low';
                const referenceAmount = extractReferenceAmount(item);
                const servingLabel = formatServingLabel(item);
                const provenance = provenanceLabel(item);
                const canAdjustWeight = !isVerified && !isEditing && !item.from_saved_food && Boolean(referenceAmount);
                const isServingEditOpen = servingEditId === item.id;
                const toolsExpanded = toolsExpandedId === item.id || isEditing || isServingEditOpen;
                const showServing = !isVerified && !isEditing && Boolean(
                  servingLabel || referenceAmount || item.confidence === 'medium' || item.confidence === 'low',
                );

                return (
                  <li
                    key={item.id}
                    id={`meal-review-row-${item.id}`}
                    className={`meal-review-row meal-review-row--reveal ${isVerified ? 'meal-review-row--verified' : 'meal-review-row--pending'}${isUncertain ? ' meal-review-row--uncertain' : ''}${toolsExpanded ? ' meal-review-row--expanded' : ''}`}
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  >
                    <div
                      className={`meal-review-row__main ${!isEditing ? 'meal-review-row__main--tappable' : ''}`}
                      tabIndex={!isEditing ? 0 : undefined}
                      onClick={(event) => handleRowMainActivate(item.id, event)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleRowMainActivate(item.id, event);
                        }
                      }}
                      aria-label={!isVerified ? `Verify ${item.food_name}` : undefined}
                    >
                      <div className="meal-review-row__info">
                        <div className="meal-review-row__title">
                          <p className="meal-review-row__name capitalize">{item.food_name}</p>
                          {showServing && (
                            canAdjustWeight ? (
                              <button
                                type="button"
                                className={`meal-review-row__serving meal-review-row__serving--button ${isServingEditOpen ? 'meal-review-row__serving--open' : ''}`}
                                onClick={() => {
                                  if (isServingEditOpen) {
                                    setServingEditId(null);
                                    return;
                                  }
                                  openServingEdit(item);
                                }}
                                aria-expanded={isServingEditOpen}
                              >
                                {servingLabel ?? `${referenceAmount?.value}${referenceAmount?.unit}`}
                              </button>
                            ) : (
                              <span className="meal-review-row__serving meal-review-row__serving--vague">
                                {servingLabel ?? 'Estimated portion'}
                              </span>
                            )
                          )}
                        </div>
                        {isServingEditOpen && referenceAmount && (
                          <div className="meal-review-serving">
                            <p className="meal-review-serving__label">
                              {qty > 1 ? 'Adjust serving (per item)' : 'Adjust serving'}
                            </p>
                            <div className="meal-review-serving__presets">
                              {servingWeightPresets(referenceAmount.value).map((amount) => (
                                <button
                                  key={amount}
                                  type="button"
                                  className={`meal-review-serving__preset ${amount === referenceAmount.value ? 'meal-review-serving__preset--active' : ''}`}
                                  onClick={() => applyServingWeight(item.id, amount)}
                                >
                                  {amount}{referenceAmount.unit}
                                </button>
                              ))}
                            </div>
                            <div className="meal-review-serving__custom">
                              <input
                                type="number"
                                min={10}
                                max={2000}
                                inputMode="numeric"
                                value={customGrams}
                                onChange={(e) => setCustomGrams(e.target.value)}
                                className="input-premium meal-review-serving__input tabular-nums"
                                aria-label={`Custom ${referenceAmount.unit === 'ml' ? 'millilitres' : 'grams'}`}
                              />
                              <button
                                type="button"
                                className="meal-review-serving__apply"
                                onClick={() => applyServingWeight(item.id, Number(customGrams))}
                              >
                                Apply
                              </button>
                            </div>
                            {(item.portion_assumption || item.source_note || item.source_title) && (
                              <div className="meal-review-serving__trust">
                                {item.portion_assumption && (
                                  <p className="meal-review-serving__assumption">{item.portion_assumption}</p>
                                )}
                                {(item.source_note || item.source_title) && (
                                  item.source_url ? (
                                    <a
                                      href={item.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="meal-review-row__source"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {item.source_note || item.source_title}
                                    </a>
                                  ) : (
                                    <p className="meal-review-row__source">
                                      {item.source_note || item.source_title}
                                    </p>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {item.from_saved_food && !isEditing && (
                          <span className="meal-review-row__saved-badge">From your saved foods</span>
                        )}
                        {!isEditing && provenance && !item.from_saved_food && (
                          <div className="meal-review-row__provenance">
                            {item.source_url ? (
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="meal-review-row__source"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {provenance}
                              </a>
                            ) : (
                              <span className="meal-review-row__source">{provenance}</span>
                            )}
                            <MacroLine
                              protein={item.protein * qty}
                              carbs={item.carbs * qty}
                              fats={item.fats * qty}
                            />
                          </div>
                        )}
                        {(!provenance || item.from_saved_food) && !isEditing && (
                          <MacroLine
                            protein={item.protein * qty}
                            carbs={item.carbs * qty}
                            fats={item.fats * qty}
                          />
                        )}
                      </div>
                      <span className="meal-review-row__calories tabular-nums">{itemCalories} cal</span>
                    </div>

                    {isEditing && (
                      <div className="meal-review-edit">
                        <label className="meal-review-edit__field meal-review-edit__field--full">
                          <span className="meal-review-edit__label">Food</span>
                          <input
                            type="text"
                            value={item.food_name}
                            onChange={(e) => updateItem(item.id, { food_name: e.target.value })}
                            className="input-premium meal-review-edit__input"
                          />
                        </label>
                        <div className="meal-review-edit__grid">
                          <label className="meal-review-edit__field">
                            <span className="meal-review-edit__label">Cal</span>
                            <input
                              type="number"
                              min={0}
                              value={item.calories}
                              onChange={(e) => updateItem(item.id, { calories: parseNumber(e.target.value, item.calories) })}
                              className="input-premium meal-review-edit__input"
                            />
                          </label>
                          <label className="meal-review-edit__field">
                            <span className="meal-review-edit__label">Protein</span>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.protein}
                              onChange={(e) => updateItem(item.id, { protein: parseNumber(e.target.value, item.protein) })}
                              className="input-premium meal-review-edit__input"
                            />
                          </label>
                          <label className="meal-review-edit__field">
                            <span className="meal-review-edit__label">Carbs</span>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.carbs}
                              onChange={(e) => updateItem(item.id, { carbs: parseNumber(e.target.value, item.carbs) })}
                              className="input-premium meal-review-edit__input"
                            />
                          </label>
                          <label className="meal-review-edit__field">
                            <span className="meal-review-edit__label">Fats</span>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.fats}
                              onChange={(e) => updateItem(item.id, { fats: parseNumber(e.target.value, item.fats) })}
                              className="input-premium meal-review-edit__input"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="meal-review-edit__done"
                        >
                          Done adjusting
                        </button>
                      </div>
                    )}

                    <div className="meal-review-row__primary-actions">
                      <button
                        type="button"
                        onClick={() => toggleVerified(item.id)}
                        className={`meal-review-verify ${isVerified ? 'meal-review-verify--done' : ''}`}
                        aria-pressed={isVerified}
                      >
                        {isVerified ? (
                          <>
                            <svg className="meal-review-verify__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Verified
                          </>
                        ) : (
                          'Looks good'
                        )}
                      </button>
                      {!isVerified && (
                        <button
                          type="button"
                          className="meal-review-more"
                          aria-expanded={toolsExpanded}
                          onClick={() => {
                            setToolsExpandedId(toolsExpanded ? null : item.id);
                            if (toolsExpanded) {
                              setEditingId(null);
                              setServingEditId(null);
                              setOpenMenuId(null);
                            }
                          }}
                        >
                          {toolsExpanded ? 'Less' : 'More'}
                        </button>
                      )}
                    </div>

                    {toolsExpanded && !isVerified && (
                      <div className="meal-review-row__actions">
                        <div className="meal-review-stepper">
                          <button
                            type="button"
                            onClick={() => adjustQuantity(item.id, -QUANTITY_STEP)}
                            disabled={item.quantity <= QUANTITY_MIN}
                            className="quantity-stepper quantity-stepper--compact"
                            aria-label="Decrease portion"
                          >
                            −
                          </button>
                          <span className="meal-review-stepper__value tabular-nums">
                            {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustQuantity(item.id, QUANTITY_STEP)}
                            className="quantity-stepper quantity-stepper--compact"
                            aria-label="Increase portion"
                          >
                            +
                          </button>
                        </div>

                        <div className="meal-review-row__tools">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(isEditing ? null : item.id);
                              setServingEditId(null);
                              setOpenMenuId(null);
                              setToolsExpandedId(item.id);
                            }}
                            className="meal-review-tool-btn"
                          >
                            {isEditing ? 'Hide' : 'Adjust'}
                          </button>

                          <div className="meal-review-menu-wrap" ref={isMenuOpen ? menuRef : undefined}>
                            <button
                              type="button"
                              className="meal-review-menu-trigger"
                              onClick={() => setOpenMenuId(isMenuOpen ? null : item.id)}
                              aria-label="More options"
                              aria-expanded={isMenuOpen}
                            >
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="5" cy="12" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="19" cy="12" r="2" />
                              </svg>
                            </button>
                            {isMenuOpen && (
                              <div className="meal-review-menu" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="meal-review-menu__item meal-review-menu__item--danger"
                                  onClick={() => removeItem(item.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {isVerified && (
                      <label className="meal-review-remember">
                        <input
                          type="checkbox"
                          checked={rememberIds.has(item.id)}
                          onChange={() => toggleRemember(item.id)}
                          className="meal-review-remember__checkbox"
                        />
                        <span className="meal-review-remember__copy">
                          <span className="meal-review-remember__title">Save for next time</span>
                          <span className="meal-review-remember__hint">
                            Optional — only if you want {Math.round(item.calories)} cal every time you log this
                          </span>
                        </span>
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {error && (
            <p className="alert-error mt-4">{error}</p>
          )}
          </div>
        )}
      </div>

      {!loadingVisible && showParseError && (
        <div className="meal-review-retry">
          <p className={`meal-review-retry__error${isRejection ? ' meal-review-retry__error--calm' : ''}`}>
            {parseError}
          </p>
          {canCorrectErrorTranscript ? (
            <TranscriptCorrectBlock
              transcript={errorTranscript}
              label={getTranscriptCorrectLabel()}
              canEdit
              autoEdit={isRejection && parseRejectionReason === 'no_meal_detected'}
              onCorrect={(text) => {
                setRetryDraft(text);
                onRetry?.(text);
              }}
              className="meal-review-retry__correct"
            />
          ) : (
            !isRejection && (
              <p className="meal-review-retry__hint">Try the mic again or type your meal below.</p>
            )
          )}
        </div>
      )}
    </Modal>
  );
};

export default MealParseReview;
