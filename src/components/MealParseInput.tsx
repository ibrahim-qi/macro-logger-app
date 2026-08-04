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
import { formatInvokeError, invokeParseMeal, invokeParseMealVoice } from '../utils/parseMeal';
import { assertRecordingHasSpeech, normalizeAudioMimeType } from '../utils/transcriptValidation';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { getParseLoadingLabel } from '../copy/experience';

export interface MealParseInputHandle {
  cancel: () => void;
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
  onParseError?: (message: string) => void;
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
}, ref) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const parseGenerationRef = useRef(0);
  const finishingRef = useRef(false);
  const { isRecording, isSupported, audioLevel, startRecording, stopRecording } = useAudioRecorder();

  const startNewParseGeneration = () => {
    parseGenerationRef.current += 1;
    return parseGenerationRef.current;
  };

  const isCurrentParse = (generation: number) => generation === parseGenerationRef.current;

  useImperativeHandle(ref, () => ({
    cancel: () => {
      startNewParseGeneration();
      setLoading(false);
      setError(null);
    },
  }));

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
    const trimmed = text.trim();
    if (!trimmed) { setError('Describe what you ate first.'); return; }

    const generation = startNewParseGeneration();
    setLoading(true);
    setError(null);
    hapticLight();
    onParseStart?.({ mode: 'text', previewText: trimmed });

    try {
      const data = await invokeParseMeal({ text: trimmed });
      if (!isCurrentParse(generation)) return;
      onParsed(data);
      setText('');
    } catch (err: unknown) {
      if (!isCurrentParse(generation)) return;
      const message = formatInvokeError(err);
      setError(message);
      onParseError?.(message);
    } finally {
      if (isCurrentParse(generation)) setLoading(false);
    }
  };

  const triggerRipple = () => {
    setRippleKey((key) => key + 1);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || loading) return;
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

    try {
      hapticMedium();
      await startRecording();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Microphone access denied.');
    }
  };

  const finishRecording = async () => {
    if (!isRecording || finishingRef.current) return;

    finishingRef.current = true;
    const generation = startNewParseGeneration();
    hapticLight();

    setLoading(true);
    let reviewOpened = false;

    try {
      const { base64, mimeType, durationMs, peakLevel } = await stopRecording();
      if (!isCurrentParse(generation)) return;

      const audioBytes = Math.floor((base64.length * 3) / 4);
      assertRecordingHasSpeech(durationMs, peakLevel, audioBytes);

      onParseStart?.({ mode: 'voice' });
      reviewOpened = true;

      const data = await invokeParseMealVoice(
        {
          audio: base64,
          mimeType: normalizeAudioMimeType(mimeType),
        },
        {
          onTranscript: (transcript) => {
            if (!isCurrentParse(generation)) return;
            setLastTranscript(transcript);
            setText(transcript);
            onTranscript?.(transcript);
          },
          onProgress: (stage) => {
            if (!isCurrentParse(generation)) return;
            onParseProgress?.(stage);
          },
        },
      );
      if (!isCurrentParse(generation)) return;

      hapticLight();
      const transcript = data.transcript?.trim() ?? '';
      onParsed({ ...data, transcript: transcript || undefined });
    } catch (err: unknown) {
      if (!isCurrentParse(generation)) return;
      const message = formatInvokeError(err);
      if (reviewOpened) {
        onParseError?.(message);
      } else {
        setError(message);
      }
    } finally {
      finishingRef.current = false;
      if (isCurrentParse(generation)) setLoading(false);
    }
  };

  const isProcessing = loading && !isRecording;
  const voiceStyle = { '--voice-level': isRecording ? audioLevel : 0 } as CSSProperties;

  let voiceHint: VoiceHint = 'idle';
  if (isRecording) voiceHint = 'listening';
  else if (isProcessing) voiceHint = 'analysing';

  return (
    <div className="log-voice-input">
      <div
        className={`sahha-voice sahha-voice--log ${isRecording ? 'sahha-voice--live' : ''} ${isProcessing ? 'sahha-voice--busy' : ''} ${!isRecording && !isProcessing ? 'sahha-voice--idle' : ''}`}
        style={voiceStyle}
      >
        <div className="sahha-voice__divider" aria-hidden="true" />

        <button
          type="button"
          onClick={handleVoiceToggle}
          onPointerDown={handlePointerDown}
          onPointerUp={clearPress}
          onPointerLeave={clearPress}
          onPointerCancel={clearPress}
          disabled={isProcessing || !isSupported}
          aria-label={isRecording ? 'Finish speaking' : 'Start voice recording'}
          aria-pressed={isRecording}
          className={[
            'sahha-voice__orb',
            'sahha-voice__orb--log',
            isRecording ? 'sahha-voice__orb--live' : '',
            isProcessing ? 'sahha-voice__orb--busy' : '',
            isPressing ? 'sahha-voice__orb--press' : '',
          ].filter(Boolean).join(' ')}
        >
          <span className="sahha-voice__surface" aria-hidden="true" />
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
            <p key="timer" className="sahha-voice__timer tabular-nums" aria-live="polite">
              {formatRecordingTime(recordingSeconds)}
            </p>
          )}

          {isSupported && (
            <p key={voiceHint} className="sahha-voice__hint">
              {voiceHint === 'listening' && 'Listening…'}
              {voiceHint === 'analysing' && 'Processing…'}
              {voiceHint === 'idle' && 'Tap to speak'}
            </p>
          )}
        </div>
      </div>

      <div className="log-type-section">
        <p className="log-type-section__label">or type</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Large grilled chicken, bowl of porridge…"
          className="input-premium resize-none text-base"
          disabled={loading || isRecording}
        />

        {lastTranscript && !loading && (
          <p className="mt-2 type-meta">
            Heard: &ldquo;{lastTranscript}&rdquo;
          </p>
        )}

        <button
          type="button"
          onClick={handleParseText}
          disabled={loading || isRecording || !text.trim()}
          className="btn-primary mt-3 w-full"
        >
          {isProcessing ? getParseLoadingLabel() : 'Log meal'}
        </button>
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
