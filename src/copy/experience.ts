import type { ExperienceContext } from '../types/experience';
import type { ParseProgressStage } from '../types/mealParse';
import { timeOfDayLabel } from '../utils/experience';

function withName(prefix: string, ctx: ExperienceContext): string {
  return ctx.firstName ? `${prefix}, ${ctx.firstName}` : prefix;
}

export const SAHHA_TAGLINE = 'Speak naturally. Review with confidence.' as const;

export function getGreeting(ctx: ExperienceContext): string {
  return withName(timeOfDayLabel(ctx.timeOfDay), ctx);
}

export function getHeaderGreeting(ctx: ExperienceContext): string {
  if (ctx.firstName) return `Hi, ${ctx.firstName}`;
  return timeOfDayLabel(ctx.timeOfDay);
}

export function getTodayHeadline(ctx: ExperienceContext): string {
  if (!ctx.hasLoggedToday) {
    if (ctx.streak > 0) {
      return `Day ${ctx.streak} — a gentle check-in?`;
    }
    return 'Ready when you are';
  }

  if (ctx.caloriesRemaining !== null && ctx.caloriesRemaining > 0) {
    return `${Math.round(ctx.caloriesRemaining)} cal left · ${ctx.entryCount} logged today`;
  }

  if (ctx.caloriesRemaining !== null && ctx.caloriesRemaining <= 0) {
    return `${ctx.entryCount} logged · goal reached for today`;
  }

  return `${ctx.entryCount} logged today`;
}

export function getTodaySubline(ctx: ExperienceContext): string | null {
  if (!ctx.goals || !ctx.hasLoggedToday) return null;

  const proteinLeft = ctx.proteinRemaining;
  if (proteinLeft !== null && proteinLeft > 20) {
    return `${Math.round(proteinLeft)}g protein still to go`;
  }

  if (ctx.caloriesRemaining !== null && ctx.caloriesRemaining > 0 && ctx.caloriesRemaining < 400) {
    return 'Nearly at your calorie target';
  }

  return null;
}

export function getLogTitle(ctx: ExperienceContext): string {
  const base = 'What did you eat?';
  if (!ctx.firstName) return base;
  return base.replace(/\?$/, `, ${ctx.firstName}?`);
}

export function getLogHelper(): string {
  return 'Tap when ready — you review before saving.';
}

export function getLogSubtitle(ctx: ExperienceContext): string | null {
  if (ctx.caloriesRemaining !== null && ctx.hasLoggedToday) {
    return `${Math.round(ctx.caloriesRemaining)} cal left today`;
  }
  return null;
}

export function getEmptyStateTitle(ctx: ExperienceContext): string {
  if (ctx.mealPeriod === 'Breakfast') return 'Nothing for breakfast yet';
  if (ctx.mealPeriod === 'Lunch') return 'Nothing for lunch yet';
  if (ctx.mealPeriod === 'Dinner') return 'Nothing for dinner yet';
  return 'Nothing logged yet';
}

export function getEmptyStateBody(ctx: ExperienceContext): string {
  if (ctx.streak > 0) {
    return `Keep your ${ctx.streak}-day streak — say what you ate, review, then log.`;
  }
  return 'Say what you ate. Soha estimates the nutrition — you confirm before anything is saved.';
}

export function getEmptyStateCta(ctx: ExperienceContext): string {
  if (ctx.mealPeriod === 'Breakfast') return 'Log breakfast';
  if (ctx.mealPeriod === 'Lunch') return 'Log lunch';
  if (ctx.mealPeriod === 'Dinner') return 'Log dinner';
  return 'Log your first meal';
}

export function getReviewHint(ctx: ExperienceContext): string {
  if (ctx.firstName) {
    return `${ctx.firstName}, tweak anything that looks off, then confirm each item before logging.`;
  }
  return 'Tweak anything that looks off, then confirm each item before logging.';
}

export function getLogPageLabel(ctx: ExperienceContext): string {
  return ctx.hasLoggedToday ? 'Add another meal' : 'Start logging';
}

/** Boot / tab loading copy */
export function getBootLoadingLabel(): string {
  return 'Opening Soha';
}

export function getBootLoadingSublabel(): string {
  return 'Your private nutrition journal';
}

export function getTabLoadingLabel(context: 'goals' | 'weekly' | 'monthly' | 'settings'): string {
  switch (context) {
    case 'goals': return 'Loading your targets';
    case 'weekly': return 'Loading this week';
    case 'monthly': return 'Loading this month';
    case 'settings': return 'Saving your targets';
  }
}

export function getTodayContextLine(ctx: ExperienceContext): string | null {
  const subline = getTodaySubline(ctx);
  if (subline) return subline;
  return getTodayHeadline(ctx);
}

export function getLogSuccessToast(calories: number): string {
  return `Logged · ${Math.round(calories).toLocaleString()} cal`;
}

export function getGoalsSavedMessage(): string {
  return 'Targets saved';
}

export function getNameSetupBody(): string {
  return 'What should we call you? Soha uses your first name to personalise prompts and summaries.';
}

export function getGoalsOnboardingTitle(): string {
  return 'Set your daily targets';
}

export function getGoalsOnboardingBody(): string {
  return 'Calorie and macro goals help Soha track your day calmly — adjust these anytime in Targets.';
}

