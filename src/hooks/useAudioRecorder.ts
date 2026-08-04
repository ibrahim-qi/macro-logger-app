import { useCallback, useEffect, useRef, useState } from 'react';

export type RecordingStatus = 'idle' | 'recording' | 'unsupported';

interface RecordingResult {
  base64: string;
  mimeType: string;
  durationMs: number;
  peakLevel: number;
  voicedMs: number;
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read audio'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to encode audio'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read audio'));
    reader.readAsDataURL(blob);
  });
}

export function useAudioRecorder() {
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
  const [audioLevel, setAudioLevel] = useState(0);

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
    stopLevelMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, [stopLevelMonitor]);

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
    } catch (error) {
      cleanupStream();
      setStatus('idle');
      throw error;
    } finally {
      startingRef.current = false;
    }
  }, [cleanupStream, startLevelMonitor, status]);

  const stopRecording = useCallback(async (): Promise<RecordingResult> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      cleanupStream();
      setStatus('idle');
      throw new Error('No active recording');
    }

    return new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const chunkType = chunksRef.current.find((chunk) => chunk.type)?.type;
          const mimeType = normalizeMimeType(
            chunkType || mimeTypeRef.current || recorder.mimeType || 'audio/webm',
          );
          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size === 0) {
            throw new Error('Recording was empty. Try again.');
          }
          const base64 = await blobToBase64(blob);
          const durationMs = Math.max(0, Date.now() - recordingStartedAtRef.current);
          const peakLevel = peakLevelRef.current;
          const voicedMs = voicedMsRef.current;
          cleanupStream();
          setStatus('idle');
          resolve({ base64, mimeType, durationMs, peakLevel, voicedMs });
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
  }, [cleanupStream]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    startingRef.current = false;
    cleanupStream();
    setStatus('idle');
  }, [cleanupStream]);

  useEffect(() => () => {
    stopLevelMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [stopLevelMonitor]);

  return {
    status,
    isRecording: status === 'recording',
    isSupported: status !== 'unsupported',
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
