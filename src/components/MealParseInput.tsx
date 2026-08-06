import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { SahhaMark } from './SahhaBrand';
import type { ParseMealResponse, ParseProgressStage } from '../types/mealParse';
import {
  getVoiceLongRecordingHint,
  getVoiceMaxDurationHint,
  getVoiceProcessingHint,
  getTextParsingCtaLabel,
} from '../copy/experience';
import {
  invokeParseMeal,
  invokeParseMealVoice,
  prefetchParseAccessToken,
  toParseErrorPayload,
} from '../utils/parseMeal';
import type { ParseErrorPayload } from '../utils/parseRejection.ts';
import {
  assertRecordingHasSpeech,
  assertTranscriptLooksLikeFood,
  normalizeAudioMimeType,
} from '../utils/transcriptValidation';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { MAX_RECORDING_MS } from '../../supabase/functions/_shared/stt/constants.ts';

export interface MealParseInputHandle {
  cancel: () => void;
  focusMic: () => void;
}

export interface ParseStartPayload {
  mode: 'voice' | 'text';
  previewText?: string;
}

interface MealParseInputProps {
  onParsed: (result: ParseMealResponse) => void;
  onParseStart?: (payload: ParseStartPayload) => void;
  onTranscript?: (transcript: string) => void;
  onParseProgress?: (stage: ParseProgressStage) => void;
  onParseError?: (payload: ParseErrorPayload) => void;
  /** Hide mic hints while the review sheet is open. */
  reviewActive?: boolean;
}

function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type VoiceHint = 'idle' | 'listening' | 'analysing';

