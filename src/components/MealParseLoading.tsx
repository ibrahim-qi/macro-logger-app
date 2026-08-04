import React, { useEffect, useRef, useState } from 'react';
import { SahhaMark } from './SahhaBrand';
import { getParseLoadingProgress } from '../copy/experience';
import type { ParseProgressState } from '../types/mealParse';

export type ParseMode = 'voice' | 'text';

interface MealParseLoadingProps {
  mode: ParseMode;
  transcript: string | null;
  progress?: ParseProgressState | null;
  exiting?: boolean;
}

const MealParseLoading: React.FC<MealParseLoadingProps> = ({
  transcript,
  progress,
  exiting = false,
}) => {
  const hasTranscript = Boolean(transcript?.trim());
  const [displayFill, setDisplayFill] = useState(24);
  const prevStageRef = useRef<string | null>(null);

  const targetFill = getParseLoadingProgress(hasTranscript, progress?.current);

  useEffect(() => {
    const stage = progress?.current ?? null;
    if (stage === 'transcribing' && !hasTranscript && prevStageRef.current !== 'transcribing') {
      setDisplayFill(getParseLoadingProgress(false, 'transcribing'));
    }
    prevStageRef.current = stage;
  }, [progress?.current, hasTranscript]);

  useEffect(() => {
    setDisplayFill((prev) => Math.max(prev, targetFill));
  }, [targetFill]);

  useEffect(() => {
    if (hasTranscript) return;

    const creepTimer = window.setInterval(() => {
      setDisplayFill((prev) => Math.min(prev + 1, 42));
    }, 800);

    return () => window.clearInterval(creepTimer);
  }, [hasTranscript]);

  return (
    <div
      className={`parse-minimal ${exiting ? 'parse-minimal--out' : ''}`}
      aria-live="polite"
      aria-busy="true"
    >
      <SahhaMark className="brand-mark--header-md parse-minimal__mark" glow />

      {hasTranscript && (
        <p className="parse-minimal__quote">&ldquo;{transcript}&rdquo;</p>
      )}

      <div className="parse-minimal__track" aria-hidden="true">
        <div
          className="parse-minimal__fill"
          style={{ width: `${displayFill}%` }}
        />
      </div>
    </div>
  );
};

export default MealParseLoading;
