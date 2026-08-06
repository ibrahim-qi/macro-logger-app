import {
  assertValidAudioPayload,
  extensionForMime,
  normalizeAudioMimeType,
  parseProviderAudioError,
} from '../audioValidation.ts';
import { MAX_AUDIO_BYTES, DEFAULT_STT_TIMEOUT_MS, STT_MAX_ATTEMPTS } from './constants.ts';
import { SttError } from './errors.ts';
import { summarizeNoSpeechProbs } from './noSpeech.ts';
import type { SttRequest, SttResult, SttSegment } from './types.ts';

export interface NanoGptSttConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Whisper-family models can return segment no_speech_prob via verbose_json. */
function isWhisperFamilyModel(model: string): boolean {
  const normalized = model.toLowerCase();
  return normalized.includes('whisper');
}

async function transcribeOnce(
  request: SttRequest,
  config: NanoGptSttConfig,
  timeoutMs: number,
): Promise<Omit<SttResult, 'latencyMs' | 'attempts'>> {
  const { audio } = request;
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    throw new SttError('too_large', 'Recording is too large. Keep it under 30 seconds.', {
      retryable: false,
    });
  }

  try {
    assertValidAudioPayload(audio.byteLength);
  } catch (error) {
    throw new SttError(
      'too_small',
      error instanceof Error ? error.message : 'Recording was too short or empty.',
      { retryable: false, cause: error },
    );
  }

  const normalizedMime = normalizeAudioMimeType(audio.mimeType || request.audio.mimeType);
  const extension = extensionForMime(normalizedMime);
  const model = request.model ?? config.model;
  const whisperFamily = isWhisperFamilyModel(model);

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([audio.bytes], { type: normalizedMime }),
    `recording.${extension}`,
  );
  formData.append('model', model);
  formData.append('language', request.language ?? 'en');
  // Prefer plain json for non-Whisper models (faster; no segment metadata).
  formData.append('response_format', whisperFamily ? 'verbose_json' : 'json');
  if (whisperFamily) {
    formData.append('temperature', '0');
  }
  if (request.prompt?.trim()) {
    formData.append('prompt', request.prompt.trim());
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = config.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${config.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      const message = parseProviderAudioError(response.status, detail);
      throw new SttError(
        response.status === 415 ? 'unsupported_audio' : 'provider_error',
        message,
        { retryable: isRetryableStatus(response.status), status: response.status },
      );
    }

    const payload = await response.json() as {
      text?: string;
      duration?: number;
      segments?: Array<{
        text?: string;
        no_speech_prob?: number;
        start?: number;
        end?: number;
      }>;
    };

    const segments: SttSegment[] = (payload.segments ?? []).map((segment) => ({
      text: segment.text,
      noSpeechProb: typeof segment.no_speech_prob === 'number' ? segment.no_speech_prob : undefined,
      start: segment.start,
      end: segment.end,
    }));
    const { max, mean } = summarizeNoSpeechProbs(segments);

    return {
      text: String(payload.text ?? ''),
      segments,
      noSpeechProbMax: max,
      noSpeechProbMean: mean,
      durationMs: typeof payload.duration === 'number'
        ? Math.round(payload.duration * 1000)
        : undefined,
      provider: 'nanogpt',
      model,
    };
  } catch (error) {
    if (error instanceof SttError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SttError('timeout', 'Speech recognition timed out. Try a shorter recording.', {
        retryable: true,
        cause: error,
      });
    }
    throw new SttError(
      'provider_error',
      error instanceof Error ? error.message : 'Speech recognition failed.',
      { retryable: true, cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
}

/** NanoGPT OpenAI-compatible Whisper adapter with timeout + one retry. */
export async function transcribeWithNanoGpt(
  request: SttRequest,
  config: NanoGptSttConfig,
): Promise<SttResult> {
  const timeoutMs = request.timeoutMs ?? DEFAULT_STT_TIMEOUT_MS;
  const startedAt = performance.now();
  let attempts = 0;
  let lastError: SttError | undefined;

  while (attempts < STT_MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const result = await transcribeOnce(request, config, timeoutMs);
      return {
        ...result,
        latencyMs: Math.round(performance.now() - startedAt),
        attempts,
      };
    } catch (error) {
      const sttError = error instanceof SttError
        ? error
        : new SttError('provider_error', 'Speech recognition failed.', {
          retryable: true,
          cause: error,
        });
      lastError = sttError;
      if (!sttError.retryable || attempts >= STT_MAX_ATTEMPTS) {
        throw sttError;
      }
      console.log('[stt] retry', { attempt: attempts, code: sttError.code });
    }
  }

  throw lastError ?? new SttError('provider_error', 'Speech recognition failed.');
}
