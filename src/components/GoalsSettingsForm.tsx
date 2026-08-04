import React, { useCallback, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Modal from './Modal';
import LoadingState from './LoadingState';
import {
  getGoalsModalTitle,
  getGoalsSaveFailureMessage,
  getGoalsSavedMessage,
  getGoalsSavingButton,
  getGoalsUpdateButton,
  getTabLoadingLabel,
} from '../copy/experience';
import { hapticSuccess } from '../utils/haptics';

interface GoalsFormData {
  daily_calories_goal: string;
  daily_protein_goal: string;
  daily_carbs_goal: string;
  daily_fats_goal: string;
}

interface GoalsSettingsFormProps {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
  onGoalsUpdated?: () => void;
}

const GoalsSettingsForm: React.FC<GoalsSettingsFormProps> = ({
  session,
  isOpen,
  onClose,
  onGoalsUpdated,
}) => {
  const [formData, setFormData] = useState<GoalsFormData>({
    daily_calories_goal: '2000',
    daily_protein_goal: '150',
    daily_carbs_goal: '250',
    daily_fats_goal: '65',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const fetchCurrentGoals = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);

      const { data, error } = await supabase
        .from('user_goals')
        .select('daily_calories_goal, daily_protein_goal, daily_carbs_goal, daily_fats_goal')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') throw error;
      } else {
        setFormData({
          daily_calories_goal: data.daily_calories_goal.toString(),
          daily_protein_goal: data.daily_protein_goal.toString(),
          daily_carbs_goal: data.daily_carbs_goal.toString(),
          daily_fats_goal: data.daily_fats_goal.toString(),
        });
      }
    } catch (err: unknown) {
      console.error('Error fetching goals:', err);
      setMessage('Could not load your targets.');
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    if (isOpen) {
      fetchCurrentGoals();
    }
  }, [isOpen, fetchCurrentGoals]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage(null);

      const calories = parseFloat(formData.daily_calories_goal);
      const protein = parseFloat(formData.daily_protein_goal);
      const carbs = parseFloat(formData.daily_carbs_goal);
      const fats = parseFloat(formData.daily_fats_goal);

      if (calories < 500 || calories > 10000) throw new Error('Calories must be between 500 and 10,000');
      if (protein < 0 || protein > 500) throw new Error('Protein must be between 0 and 500g');
      if (carbs < 0 || carbs > 1000) throw new Error('Carbs must be between 0 and 1,000g');
      if (fats < 0 || fats > 300) throw new Error('Fats must be between 0 and 300g');

      const { error } = await supabase
        .from('user_goals')
        .upsert(
          {
            user_id: session.user.id,
            daily_calories_goal: calories,
            daily_protein_goal: protein,
            daily_carbs_goal: carbs,
            daily_fats_goal: fats,
          },
          { onConflict: 'user_id' },
        );

      if (error) throw error;

      hapticSuccess();
      setMessage(getGoalsSavedMessage());
      setMessageIsError(false);
      onGoalsUpdated?.();

      window.setTimeout(() => {
        onClose();
        setMessage(null);
      }, 1200);
    } catch (err: unknown) {
      console.error('Error saving goals:', err);
      setMessage(err instanceof Error ? err.message : getGoalsSaveFailureMessage());
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getGoalsModalTitle()}>
      {loading ? (
        <LoadingState
          compact
          showMark={false}
          label={getTabLoadingLabel('settings')}
        />
      ) : (
        <form onSubmit={handleSubmit} className="goals-form space-y-5">
          <div>
            <label htmlFor="daily_calories_goal" className="form-label">
              Daily calories
            </label>
            <input
              type="number"
              id="daily_calories_goal"
              name="daily_calories_goal"
              value={formData.daily_calories_goal}
              onChange={handleInputChange}
              required
              min="500"
              max="10000"
              step="50"
              placeholder="2000"
              className="input-premium text-macro-calories"
            />
            <p className="form-hint">Recommended: 1,800–2,500 calories</p>
          </div>

          <div>
            <p className="form-label">Macronutrient targets</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="daily_protein_goal" className="form-label-sm text-macro-protein">
                  Protein (g)
                </label>
                <input
                  type="number"
                  id="daily_protein_goal"
                  name="daily_protein_goal"
                  value={formData.daily_protein_goal}
                  onChange={handleInputChange}
                  required
                  min="0"
                  max="500"
                  step="5"
                  placeholder="150"
                  className="input-premium"
                />
              </div>
              <div>
                <label htmlFor="daily_carbs_goal" className="form-label-sm text-macro-carbs">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  id="daily_carbs_goal"
                  name="daily_carbs_goal"
                  value={formData.daily_carbs_goal}
                  onChange={handleInputChange}
                  required
                  min="0"
                  max="1000"
                  step="10"
                  placeholder="250"
                  className="input-premium"
                />
              </div>
              <div>
                <label htmlFor="daily_fats_goal" className="form-label-sm text-macro-fats">
                  Fats (g)
                </label>
                <input
                  type="number"
                  id="daily_fats_goal"
                  name="daily_fats_goal"
                  value={formData.daily_fats_goal}
                  onChange={handleInputChange}
                  required
                  min="0"
                  max="300"
                  step="5"
                  placeholder="65"
                  className="input-premium"
                />
              </div>
            </div>
            <p className="form-hint mt-2">Typical ratios: 25% protein, 45% carbs, 30% fats</p>
          </div>

          {message && (
            <div className={messageIsError ? 'alert-error' : 'alert-success'}>
              {message}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? getGoalsSavingButton() : getGoalsUpdateButton()}
          </button>
        </form>
      )}
    </Modal>
  );
};

export default GoalsSettingsForm;
