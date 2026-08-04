import { supabase } from '../supabaseClient';
import type { UserProfile } from '../types/experience';
import { deriveNameFromEmail } from '../utils/experience';

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

export async function ensureProfile(userId: string, email?: string | null): Promise<UserProfile | null> {
  const existing = await fetchProfile(userId);
  if (existing) return existing;

  const displayName = deriveNameFromEmail(email);
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      display_name: displayName,
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
