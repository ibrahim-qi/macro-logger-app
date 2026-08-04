/** Whisper prompt — max ~224 tokens; steers spelling/style for meal logging. */

const STT_VOCAB =
  'Meal log only. Transcribe exactly what the user says they ate, including numbers. If silent or unclear, return empty.';

export function buildTranscriptionPrompt(savedFoodNames: string[] = []): string {
  if (!savedFoodNames.length) return STT_VOCAB;

  const personal = savedFoodNames
    .slice(0, 10)
    .map((name) => name.trim())
    .filter(Boolean)
    .join(', ');

  return personal ? `${STT_VOCAB} User foods: ${personal}.` : STT_VOCAB;
}
