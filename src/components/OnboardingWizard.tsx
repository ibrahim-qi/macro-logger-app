import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import Modal from './Modal';
import { SahhaMark } from './SahhaBrand';
import { supabase } from '../supabaseClient';
import {
  getGoalsOnboardingBody,
  getGoalsSavingButton,
  getGoalsUpdateButton,
  getMicIntroBody,
  getMicIntroCta,
  getNameSetupBody,
} from '../copy/experience';
import { hapticLight, hapticSuccess } from '../utils/haptics';

interface OnboardingWizardProps {
  session: Session;
  needsName: boolean;
  needsGoals: boolean;
  needsMicIntro: boolean;
  onSaveName: (name: string) => Promise<void>;
  onGoalsComplete: () => void;
  onMicComplete: () => void;
}

type WizardStep = 'name' | 'goals' | 'mic';

function parseGoalNumber(
  raw: string,
  label: string,
  min: number,
  max: number,
  unitSuffix = '',
): number {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a number`);
  }
  if (value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}${unitSuffix}`);
  }
  return value;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  session,
  needsName,
  needsGoals,
  needsMicIntro,
  onSaveName,
  onGoalsComplete,
  onMicComplete,
}) => {
  const navigate = useNavigate();
  const step: WizardStep | null = needsName
    ? 'name'
    : needsGoals
      ? 'goals'
      : needsMicIntro
        ? 'mic'
        : null;

  const stepIndex = step === 'name' ? 0 : step === 'goals' ? 1 : step === 'mic' ? 2 : -1;

  const [name, setName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [calories, setCalories] = useState('2000');
  const [useDefaultMacros, setUseDefaultMacros] = useState(true);
  const [macros, setMacros] = useState({
    protein: '150',
    carbs: '250',
    fats: '65',
  });
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (step === 'name') return 'Welcome to Soha';
    if (step === 'goals') return 'Your daily targets';
    if (step === 'mic') return 'Meet the mic';
    return undefined;
  }, [step]);

  if (!step) return null;

  const handleNameSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('What should we call you?');
      return;
    }
    setNameLoading(true);
    setNameError(null);
    try {
      await onSaveName(trimmed);
    } catch (err: unknown) {
      setNameError(err instanceof Error ? err.message : 'Could not save your name.');
    } finally {
      setNameLoading(false);
    }
  };

  const handleGoalsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setGoalsSaving(true);
    setGoalsError(null);
    try {
      const dailyCalories = parseGoalNumber(calories, 'Calories', 500, 10_000);
      const protein = useDefaultMacros
        ? 150
        : parseGoalNumber(macros.protein, 'Protein', 0, 500, 'g');
      const carbs = useDefaultMacros
        ? 250
        : parseGoalNumber(macros.carbs, 'Carbs', 0, 1_000, 'g');
      const fats = useDefaultMacros
        ? 65
        : parseGoalNumber(macros.fats, 'Fats', 0, 300, 'g');

      const { error: upsertError } = await supabase
        .from('user_goals')
        .upsert(
          {
            user_id: session.user.id,
            daily_calories_goal: dailyCalories,
            daily_protein_goal: protein,
            daily_carbs_goal: carbs,
            daily_fats_goal: fats,
          },
          { onConflict: 'user_id' },
        );

      if (upsertError) throw upsertError;
      hapticSuccess();
      onGoalsComplete();
    } catch (err: unknown) {
      setGoalsError(err instanceof Error ? err.message : 'Could not save your targets.');
    } finally {
      setGoalsSaving(false);
    }
  };

  const handleTryMic = () => {
    hapticLight();
    onMicComplete();
    navigate('/log');
  };

  return (
    <Modal isOpen onClose={() => {}} title={title} variant="sheet-compact">
      <div className="onboard">
        <div className="onboard__progress" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={`onboard__dot ${index <= stepIndex ? 'onboard__dot--active' : ''} ${index === stepIndex ? 'onboard__dot--current' : ''}`}
            />
          ))}
        </div>

        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="onboard__form">
            <p className="onboard__body">{getNameSetupBody()}</p>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your first name"
              autoComplete="given-name"
              autoFocus
              className="input-premium"
            />
            {nameError && <div className="alert-error">{nameError}</div>}
            <button type="submit" disabled={nameLoading} className="btn-primary w-full">
              {nameLoading ? 'Saving…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'goals' && (
          <form onSubmit={handleGoalsSubmit} className="onboard__form">
            <p className="onboard__body">{getGoalsOnboardingBody()}</p>
            <label htmlFor="onboard_calories" className="form-label">Daily calories</label>
            <input
              id="onboard_calories"
              type="number"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              required
              min={500}
              max={10000}
              step={50}
              className="input-premium text-macro-calories"
            />
            <label className="onboard__check">
              <input
                type="checkbox"
                checked={useDefaultMacros}
                onChange={(event) => setUseDefaultMacros(event.target.checked)}
              />
              <span>Use balanced macro defaults</span>
            </label>
            {!useDefaultMacros && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="onboard_protein" className="form-label-sm text-macro-protein">Protein</label>
                  <input
                    id="onboard_protein"
                    type="number"
                    value={macros.protein}
                    onChange={(event) => setMacros((prev) => ({ ...prev, protein: event.target.value }))}
                    className="input-premium"
                  />
                </div>
                <div>
                  <label htmlFor="onboard_carbs" className="form-label-sm text-macro-carbs">Carbs</label>
                  <input
                    id="onboard_carbs"
                    type="number"
                    value={macros.carbs}
                    onChange={(event) => setMacros((prev) => ({ ...prev, carbs: event.target.value }))}
                    className="input-premium"
                  />
                </div>
                <div>
                  <label htmlFor="onboard_fats" className="form-label-sm text-macro-fats">Fats</label>
                  <input
                    id="onboard_fats"
                    type="number"
                    value={macros.fats}
                    onChange={(event) => setMacros((prev) => ({ ...prev, fats: event.target.value }))}
                    className="input-premium"
                  />
                </div>
              </div>
            )}
            {goalsError && <div className="alert-error">{goalsError}</div>}
            <button type="submit" disabled={goalsSaving} className="btn-primary w-full">
              {goalsSaving ? getGoalsSavingButton() : getGoalsUpdateButton()}
            </button>
          </form>
        )}

        {step === 'mic' && (
          <div className="onboard__mic">
            <div className="onboard__orb" aria-hidden="true">
              <span className="onboard__orb-ring" />
              <SahhaMark className="brand-mark--header-lg onboard__orb-mark" glow />
            </div>
            <p className="onboard__body">{getMicIntroBody()}</p>
            <button type="button" onClick={handleTryMic} className="btn-primary w-full">
              {getMicIntroCta()}
            </button>
            <button
              type="button"
              onClick={onMicComplete}
              className="btn-ghost w-full py-3 text-[var(--color-text-muted)]"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default OnboardingWizard;
