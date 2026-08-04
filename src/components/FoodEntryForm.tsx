import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { formatLocalDateKey, createTimestampForDate } from '../utils/localDate';

interface FoodEntryFormProps {
  session: Session;
  compact?: boolean;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  seedFields?: FoodEntryFields | null;
  onSeedApplied?: () => void;
  hideDatePicker?: boolean;
}

interface FormData {
  food_name: string;
  calories: number | '';
  protein: number | '';
  carbs: number | '';
  fats: number | '';
  quantity: number;
}

export interface FoodEntryFields {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity?: number;
}

export interface FoodEntryFormHandle {
  setFields: (food: FoodEntryFields) => void;
  getSelectedDate: () => Date;
}

const labelClass = 'block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2';
const inputClass = 'input-premium text-base py-2.5';

const FoodEntryForm = forwardRef<FoodEntryFormHandle, FoodEntryFormProps>(({
  session,
  compact = false,
  selectedDate: controlledDate,
  onDateChange,
  seedFields,
  onSeedApplied,
  hideDatePicker = false,
}, ref) => {
  const [formData, setFormData] = useState<FormData>({
    food_name: '', calories: '', protein: '', carbs: '', fats: '', quantity: 1,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [internalDate, setInternalDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const selectedDate = controlledDate ?? internalDate;
  const setSelectedDate = (date: Date) => {
    if (onDateChange) onDateChange(date);
    else setInternalDate(date);
  };

  useEffect(() => {
    if (!seedFields) return;
    setFormData({
      food_name: seedFields.food_name,
      calories: seedFields.calories,
      protein: seedFields.protein,
      carbs: seedFields.carbs,
      fats: seedFields.fats,
      quantity: seedFields.quantity ?? 1,
    });
    onSeedApplied?.();
  }, [seedFields]);

  const formatDateForDisplay = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const formatDateForInput = (date: Date): string => formatLocalDateKey(date);

  useImperativeHandle(ref, () => ({
    setFields: (food) => {
      setFormData({
        food_name: food.food_name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        quantity: food.quantity ?? 1,
      });
    },
    getSelectedDate: () => selectedDate,
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!formData.food_name || formData.calories === '' || isNaN(Number(formData.calories))) {
      setMessage('Please enter a food name and valid calorie amount.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('food_entries').insert([{
        user_id: session.user.id,
        food_name: formData.food_name,
        calories: Number(formData.calories) || 0,
        protein: Number(formData.protein) || 0,
        carbs: Number(formData.carbs) || 0,
        fats: Number(formData.fats) || 0,
        quantity: Number(formData.quantity) || 1,
        created_at: createTimestampForDate(selectedDate),
      }]);
      if (error) throw error;
      setMessage('Entry added!');
      setFormData({ food_name: '', calories: '', protein: '', carbs: '', fats: '', quantity: 1 });
      if (!controlledDate) {
        setInternalDate(new Date());
      }
      setShowDatePicker(false);
    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to save'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <>
      <div className={compact ? 'pt-4' : ''}>
        {!compact && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-white">Manual entry</h1>
              <p className="text-sm text-zinc-500 mt-0.5">Log food yourself</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDatePicker(true)}
              className="btn-ghost text-sm"
            >
              {formatDateForDisplay(selectedDate)}
            </button>
          </div>
        )}

        {compact && !hideDatePicker && (
          <div className="flex justify-end mb-4">
            <button type="button" onClick={() => setShowDatePicker(true)} className="btn-ghost text-xs py-1.5">
              {formatDateForDisplay(selectedDate)}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="food_name" className={labelClass}>Food name</label>
            <input type="text" id="food_name" name="food_name" value={formData.food_name} onChange={handleChange} required placeholder="Chicken breast, rice…" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quantity" className={labelClass}>Qty</label>
              <input type="number" id="quantity" name="quantity" value={formData.quantity} onChange={handleChange} required min="0.01" step="0.01" inputMode="decimal" className={inputClass} />
            </div>
            <div>
              <label htmlFor="calories" className={labelClass}>Calories</label>
              <input type="number" id="calories" name="calories" value={formData.calories} onChange={handleChange} required min="0" inputMode="numeric" placeholder="200" className={inputClass} />
            </div>
          </div>

          <div>
            <p className={labelClass}>Macros <span className="normal-case tracking-normal font-normal text-zinc-600">(per serving)</span></p>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" id="protein" name="protein" value={formData.protein} onChange={handleChange} min="0" step="0.1" placeholder="P" aria-label="Protein" className={inputClass} />
              <input type="number" id="carbs" name="carbs" value={formData.carbs} onChange={handleChange} min="0" step="0.1" placeholder="C" aria-label="Carbs" className={inputClass} />
              <input type="number" id="fats" name="fats" value={formData.fats} onChange={handleChange} min="0" step="0.1" placeholder="F" aria-label="Fats" className={inputClass} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving…' : 'Add entry'}
          </button>
        </form>

        {message && (
          <div className={`mt-4 ${message.toLowerCase().includes('error') || message.includes('Please') ? 'alert-error' : 'alert-success'}`}>
            {message}
          </div>
        )}
      </div>

      {showDatePicker && (
        <div className="modal-overlay safe-x z-[110]" onClick={() => setShowDatePicker(false)}>
          <div className="modal-panel card-elevated p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Select date</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['Today', 'Yesterday'] as const).map((label) => {
                const isActive = formatDateForDisplay(selectedDate) === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (label === 'Today') setSelectedDate(new Date());
                      else { const y = new Date(); y.setDate(y.getDate() - 1); setSelectedDate(y); }
                      setShowDatePicker(false);
                    }}
                    className={`p-4 rounded-2xl border text-center transition-all ${
                      isActive ? 'border-[rgba(var(--color-accent-rgb),0.5)] bg-[rgba(var(--color-accent-rgb),0.1)] text-accent' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <div className="font-semibold">{label}</div>
                  </button>
                );
              })}
            </div>
            <input
              type="date"
              value={formatDateForInput(selectedDate)}
              onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
              className="input-premium mb-4"
            />
            <button type="button" onClick={() => setShowDatePicker(false)} className="btn-primary">Done</button>
          </div>
        </div>
      )}
    </>
  );
});

export default FoodEntryForm;
