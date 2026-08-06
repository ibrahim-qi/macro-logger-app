import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_AUDIO_BYTES,
  MAX_RECORDING_MS,
} from '../../supabase/functions/_shared/stt/constants.ts';

export type RecordingStatus = 'idle' | 'recording' | 'unsupported';

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  peakLevel: number;
  voicedMs: number;
  byteLength: number;
  /** True when the recorder stopped because of the hard duration cap. */
  stoppedByMaxDuration?: boolean;
}

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function normalizeMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
  if (base === 'audio/x-m4a' || base === 'audio/m4a') return 'audio/mp4';
  return base;
}

export function useAudioRecorder(options?: {
  maxDurationMs?: number;
  onMaxDurationReached?: () => void;
}) {
  const maxDurationMs = options?.maxDurationMs ?? MAX_RECORDING_MS;
  const onMaxDurationReachedRef = useRef(options?.onMaxDurationReached);
  onMaxDurationReachedRef.current = options?.onMaxDurationReached;

  const [status, setStatus] = useState<RecordingStatus>(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return 'unsupported';
    }
    if (typeof MediaRecorder === 'undefined') {
      return 'unsupported';
    }
    return 'idle';
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('audio/mp4');
  const startingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const peakLevelRef = useRef(0);
  const voicedMsRef = useRef(0);
  const lastTickAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const maxDurationTimerRef = useRef<number | null>(null);
  const stoppedByMaxDurationRef = useRef(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const clearMaxDurationTimer = useCallback(() => {
    if (maxDurationTimerRef.current !== null) {
      window.clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, []);

  const stopLevelMonitor = useCallback(() => {
    if (levelRafRef.current !== null) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    peakLevelRef.current = 0;
    voicedMsRef.current = 0;
    lastTickAtRef.current = 0;
    recordingStartedAtRef.current = 0;
  }, []);

  const cleanupStream = useCallback(() => {
    clearMaxDurationTimer();
    stopLevelMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, [clearMaxDurationTimer, stopLevelMonitor]);

  const startLevelMonitor = useCallback((stream: MediaStream) => {
    stopLevelMonitor();
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.88;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = (now: number) => {
      if (lastTickAtRef.current > 0) {
        const deltaMs = now - lastTickAtRef.current;
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i];
        const avg = sum / buffer.length / 255;
        peakLevelRef.current = Math.max(peakLevelRef.current, avg);
        if (avg > 0.045) {
          voicedMsRef.current += deltaMs;
        }
        setAudioLevel((prev) => prev * 0.18 + avg * 0.82);
      } else {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i];
        const avg = sum / buffer.length / 255;
        peakLevelRef.current = Math.max(peakLevelRef.current, avg);
        setAudioLevel((prev) => prev * 0.18 + avg * 0.82);
      }
      lastTickAtRef.current = now;
      levelRafRef.current = requestAnimationFrame(tick);
    };
    lastTickAtRef.current = 0;
    levelRafRef.current = requestAnimationFrame(tick);
  }, [stopLevelMonitor]);

  const startRecording = useCallback(async () => {
    if (status === 'unsupported') {
      throw new Error('Voice recording is not supported in this browser.');
    }

    if (startingRef.current || mediaRecorderRef.current?.state === 'recording') {
      return;
    }

    startingRef.current = true;
    stoppedByMaxDurationRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferredMimeType = pickMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mimeTypeRef.current = normalizeMimeType(preferredMimeType || recorder.mimeType || 'audio/webm');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      peakLevelRef.current = 0;
      voicedMsRef.current = 0;
      lastTickAtRef.current = 0;
      recordingStartedAtRef.current = Date.now();
      startLevelMonitor(stream);
      recorder.start(250);
      setStatus('recording');

      clearMaxDurationTimer();
      maxDurationTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stoppedByMaxDurationRef.current = true;
          onMaxDurationReachedRef.current?.();
        }
      }, maxDurationMs);
    } catch (error) {
      cleanupStream();
      setStatus('idle');
      throw error;
    } finally {
      startingRef.current = false;
    }
  }, [cleanupStream, clearMaxDurationTimer, maxDurationMs, startLevelMonitor, status]);

  const stopRecording = useCallback(async (): Promise<RecordingResult> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      cleanupStream();
      setStatus('idle');
      throw new Error('No active recording');
    }

    clearMaxDurationTimer();
    const stoppedByMaxDuration = stoppedByMaxDurationRef.current;

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        try {
          const chunkType = chunksRef.current.find((chunk) => chunk.type)?.type;
          const mimeType = normalizeMimeType(
            chunkType || mimeTypeRef.current || recorder.mimeType || 'audio/webm',
          );
          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size === 0) {
            throw new Error('Recording was empty. Try again.');
          }
          if (blob.size > MAX_AUDIO_BYTES) {
            throw new Error('Recording is too large. Keep it under 30 seconds and try again.');
          }
          const durationMs = Math.max(0, Date.now() - recordingStartedAtRef.current);
          const peakLevel = peakLevelRef.current;
          const voicedMs = voicedMsRef.current;
          const byteLength = blob.size;
          cleanupStream();
          setStatus('idle');
          resolve({
            blob,
            mimeType,
            durationMs,
            peakLevel,
            voicedMs,
            byteLength,
            stoppedByMaxDuration,
          });
        } catch (error) {
          cleanupStream();
          setStatus('idle');
          reject(error);
        }
      };

      recorder.onerror = () => {
        cleanupStream();
        setStatus('idle');
        reject(new Error('Recording failed'));
      };

      if (typeof recorder.requestData === 'function') {
        recorder.requestData();
      }
      recorder.stop();
    });
  }, [cleanupStream, clearMaxDurationTimer]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    startingRef.current = false;
    stoppedByMaxDurationRef.current = false;
    cleanupStream();
    setStatus('idle');
  }, [cleanupStream]);

  useEffect(() => () => {
    clearMaxDurationTimer();
    stopLevelMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [clearMaxDurationTimer, stopLevelMonitor]);

  return {
    status,
    isRecording: status === 'recording',
    isSupported: status !== 'unsupported',
    audioLevel,
    maxDurationMs,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
