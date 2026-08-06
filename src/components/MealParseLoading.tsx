import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getParseStageLabel,
  getParseStageSublabel,
  isLongParseTranscript,
} from '../copy/experience';
import type { ParseProgressStage } from '../types/mealParse';
import { useUserExperience } from '../context/userExperience';
import { SahhaMark } from './SahhaBrand';
import TranscriptCorrectBlock from './TranscriptCorrectBlock';

const MIN_HOLD_MS = 700;
const SUBLABEL_AFTER_MS = 8000;
const STAGES: Array<{ id: ParseProgressStage; label: string }> = [
  { id: 'transcribing', label: 'Listen' },
  { id: 'identifying', label: 'Foods' },
  { id: 'looking_up', label: 'Sources' },
  { id: 'estimating', label: 'Macros' },
];

interface MealParseLoadingProps {
  transcript: string | null;
  stage: ParseProgressStage | null;
  mode: 'voice' | 'text';
  exiting?: boolean;
  /** When set, transcript becomes editable; submit aborts stale parse and restarts from text. */
  onCorrectTranscript?: (text: string) => void;
}

const MealParseLoading: React.FC<MealParseLoadingProps> = ({
  transcript,
  stage,
  mode,
  exiting = false,
  onCorrectTranscript,
}) => {
  const { experience } = useUserExperience();
  const trimmedTranscript = transcript?.trim() ?? '';
  const hasTranscript = Boolean(trimmedTranscript);
  const isLongTranscript = isLongParseTranscript(trimmedTranscript);
  const canCorrect = Boolean(onCorrectTranscript) && hasTranscript && !exiting;
  const [editing, setEditing] = useState(false);

  const [displayStage, setDisplayStage] = useState<ParseProgressStage | null>(null);
  const [showSublabel, setShowSublabel] = useState(false);

  const displayStageRef = useRef<ParseProgressStage | null>(null);
  const displayedAtRef = useRef(0);
  const pendingStageRef = useRef<ParseProgressStage | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const sublabelTimerRef = useRef<number | null>(null);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const clearSublabelTimer = useCallback(() => {
    if (sublabelTimerRef.current !== null) {
      window.clearTimeout(sublabelTimerRef.current);
      sublabelTimerRef.current = null;
    }
  }, []);

  const scheduleSublabel = useCallback(() => {
    clearSublabelTimer();
    setShowSublabel(false);
    sublabelTimerRef.current = window.setTimeout(() => {
      setShowSublabel(true);
    }, SUBLABEL_AFTER_MS);
  }, [clearSublabelTimer]);

  const commitDisplayStage = useCallback((nextStage: ParseProgressStage | null) => {
    displayStageRef.current = nextStage;
    displayedAtRef.current = Date.now();
    setDisplayStage(nextStage);
    scheduleSublabel();
  }, [scheduleSublabel]);

  const tryAdvanceStage = useCallback(() => {
    clearHoldTimer();

    const pending = pendingStageRef.current;
    if (pending === null) return;

    const elapsed = Date.now() - displayedAtRef.current;
    if (displayStageRef.current !== null && elapsed < MIN_HOLD_MS) {
      holdTimerRef.current = window.setTimeout(tryAdvanceStage, MIN_HOLD_MS - elapsed);
      return;
    }

    pendingStageRef.current = null;
    commitDisplayStage(pending);

    if (pendingStageRef.current !== null) {
      tryAdvanceStage();
    }
  }, [clearHoldTimer, commitDisplayStage]);

  useEffect(() => {
    if (stage === null) {
      pendingStageRef.current = null;
      clearHoldTimer();
      if (mode === 'text') {
        commitDisplayStage(null);
      } else if (displayStageRef.current === null) {
        commitDisplayStage(null);
      }
      return;
    }

    if (stage === displayStageRef.current || stage === pendingStageRef.current) {
      return;
    }

    if (displayStageRef.current === null && pendingStageRef.current === null) {
      commitDisplayStage(stage);
      return;
    }

    const prevIndex = STAGES.findIndex((item) => item.id === displayStageRef.current);
    const nextIndex = STAGES.findIndex((item) => item.id === stage);
    if (prevIndex >= 0 && nextIndex >= 0 && nextIndex < prevIndex) {
      pendingStageRef.current = null;
      clearHoldTimer();
      commitDisplayStage(stage);
      return;
    }

    pendingStageRef.current = stage;
    tryAdvanceStage();
  }, [stage, mode, clearHoldTimer, commitDisplayStage, tryAdvanceStage]);

  useEffect(() => () => {
    clearHoldTimer();
    clearSublabelTimer();
  }, [clearHoldTimer, clearSublabelTimer]);

  useEffect(() => {
    if (!hasTranscript) setEditing(false);
  }, [hasTranscript]);

  const labelStage = displayStage ?? stage;
  const label = getParseStageLabel(labelStage, mode, experience.firstName);
  const sublabel = showSublabel ? getParseStageSublabel(labelStage) : null;
  // Step chips only before transcript arrives — label alone is enough afterward.
  const showSteps = !hasTranscript && !editing;
  const visibleStages = mode === 'text' ? STAGES.slice(1) : STAGES;
  const stageForSteps = labelStage && visibleStages.some((item) => item.id === labelStage)
    ? labelStage
    : visibleStages[0]?.id;
  const activeStageIndex = Math.max(
    0,
    visibleStages.findIndex((item) => item.id === stageForSteps),
  );

  return (
    <div
      className={[
        'parse-wait',
        hasTranscript ? 'parse-wait--heard' : '',
        isLongTranscript ? 'parse-wait--long' : '',
        editing ? 'parse-wait--editing' : '',
        exiting ? 'parse-wait--out' : '',
      ].filter(Boolean).join(' ')}
      aria-live="polite"
      aria-busy={!exiting}
    >
      {!hasTranscript && (
        <div className="parse-wait__stage" aria-hidden="true">
          <div className="parse-wait__glow" />
          <div className="parse-wait__ring parse-wait__ring--outer" />
          <SahhaMark className="brand-mark--header-lg parse-wait__mark" glow />
        </div>
      )}

      {hasTranscript && (
        <TranscriptCorrectBlock
          transcript={trimmedTranscript}
          label="We heard"
          canEdit={canCorrect}
          className="parse-wait__transcript"
          onEditingChange={setEditing}
          onCorrect={onCorrectTranscript}
        />
      )}

      {hasTranscript && !editing && (
        <div className="parse-wait__shimmer" aria-hidden="true" />
      )}

      {!editing && (
        <>
          <p key={label} className="parse-wait__stage-label">{label}</p>
          {sublabel && (
            <p className="parse-wait__stage-sublabel">{sublabel}</p>
          )}

          {showSteps && (
            <ol className="parse-wait__steps" aria-label="Meal analysis progress">
              {visibleStages.map((item, index) => (
                <li
                  key={item.id}
                  className={`parse-wait__step ${index < activeStageIndex ? 'parse-wait__step--done' : ''} ${index === activeStageIndex ? 'parse-wait__step--active' : ''}`}
                  aria-current={index === activeStageIndex ? 'step' : undefined}
                >
                  <span className="parse-wait__step-dot" aria-hidden="true">
                    {index < activeStageIndex ? '✓' : ''}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
};

export default MealParseLoading;
