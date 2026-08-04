import { supabase } from '../supabaseClient';
import type { UserProfile } from '../types/experience';
import { deriveNameFromEmail } from '../utils/experience';
import { getBrowserTimezone } from './localDate';

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, timezone, locale, onboarding_completed')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Profile fetch failed:', error.message);
    return null;
  }

  return data;
}

export async function syncProfileTimezone(userId: string, timezone = getBrowserTimezone()): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data || data.timezone === timezone) return;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ timezone, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    console.warn('Profile timezone sync failed:', updateError.message);
  }
}

export async function ensureProfile(userId: string, email?: string | null): Promise<UserProfile | null> {
  const timezone = getBrowserTimezone();
  const existing = await fetchProfile(userId);
  if (existing) {
    await syncProfileTimezone(userId, timezone);
    if (existing.timezone === timezone) return existing;
    return { ...existing, timezone };
  }

  const displayName = deriveNameFromEmail(email);
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: displayName,
      timezone,
      onboarding_completed: Boolean(displayName),
    })
    .select('id, display_name, timezone, locale, onboarding_completed')
    .single();

  if (error) {
    console.warn('Profile upsert failed:', error.message);
    return null;
  }

  return data;
}

export async function updateDisplayName(userId: string, displayName: string): Promise<UserProfile | null> {
  const trimmed = displayName.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: trimmed,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .select('id, display_name, timezone, locale, onboarding_completed')
    .single();

  if (error) throw error;
  return data;
}
