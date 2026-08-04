/** Whisper prompt — max ~224 tokens; steers spelling/style for meal logging. */
const STT_VOCAB =
  'Meal log only. Transcribe what the user says they ate. If silent or unclear, return empty. chicken breast, scrambled eggs, porridge, oats, Greek yogurt, protein shake, rice, salmon, broccoli, banana, toast, latte, grams, millilitres.';

export function buildTranscriptionPrompt(savedFoodNames: string[] = []): string {
  if (!savedFoodNames.length) return STT_VOCAB;

  const personal = savedFoodNames
    .slice(0, 10)
    .map((name) => name.trim())
    .filter(Boolean)
    .join(', ');

  return personal ? `${STT_VOCAB} ${personal}.` : STT_VOCAB;
}