export function getMicIntroTitle(): string {
  return 'Log with your voice';
}

export function getMicIntroBody(): string {
  return 'Tap the mic, say what you ate, then review the breakdown before anything is saved.';
}

export function getMicIntroCta(): string {
  return 'Try the mic';
}

export function getDeleteEntryTitle(): string {
  return 'Delete entry';
}

export function getDeleteEntryBody(): string {
  return 'This entry will be permanently removed.';
}

export function getStatsEmptyTitle(): string {
  return 'No data for this period';
}

export function getStatsEmptyBody(): string {
  return 'Log a few meals and your trends will appear here.';
}

export function getStatsEmptyCta(): string {
  return 'Log a meal';
}

export function getGoalsModalTitle(): string {
  return 'Daily targets';
}

export function getGoalsUpdateButton(): string {
  return 'Save targets';
}

export function getGoalsSavingButton(): string {
  return 'Saving…';
}

/** Parse loading — stage labels streamed from the edge function. */
export function getParseStageLabel(
  stage: ParseProgressStage | null,
  mode: 'voice' | 'text',
  firstName?: string | null,
): string {
  switch (stage) {
    case 'transcribing':
      return 'Transcribing...';
    case 'identifying':
      return 'Identifying...';
    case 'looking_up':
      return 'Looking up...';
    case 'estimating':
      return 'Estimating...';
    default:
      return mode === 'text'
        ? 'Working out the numbers'
        : firstName
          ? `Working out the numbers, ${firstName}`
          : 'Working out the numbers';
  }
}

/** Shown once after 8s on the same displayed stage (long-wait reassurance). */
export function getParseStageSublabel(
  stage: ParseProgressStage | null,
  hasTranscript = false,
): string {
  if (hasTranscript) return 'Working out the numbers';
  if (stage === 'looking_up') return 'Checking UK sources';
  if (stage === 'estimating') return 'Got it — one moment';
  return 'Working out the numbers';
}

export function getResearchTrustLine(): string {
  return 'Checked against UK sources';
}

export function getVoiceLongRecordingHint(): string {
  return 'Long one — tap Done when you\'re finished';
}

export function getVoiceMaxDurationHint(secondsRemaining: number): string {
  if (secondsRemaining <= 0) {
    return 'Time\'s up — wrapping up your recording…';
  }
  return `Wrapping up in ${secondsRemaining}s…`;
}

export function getTranscriptCorrectHint(isTouch = false): string {
  if (isTouch) {
    return 'We\'ll restart from your correction.';
  }
  return 'We\'ll restart from your correction. Ctrl/⌘+Enter to apply.';
}

export function getTranscriptCorrectLabel(): string {
  return 'Edit if we misheard';
}

export function getTranscriptReparseConfirm(): string {
  return 'Re-parse from this transcript? Your item edits will be lost.';
}

export function getTextParsingCtaLabel(): string {
  return 'One moment…';
}

export function isLongParseTranscript(transcript: string | null | undefined): boolean {
  return Boolean(transcript && transcript.trim().length > 120);
}

export function getGenericParseFailureMessage(): string {
  return 'We couldn\'t work that one out. Edit what you said and retry.';
}

export function getNetworkUnreachableMessage(): string {
  return 'Can\'t reach Soha right now. Check your connection and try again.';
}

export function getSessionExpiredMessage(): string {
  return 'Your session expired — sign in again to keep logging.';
}

export function getParseErrorTitle(): string {
  return 'Let\'s try that again';
}

export function getTodayLoadFailureMessage(): string {
  return 'Couldn\'t load this day. Pull to refresh or try again shortly.';
}

export function getEntryDeleteFailureMessage(): string {
  return 'Couldn\'t delete that entry. Try again.';
}

export function getEntryUpdateFailureMessage(): string {
  return 'Couldn\'t update that entry. Try again.';
}

export function getNoGoalsHeroMessage(): string {
  return 'Set daily targets to track your day';
}

export function getSetTargetsCta(): string {
  return 'Set targets';
}

export function getWeeklySummaryFailureMessage(): string {
  return 'Couldn\'t load this week. Try again shortly.';
}

export function getMonthlySummaryFailureMessage(): string {
  return 'Couldn\'t load this month. Try again shortly.';
}

export function getGoalsSaveFailureMessage(): string {
  return 'Couldn\'t save your targets. Try again.';
}

export function getNoSpeechMessage(): string {
  return 'Didn\'t catch that — try again';
}

export function getNoMealDetectedMessage(): string {
  return 'That doesn\'t sound like a meal — try again?';
}

export function getNothingEatenMessage(): string {
  return 'Got it — nothing to log';
}

/** Shown when the parse takes too long and the attempt is abandoned. */
export function getParseTimeoutMessage(): string {
  return 'Took too long — try again';
}

export function getRejectionTitle(): string {
  return 'Nothing to log yet';
}

export function getRejectionMessage(
  reason: 'no_speech' | 'no_meal_detected' | 'nothing_eaten',
): string {
  switch (reason) {
    case 'no_speech':
      return getNoSpeechMessage();
    case 'no_meal_detected':
      return getNoMealDetectedMessage();
    case 'nothing_eaten':
      return getNothingEatenMessage();
  }
}
