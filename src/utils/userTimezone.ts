import type { UserProfile } from '../types/experience';
import { getBrowserTimezone } from './localDate';

/** Profile timezone when set, otherwise browser IANA timezone. */
export function resolveUserTimezone(profile: UserProfile | null | undefined): string {
  const tz = profile?.timezone?.trim();
  return tz || getBrowserTimezone();
}
