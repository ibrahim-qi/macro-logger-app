import type { ExperienceContext } from '../types/experience';
import { mealPeriodPrompt, timeOfDayLabel } from '../utils/experience';

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
  const base = mealPeriodPrompt(ctx.mealPeriod);
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
  return 'Say what you ate. Sahha estimates the nutrition — you confirm before anything is saved.';
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

export function getStatsIntro(ctx: ExperienceContext): string {
  if (ctx.weeklyDaysLogged !== null && ctx.weeklyDaysLogged >= 5) {
    return ctx.firstName
      ? `Steady week, ${ctx.firstName} — ${ctx.weeklyDaysLogged} days logged.`
      : `Steady week — ${ctx.weeklyDaysLogged} days logged.`;
  }

  if (ctx.weeklyDaysLogged !== null && ctx.weeklyDaysLogged > 0) {
    return `${ctx.weeklyDaysLogged} day${ctx.weeklyDaysLogged === 1 ? '' : 's'} logged this week`;
  }

  return ctx.firstName ? `Your nutrition trends, ${ctx.firstName}` : 'Your nutrition trends';
}

export function getLogPageLabel(ctx: ExperienceContext): string {
  return ctx.hasLoggedToday ? 'Add another meal' : 'Start logging';
}

/** Boot / tab loading copy */
export function getBootLoadingLabel(): string {
  return 'Opening Sahha';
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
  return 'What should we call you? Sahha uses your first name to personalise prompts and summaries.';
}

export function getGoalsOnboardingTitle(): string {
  return 'Set your daily targets';
}

export function getGoalsOnboardingBody(): string {
  return 'Calorie and macro goals help Sahha track your day calmly — adjust these anytime in Targets.';
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
