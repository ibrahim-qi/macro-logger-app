import React, { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import Modal from './Modal';
import { supabase } from '../supabaseClient';
import {
  getGoalsOnboardingBody,
  getGoalsOnboardingTitle,
  getGoalsSavingButton,
  getGoalsUpdateButton,
} from '../copy/experience';
import { hapticSuccess } from '../utils/haptics';

interface GoalsOnboardingModalProps {
  session: Session;
  isOpen: boolean;
  onComplete: () => void;
}

const GoalsOnboardingModal: React.FC<GoalsOnboardingModalProps> = ({
  session,
  isOpen,
  onComplete,
}) => {
  const [formData, setFormData] = useState({
    daily_calories_goal: '2000',
    daily_protein_goal: '150',
    daily_carbs_goal: '250',
    daily_fats_goal: '65',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const calories = parseFloat(formData.daily_calories_goal);
      const protein = parseFloat(formData.daily_protein_goal);
      const carbs = parseFloat(formData.daily_carbs_goal);
      const fats = parseFloat(formData.daily_fats_goal);

      if (calories < 500 || calories > 10000) throw new Error('Calories must be between 500 and 10,000');
      if (protein < 0 || protein > 500) throw new Error('Protein must be between 0 and 500g');
      if (carbs < 0 || carbs > 1000) throw new Error('Carbs must be between 0 and 1,000g');
      if (fats < 0 || fats > 300) throw new Error('Fats must be between 0 and 300g');

      const { error: upsertError } = await supabase
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

      if (upsertError) throw upsertError;

      hapticSuccess();
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your targets.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title={getGoalsOnboardingTitle()}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="type-body-sm text-[var(--color-text-secondary)] leading-relaxed">
          {getGoalsOnboardingBody()}
        </p>

        <div>
          <label htmlFor="onboard_calories" className="form-label">Daily calories</label>
          <input
            id="onboard_calories"
            type="number"
            value={formData.daily_calories_goal}
            onChange={(e) => setFormData((p) => ({ ...p, daily_calories_goal: e.target.value }))}
            required
            min="500"
            max="10000"
            step="50"
            className="input-premium text-macro-calories"
          />
          <p className="form-hint">Recommended: 1,800–2,500 calories</p>
        </div>

        <div>
          <p className="form-label">Macronutrient targets</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="onboard_protein" className="form-label-sm text-macro-protein">Protein (g)</label>
              <input
                id="onboard_protein"
                type="number"
                value={formData.daily_protein_goal}
                onChange={(e) => setFormData((p) => ({ ...p, daily_protein_goal: e.target.value }))}
                required
                min="0"
                max="500"
                step="5"
                className="input-premium"
              />
            </div>
            <div>
              <label htmlFor="onboard_carbs" className="form-label-sm text-macro-carbs">Carbs (g)</label>
              <input
                id="onboard_carbs"
                type="number"
                value={formData.daily_carbs_goal}
                onChange={(e) => setFormData((p) => ({ ...p, daily_carbs_goal: e.target.value }))}
                required
                min="0"
                max="1000"
                step="10"
                className="input-premium"
              />
            </div>
            <div>
              <label htmlFor="onboard_fats" className="form-label-sm text-macro-fats">Fats (g)</label>
              <input
                id="onboard_fats"
                type="number"
                value={formData.daily_fats_goal}
                onChange={(e) => setFormData((p) => ({ ...p, daily_fats_goal: e.target.value }))}
                required
                min="0"
                max="300"
                step="5"
                className="input-premium"
              />
            </div>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? getGoalsSavingButton() : getGoalsUpdateButton()}
        </button>
      </form>
    </Modal>
  );
};

export default GoalsOnboardingModal;
