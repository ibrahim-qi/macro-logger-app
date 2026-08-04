import React, { useEffect, useRef, useState } from 'react';
import { SahhaMark } from './SahhaBrand';
import {
  getParseLoadingHeadline,
  getParseLoadingProgress,
  getParseLoadingSublabel,
} from '../copy/experience';
import type { ParseProgressState } from '../types/mealParse';

export type ParseMode = 'voice' | 'text';

interface MealParseLoadingProps {
  mode: ParseMode;
  transcript: string | null;
  progress?: ParseProgressState | null;
  exiting?: boolean;
}

const MealParseLoading: React.FC<MealParseLoadingProps> = ({
  mode,
  transcript,
  progress,
  exiting = false,
}) => {
  const hasTranscript = Boolean(transcript?.trim());
  const [slowParse, setSlowParse] = useState(false);
  const [scanRow, setScanRow] = useState(0);
  const [displayFill, setDisplayFill] = useState(36);
  const prevStageRef = useRef<string | null>(null);
  const discoveredRows = 2;

  const headline = getParseLoadingHeadline(hasTranscript, progress?.current);
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
      setDisplayFill((prev) => Math.min(prev + 1, 48));
    }, 700);

    return () => window.clearInterval(creepTimer);
  }, [hasTranscript]);

  useEffect(() => {
    setSlowParse(false);
    const slowMs = hasTranscript ? 5000 : 6000;
    const slowTimer = window.setTimeout(() => setSlowParse(true), slowMs);
    return () => window.clearTimeout(slowTimer);
  }, [hasTranscript, transcript]);

  useEffect(() => {
    if (!hasTranscript) return;

    const scanTimer = window.setInterval(() => {
      setScanRow((prev) => (prev + 1) % discoveredRows);
    }, 850);

    return () => clearInterval(scanTimer);
  }, [hasTranscript, discoveredRows]);

  if (!hasTranscript) {
    return (
      <div className="sahha-breakdown sahha-breakdown--wait" aria-live="polite" aria-busy="true">
        <SahhaMark className="brand-mark--header-md sahha-breakdown__mark" glow />
        <div className="brand-divider sahha-breakdown__divider" aria-hidden="true" />
        <p className="sahha-breakdown__stage">{headline}</p>
        <p className="sahha-breakdown__stage-sub">
          {getParseLoadingSublabel(mode, null, { slow: slowParse })}
        </p>
        <div className="sahha-breakdown__progress" aria-hidden="true">
          <div
            className="sahha-breakdown__progress-bar sahha-breakdown__progress-bar--determinate"
            style={{ width: `${displayFill}%` }}
          />
        </div>
        <span className="trust-badge sahha-breakdown__trust">Review before logging</span>
      </div>
    );
  }

  return (
    <div
      className={`sahha-breakdown sahha-breakdown--active ${exiting ? 'sahha-breakdown--out' : ''}`}
      aria-live="polite"
      aria-busy="true"
    >
      <p className="sahha-breakdown__stage sahha-breakdown__stage--active">{headline}</p>
      <p className="sahha-breakdown__stage-sub sahha-breakdown__stage-sub--active">
        {getParseLoadingSublabel(mode, transcript, { slow: slowParse })}
      </p>

      <blockquote className="sahha-breakdown__quote sahha-breakdown__quote--ready">
        <p className="sahha-breakdown__quote-text">&ldquo;{transcript}&rdquo;</p>
      </blockquote>

      <div className="sahha-breakdown__progress" aria-hidden="true">
        <div
          className="sahha-breakdown__progress-bar sahha-breakdown__progress-bar--determinate"
          style={{ width: `${displayFill}%` }}
        />
      </div>

      <div className="sahha-breakdown__body sahha-breakdown__body--in">
        <div className="sahha-breakdown__preview">
          <div className="sahha-breakdown__shimmer sahha-breakdown__shimmer--calories" />
          <p className="sahha-breakdown__cal-label">calories</p>
          <div className="sahha-breakdown__macro-row sahha-breakdown__macro-row--scan" aria-hidden="true">
            <span className="sahha-breakdown__macro sahha-breakdown__macro--protein">
              <span className="sahha-breakdown__macro-dot" />
              <span className="sahha-breakdown__shimmer sahha-breakdown__shimmer--macro" />
            </span>
            <span className="sahha-breakdown__macro sahha-breakdown__macro--carbs">
              <span className="sahha-breakdown__macro-dot" />
              <span className="sahha-breakdown__shimmer sahha-breakdown__shimmer--macro" />
            </span>
            <span className="sahha-breakdown__macro sahha-breakdown__macro--fats">
              <span className="sahha-breakdown__macro-dot" />
              <span className="sahha-breakdown__shimmer sahha-breakdown__shimmer--macro" />
            </span>
          </div>
        </div>

        <div className="sahha-breakdown__list-wrap">
          <span className="sahha-breakdown__scanline" aria-hidden="true" />
          <ul className="sahha-breakdown__list">
            {Array.from({ length: discoveredRows }, (_, i) => (
              <li
                key={i}
                className={`sahha-breakdown__row ${i === scanRow ? 'sahha-breakdown__row--scan' : ''}`}
              >
                <div className="sahha-breakdown__row-main">
                  <div className="sahha-breakdown__row-info">
                    <div
                      className="sahha-breakdown__shimmer sahha-breakdown__shimmer--name"
                      style={{ width: `${46 + (i % 3) * 14}%` }}
                    />
                    <div className="sahha-breakdown__macro-row sahha-breakdown__macro-row--sm">
                      <span className="sahha-breakdown__macro-dot sahha-breakdown__macro-dot--protein" />
                      <span className="sahha-breakdown__macro-dot sahha-breakdown__macro-dot--carbs" />
                      <span className="sahha-breakdown__macro-dot sahha-breakdown__macro-dot--fats" />
                      <span className="sahha-breakdown__shimmer sahha-breakdown__shimmer--detail" />
                    </div>
                  </div>
                  <div className="sahha-breakdown__shimmer sahha-breakdown__shimmer--cal" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MealParseLoading;
