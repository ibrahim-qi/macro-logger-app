import React, { useEffect, useState } from 'react';
import { SahhaMark } from './SahhaBrand';
import { getParseLoadingSublabel, getParseStageLabel } from '../copy/experience';

export type ParseMode = 'voice' | 'text';

interface MealParseLoadingProps {
  mode: ParseMode;
  transcript: string | null;
  exiting?: boolean;
}

function TranscriptReveal({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);

  return (
    <p className="sahha-breakdown__quote-text">
      &ldquo;
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="sahha-breakdown__word"
          style={{ animationDelay: `${Math.min(index * 18, 360)}ms` }}
        >
          {word}
          {index < words.length - 1 ? '\u00a0' : ''}
        </span>
      ))}
      &rdquo;
    </p>
  );
}

const MealParseLoading: React.FC<MealParseLoadingProps> = ({ mode, transcript, exiting = false }) => {
  const hasTranscript = Boolean(transcript?.trim());
  const [discoveredRows, setDiscoveredRows] = useState(1);
  const [scanRow, setScanRow] = useState(0);
  const [breakdownReady, setBreakdownReady] = useState(false);

  useEffect(() => {
    if (!hasTranscript) {
      setBreakdownReady(false);
      setDiscoveredRows(1);
      setScanRow(0);
      return;
    }

    setBreakdownReady(false);
    setDiscoveredRows(1);
    setScanRow(0);

    const revealTimer = window.setTimeout(() => setBreakdownReady(true), 60);
    const growTimers = [
      window.setTimeout(() => setDiscoveredRows(2), 220),
      window.setTimeout(() => setDiscoveredRows(3), 380),
    ];

    return () => {
      window.clearTimeout(revealTimer);
      growTimers.forEach(clearTimeout);
    };
  }, [hasTranscript, transcript]);

  useEffect(() => {
    if (!breakdownReady || discoveredRows < 1) return;

    const scanTimer = window.setInterval(() => {
      setScanRow((prev) => (prev + 1) % discoveredRows);
    }, 850);

    return () => clearInterval(scanTimer);
  }, [breakdownReady, discoveredRows]);

  if (!hasTranscript) {
    return (
      <div className="sahha-breakdown sahha-breakdown--wait" aria-live="polite" aria-busy="true">
        <SahhaMark className="brand-mark--header-md sahha-breakdown__mark" glow />
        <div className="brand-divider sahha-breakdown__divider" aria-hidden="true" />
        <p className="sahha-breakdown__stage">{getParseStageLabel(mode, null, mode === 'voice' ? 'transcribe' : 'wait')}</p>
        <p className="sahha-breakdown__stage-sub">{getParseLoadingSublabel(mode, null)}</p>
        <span className="trust-badge sahha-breakdown__trust">Review before logging</span>
      </div>
    );
  }

  const stage = breakdownReady ? 'breakdown' : 'transcript';

  return (
    <div
      className={`sahha-breakdown sahha-breakdown--active ${exiting ? 'sahha-breakdown--out' : ''}`}
      aria-live="polite"
      aria-busy="true"
    >
      <p className="sahha-breakdown__stage sahha-breakdown__stage--active">
        {getParseStageLabel(mode, transcript, stage)}
      </p>
      <p className="sahha-breakdown__stage-sub sahha-breakdown__stage-sub--active">
        {getParseLoadingSublabel(mode, transcript)}
      </p>

      <blockquote className="sahha-breakdown__quote sahha-breakdown__quote--ready">
        <TranscriptReveal text={transcript!} />
      </blockquote>

      {breakdownReady && (
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
      )}
    </div>
  );
};

export default MealParseLoading;