const MealParseInput = forwardRef<MealParseInputHandle, MealParseInputProps>(({
  onParsed,
  onParseStart,
  onTranscript,
  onParseProgress,
  onParseError,
  reviewActive = false,
}, ref) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const parseGenerationRef = useRef(0);
  const finishingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const finishRecordingRef = useRef<() => Promise<void>>(async () => {});
  const {
    isRecording,
    isSupported,
    audioLevel,
    maxDurationMs,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder({
    maxDurationMs: MAX_RECORDING_MS,
    onMaxDurationReached: () => {
      void finishRecordingRef.current();
    },
  });

  const startNewParseGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    parseGenerationRef.current += 1;
    return {
      generation: parseGenerationRef.current,
      signal: abortControllerRef.current.signal,
    };
  };

  const isCurrentParse = (generation: number) => generation === parseGenerationRef.current;

  useImperativeHandle(ref, () => ({
    cancel: () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      parseGenerationRef.current += 1;
      if (isRecording) cancelRecording();
      setLoading(false);
      setError(null);
    },
    focusMic: () => micButtonRef.current?.focus(),
  }), [cancelRecording, isRecording]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  const handleParseText = async () => {
    if (reviewActive) return;
    const trimmed = text.trim();
    if (!trimmed) { setError('Describe what you ate first.'); return; }

    try {
      assertTranscriptLooksLikeFood(trimmed);
    } catch (err: unknown) {
      const payload = toParseErrorPayload(err);
      setError(payload.message);
      return;
    }

    const { generation, signal } = startNewParseGeneration();
    setLoading(true);
    setError(null);
    hapticLight();
    onParseStart?.({ mode: 'text', previewText: trimmed });

    try {
      const data = await invokeParseMeal(
        { text: trimmed },
        {
          onProgress: (stage) => {
            if (!isCurrentParse(generation)) return;
            onParseProgress?.(stage);
          },
          signal,
        },
      );
      if (!isCurrentParse(generation)) return;
      onParsed(data);
      setText('');
    } catch (err: unknown) {
      if (!isCurrentParse(generation)) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onParseError?.(toParseErrorPayload(err));
    } finally {
      if (isCurrentParse(generation)) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const triggerRipple = () => {
    setRippleKey((key) => key + 1);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || loading || reviewActive) return;
    setIsPressing(true);
  };

  const clearPress = () => {
    setIsPressing(false);
  };

  const handleVoiceToggle = async () => {
    setError(null);
    triggerRipple();

    if (isRecording) {
      await finishRecording();
      return;
    }

    if (reviewActive) return;

    try {
      hapticMedium();
      // Warm auth while the user speaks so Done does not wait on session I/O.
      void prefetchParseAccessToken().catch(() => undefined);
      await startRecording();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Microphone access denied.');
    }
  };

  const finishRecording = async () => {
    if (!isRecording || finishingRef.current) return;

    finishingRef.current = true;
    const { generation, signal } = startNewParseGeneration();
    hapticLight();
    const doneAt = performance.now();

    setLoading(true);
    onParseStart?.({ mode: 'voice' });

    try {
      // Overlap MediaRecorder finalize with token fetch.
      const tokenPromise = prefetchParseAccessToken();
      const {
        blob,
        mimeType,
        durationMs,
        peakLevel,
        voicedMs,
        byteLength,
      } = await stopRecording();
      if (!isCurrentParse(generation)) return;

      assertRecordingHasSpeech(durationMs, peakLevel, byteLength, voicedMs);

      const accessToken = await tokenPromise;
      const data = await invokeParseMealVoice(
        {
          audio: blob,
          mimeType: normalizeAudioMimeType(mimeType),
        },
        {
          accessToken,
          onTranscript: (transcript) => {
            if (!isCurrentParse(generation)) return;
            if (import.meta.env.DEV) {
              console.log('[voice] done_to_transcript_ms', Math.round(performance.now() - doneAt));
            }
            // Sheet owns the voice transcript — don't leave it in the type field.
            onTranscript?.(transcript);
          },
          onProgress: (stage) => {
            if (!isCurrentParse(generation)) return;
            onParseProgress?.(stage);
          },
          signal,
        },
      );
      if (!isCurrentParse(generation)) return;

      hapticLight();
      const transcript = data.transcript?.trim() ?? '';
      onParsed({ ...data, transcript: transcript || undefined });
    } catch (err: unknown) {
      if (!isCurrentParse(generation)) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const payload = toParseErrorPayload(err);
      onParseError?.(payload);
    } finally {
      finishingRef.current = false;
      if (isCurrentParse(generation)) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  finishRecordingRef.current = finishRecording;

  const handleCancelRecording = () => {
    cancelRecording();
    finishingRef.current = false;
    setLoading(false);
    setError(null);
    hapticLight();
    window.setTimeout(() => micButtonRef.current?.focus(), 0);
  };

  const isProcessing = loading && !isRecording && !reviewActive;
  const micDisabled = reviewActive || (loading && !isRecording) || !isSupported;
  const maxDurationSec = Math.floor(maxDurationMs / 1000);
  const countdownWindowSec = 5;
  const countdownActive = isRecording && recordingSeconds >= maxDurationSec - countdownWindowSec;
  const countdownProgress = countdownActive
    ? Math.min(1, (recordingSeconds - (maxDurationSec - countdownWindowSec)) / countdownWindowSec)
    : isRecording
      ? Math.min(0.92, recordingSeconds / maxDurationSec)
      : 0;
  const voiceStyle = {
    '--voice-level': isRecording ? audioLevel : 0,
    '--countdown-progress': countdownProgress,
  } as CSSProperties;

  let voiceHint: VoiceHint = 'idle';
  if (isRecording) voiceHint = 'listening';
  else if (isProcessing) voiceHint = 'analysing';

  return (
    <div className="log-voice-input">
      <div
        className={`sahha-voice sahha-voice--log ${isRecording ? 'sahha-voice--live' : ''} ${isProcessing ? 'sahha-voice--busy' : ''} ${reviewActive ? 'sahha-voice--dimmed' : ''} ${!isRecording && !isProcessing ? 'sahha-voice--idle' : ''}`}
        style={voiceStyle}
      >
        <button
          ref={micButtonRef}
          type="button"
          onClick={handleVoiceToggle}
          onPointerDown={handlePointerDown}
          onPointerUp={clearPress}
          onPointerLeave={clearPress}
          onPointerCancel={clearPress}
          disabled={micDisabled}
          aria-label={isRecording ? 'Finish speaking' : 'Start voice recording'}
          aria-pressed={isRecording}
          className={[
            'sahha-voice__orb',
            'sahha-voice__orb--log',
            isRecording ? 'sahha-voice__orb--live' : '',
            isProcessing ? 'sahha-voice__orb--busy' : '',
            isPressing ? 'sahha-voice__orb--press' : '',
            countdownActive ? 'sahha-voice__orb--countdown' : '',
          ].filter(Boolean).join(' ')}
        >
          <span className="sahha-voice__surface" aria-hidden="true" />
          {isRecording && (
            <span
              className={`sahha-voice__countdown ${countdownActive ? 'sahha-voice__countdown--urgent' : ''}`}
              aria-hidden="true"
            />
          )}
          <span className="sahha-voice__ring" aria-hidden="true" />
          <span className="sahha-voice__halo" aria-hidden="true" />
          <span key={rippleKey} className="sahha-voice__ripple" aria-hidden="true" />

          {isProcessing ? (
            <div className="spinner w-8 h-8 sahha-voice__spinner" />
          ) : (
            <SahhaMark className="brand-mark--hero-lg sahha-voice__mark" glow />
          )}

          {isRecording && (
            <span className="sahha-voice__finish">Done</span>
          )}
        </button>

        <div className="sahha-voice__status">
          {isRecording && (
            <p key="timer" className="sahha-voice__timer tabular-nums" aria-live="off" aria-label={`${recordingSeconds} seconds recorded`}>
              {formatRecordingTime(recordingSeconds)}
            </p>
          )}

          {isSupported && !reviewActive && (
            <p key={voiceHint} className="sahha-voice__hint">
              {voiceHint === 'listening' && (
                countdownActive
                  ? getVoiceMaxDurationHint(Math.max(0, maxDurationSec - recordingSeconds))
                  : recordingSeconds >= 20
                    ? getVoiceLongRecordingHint()
                    : 'Listening…'
              )}
              {voiceHint === 'analysing' && getVoiceProcessingHint()}
              {voiceHint === 'idle' && 'Tap to speak'}
            </p>
          )}
          {!isSupported && (
            <p className="sahha-voice__hint">Voice recording is not supported here. Type your meal below.</p>
          )}
          {isRecording && (
            <button
              type="button"
              className="sahha-voice__cancel"
              onClick={handleCancelRecording}
            >
              Cancel recording
            </button>
          )}
        </div>
      </div>

      <div className="log-type-section">
        <div className="log-type-field">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim() && !loading && !isRecording && !reviewActive) {
                e.preventDefault();
                void handleParseText();
              }
            }}
            placeholder="…or type it"
            className="log-type-field__input"
            disabled={loading || isRecording || reviewActive}
          />
          <button
            type="button"
            onClick={handleParseText}
            disabled={loading || isRecording || reviewActive || !text.trim()}
            className={`log-type-field__submit ${text.trim() ? 'log-type-field__submit--ready' : ''}`}
            aria-label={loading && !isRecording ? getTextParsingCtaLabel() : 'Log typed meal'}
          >
            {loading && !isRecording ? (
              <span className="spinner log-type-field__spinner" aria-hidden="true" />
            ) : (
              <svg className="log-type-field__submit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="log-voice-input__error">
          {error}
        </p>
      )}
    </div>
  );
});

MealParseInput.displayName = 'MealParseInput';

export default MealParseInput;
