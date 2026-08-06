import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { supabase } from './supabaseClient';
import MainLayout from './layouts/MainLayout';
import LogPage from './pages/LogPage';
import FoodEntryList from './components/FoodEntryList';
import SummaryDisplay from './components/SummaryDisplay';
import SahhaBrand, { SahhaMark } from './components/SahhaBrand';
import AuthScreen from './components/AuthScreen';
import LoadingState from './components/LoadingState';
import OnboardingWizard from './components/OnboardingWizard';
import { SAHHA_TAGLINE, getBootLoadingLabel, getBootLoadingSublabel } from './copy/experience';
import { UserExperienceProvider } from './context/UserExperienceContext';
import { useUserExperience } from './context/userExperience';
import { ToastProvider } from './context/ToastContext';

const AUTH_BEATS = ['Speak naturally', 'Review with confidence', 'Logged in seconds'] as const;

function AuthenticatedApp({
  session,
  handleLogout,
}: {
  session: Session;
  handleLogout: () => void;
}) {
  const {
    needsName,
    needsGoals,
    needsMicIntro,
    setDisplayName,
    refresh,
    completeMicIntro,
  } = useUserExperience();

  return (
    <>
      <Routes>
        <Route path="/*" element={<MainLayout session={session} handleLogout={handleLogout} />}>
          <Route index element={<FoodEntryList session={session} />} />
          <Route path="log" element={<LogPage session={session} />} />
          <Route path="today" element={<Navigate to="/" replace />} />
          <Route path="summary" element={<SummaryDisplay session={session} />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Route>
      </Routes>
      <OnboardingWizard
        session={session}
        needsName={needsName}
        needsGoals={needsGoals}
        needsMicIntro={needsMicIntro}
        onSaveName={setDisplayName}
        onGoalsComplete={refresh}
        onMicComplete={completeMicIntro}
      />
    </>
  );
}

function AuthPreview() {
  const [beatIndex, setBeatIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBeatIndex((index) => (index + 1) % AUTH_BEATS.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-preview__orb">
        <span className="auth-preview__ring" />
        <SahhaMark className="brand-mark--hero-lg auth-preview__mark" glow />
      </div>
      <p key={AUTH_BEATS[beatIndex]} className="auth-preview__beat">
        {AUTH_BEATS[beatIndex]}
      </p>
    </div>
  );
}

function AppShell({
  session,
  loading,
  handleLogout,
}: {
  session: Session | null;
  loading: boolean;
  handleLogout: () => void;
}) {
  if (loading) {
    return (
      <div className="app-scroll-view flex items-center justify-center w-full app-bg safe-x">
        <div className="app-container py-8">
          <LoadingState label={getBootLoadingLabel()} sublabel={getBootLoadingSublabel()} />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-scroll-view flex items-center justify-center w-full auth-bg safe-top safe-bottom safe-x">
        <div className="app-container auth-page animate-fade-in">
          <AuthPreview />
          <SahhaBrand size="lg" variant="hero" showTagline tagline={SAHHA_TAGLINE} />
          <AuthScreen />
        </div>
      </div>
    );
  }

  return (
    <UserExperienceProvider session={session}>
      <ToastProvider>
        <AuthenticatedApp session={session} handleLogout={handleLogout} />
      </ToastProvider>
    </UserExperienceProvider>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        if (error.message.includes('session missing') || error.message.includes('Auth session missing')) {
          setSession(null);
        }
      }
    } catch {
      setSession(null);
    }
  };

  return (
    <Router>
      <AppShell session={session} loading={loading} handleLogout={handleLogout} />
    </Router>
  );
}

export default App;
