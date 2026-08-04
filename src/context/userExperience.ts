import { createContext, useContext } from 'react';
import type { ExperienceContext, UserProfile } from '../types/experience';

export interface UserExperienceValue {
  profile: UserProfile | null;
  timezone: string;
  experience: ExperienceContext;
  loading: boolean;
  needsName: boolean;
  needsGoals: boolean;
  needsMicIntro: boolean;
  refresh: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  completeMicIntro: () => void;
}

export const UserExperienceContext = createContext<UserExperienceValue | null>(null);

export function useUserExperience(): UserExperienceValue {
  const context = useContext(UserExperienceContext);
  if (!context) {
    throw new Error('useUserExperience must be used within UserExperienceProvider');
  }
  return context;
}
