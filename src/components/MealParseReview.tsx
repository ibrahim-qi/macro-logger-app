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
import { getParseLoadingLabel, getReviewHint, getReviewLoadingTitle } from '../copy/experience';
import { useUserExperience } from '../context/UserExperienceContext';
import { upsertSavedFoods } from '../utils/savedFoods';
import { localDayBounds, createTimestampForDate } from '../utils/localDate';
import { useCountUp } from '../hooks/useCountUp';
import MealParseLoading, { type ParseMode } from './MealParseLoading';

interface MealParseReviewProps {
  session: Session;
  isOpen: boolean;
  loading?: boolean;
  parseMode?: ParseMode;
  transcript?: string | null;
  parseProgress?: ParseProgressState | null;
  parseError?: string | null;
  result: ParseMealResponse | null;
  selectedDate: Date;
  dayContext?: DayContext | null;
  onClose: () => void;
  onLogged: () => void;
  onRetry?: (text: string) => void;
}

interface UserGoals {
  daily_calories_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fats_goal: number;
}

const QUANTITY_STEP = 0.5;
const QUANTITY_MIN = 0.5;

type ReviewItem = ParsedFoodItem & { id: string; from_saved_food?: boolean };

function toReviewItems(items: ParsedFoodItem[]): ReviewItem[] {
  return items.map((item) => ({ ...item, id: crypto.randomUUID() }));
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MealParseReview: React.FC<MealParseReviewProps> = ({
  session,
  isOpen,
  loading = false,
  parseMode = 'voice',
  transcript,
  parseProgress,
  parseError,
  result,
  selectedDate,
  dayContext,
  onClose,
  onLogged,
  onRetry,
}) => {
  const navigate = useNavigate();
  const { experience, timezone } = useUserExperience();
  const [items, setItems] = useState<ReviewItem[]>(() => toReviewItems(result?.items ?? []));
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [rememberIds, setRememberIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [userGoals, setUserGoals] = useState<UserGoals | null>(null);
  const [dayCalories, setDayCalories] = useState(0);
  const [itemsRevealed, setItemsRevealed] = useState(false);
  const [loadingVisible, setLoadingVisible] = useState(loading);
  const [contentReady, setContentReady] = useState(!loading && Boolean(result));
  const [retryDraft, setRetryDraft] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const lastTranscriptRef = useRef<string | null>(null);

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
      setLoadingVisible(false);
      return;
    }

    setLoadingVisible(false);
    setContentReady(false);
  }, [loading, result]);

  useEffect(() => {
    if (!result) return;
    setItems(toReviewItems(result.items ?? []));
    setError(null);
    setVerified(new Set());
    setRememberIds(new Set());
    setEditingId(null);
    setOpenMenuId(null);
    setItemsRevealed(false);
    const revealTimer = window.setTimeout(() => setItemsRevealed(true), 0);
    return () => window.clearTimeout(revealTimer);
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
    markUnverified(id);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch, from_saved_food: false } : item,
      ),
    );
  };

  const adjustQuantity = (id: string, delta: number) => {
    hapticLight();
    markUnverified(id);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = Math.max(QUANTITY_MIN, Math.round((item.quantity + delta) * 2) / 2);
        return { ...item, quantity: next, from_saved_food: false };
      }),
    );
  };

  const toggleVerified = (id: string) => {
    hapticLight();
    setVerified((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setRememberIds((remember) => {
          if (!remember.has(id)) return remember;
          const updated = new Set(remember);
          updated.delete(id);
          return updated;
        });
      } else {
        next.add(id);
      }
      return next;
    });
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

  const removeItem = (id: string) => {
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
  const loadingLabel = getParseLoadingLabel();
  const showParseError = Boolean(parseError) && !loadingVisible;
  const canRetryParse = Boolean(retryDraft.trim() && onRetry);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (loadingVisible) return;
    onClose();
  };

  const footer = showParseError ? (
    <div className="flex gap-3">
      <button type="button" onClick={onClose} className={`${canRetryParse ? 'flex-1' : 'w-full'} btn-ghost py-3`}>
        Close
      </button>
      {canRetryParse && (
        <button
          type="button"
          onClick={() => onRetry?.(retryDraft)}
          disabled={loading}
          className="flex-1 btn-primary"
        >
          {loading ? 'Retrying…' : 'Retry parse'}
        </button>
      )}
    </div>
  ) : loadingVisible ? (
    <div className="flex gap-3">
      <button type="button" onClick={onClose} className="flex-1 btn-ghost py-3">
        Cancel
      </button>
      <button type="button" disabled className="flex-1 btn-primary opacity-50">
        {loadingLabel}
      </button>
    </div>
  ) : (
    <div className="flex gap-3">
      <button type="button" onClick={onClose} className="flex-1 btn-ghost py-3">
        Cancel
      </button>
      <button
        type="button"
        onClick={handleLogAll}
        disabled={logging || items.length === 0 || !allVerified}
        className="flex-1 btn-primary"
      >
        {logging
          ? 'Saving…'
          : !allVerified
            ? `Verify ${unverifiedCount} item${unverifiedCount === 1 ? '' : 's'}`
            : `Log ${items.length} item${items.length === 1 ? '' : 's'}`}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      title={
        loadingVisible
          ? getReviewLoadingTitle()
          : showParseError
            ? 'Could not parse meal'
            : 'Verify your meal'
      }
      footer={footer}
      variant="sheet"
    >
      <div className={`meal-review-stage ${!contentReady ? 'meal-review-stage--busy' : ''}`}>
        {loadingVisible && (
          <div
            className={`meal-review-stage__loading ${contentReady ? 'meal-review-stage__loading--exit' : ''}`}
            aria-hidden={contentReady}
          >
            <MealParseLoading
              mode={parseMode}
              transcript={displayTranscript}
              progress={parseProgress}
              exiting={contentReady}
            />
          </div>
        )}

        {contentReady && result && (
          <div className={`meal-review-stage__content ${loadingVisible ? 'meal-review-stage__content--resolve' : ''}`}>
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
              <p className="meal-review-context__said">
                <span className="section-label">You said</span>
                <span className="meal-review-context__text">{displayTranscript}</span>
              </p>
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

                return (
                  <li
                    key={item.id}
                    id={`meal-review-row-${item.id}`}
                    className={`meal-review-row ${itemsRevealed ? 'meal-review-row--reveal' : ''} ${isVerified ? 'meal-review-row--verified' : 'meal-review-row--pending'}${isUncertain ? ' meal-review-row--uncertain' : ''}`}
                    style={{ animationDelay: `${index * 24}ms` }}
                  >
                    <div className="meal-review-row__main">
                      <div className="meal-review-row__info">
                        <p className="meal-review-row__name capitalize">{item.food_name}</p>
                        {item.from_saved_food && !isEditing && (
                          <span className="meal-review-row__saved-badge">From your saved foods</span>
                        )}
                        <MacroLine
                          protein={item.protein * qty}
                          carbs={item.carbs * qty}
                          fats={item.fats * qty}
                        />
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
                            setOpenMenuId(null);
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
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          </div>
        )}
      </div>

      {!loadingVisible && showParseError && (
        <div className="meal-review-retry">
          <p className="meal-review-retry__error">{parseError}</p>
          {canRetryParse ? (
            <label className="meal-review-retry__field">
              <span className="meal-review-retry__label">Edit what you said and retry</span>
              <textarea
                value={retryDraft}
                onChange={(e) => setRetryDraft(e.target.value)}
                rows={3}
                className="input-premium resize-none text-base w-full"
              />
            </label>
          ) : (
            <p className="meal-review-retry__hint">Try the mic again or type your meal below.</p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default MealParseReview;
