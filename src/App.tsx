import { useState, useEffect } from 'react'; // Removed unused useRef and default React import
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import MainLayout from './layouts/MainLayout'; // Import the layout
import LogPage from './pages/LogPage'; // Import the new page component for logging
import FoodEntryList from './components/FoodEntryList';
import SummaryDisplay from './components/SummaryDisplay';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true); // Added loading state

  useEffect(() => {
    setLoading(true); // Set loading true at the start of effect
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false); // Set loading false after session is fetched
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
        // Handle session missing error by manually clearing session
        if (error.message.includes('session missing') || error.message.includes('Auth session missing')) {
          setSession(null);
        }
      }
    } catch (err) {
      // Fallback: manually clear session if signOut fails
      setSession(null);
    }
  };

  // Display a simple loading text while session is being determined
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <p className="text-lg text-stone-600">Loading...</p>
      </div>
    );
  }

  return (
    <Router basename="/macro-logger">
      {!session ? (
        // Enhanced Auth UI - matching app design system
        <div className="flex items-center justify-center min-h-screen px-4 bg-stone-50">
          <div className="w-full max-w-md">
            {/* Header Card */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-8 mb-6">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-semibold text-slate-700 tracking-tight">Macro Logger</h1>
                <p className="text-sm text-stone-500">Track your nutrition with ease</p>
              </div>
            </div>
            
            {/* Auth Card */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6">
              <Auth
                supabaseClient={supabase}
                appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: {
                        brand: '#334155', // Our navy slate-700
                        brandAccent: '#1e293b', // Darker navy slate-800 for hover
                        brandButtonText: 'white',
                        defaultButtonBackground: '#f8fafc',
                        defaultButtonBackgroundHover: '#f1f5f9',
                        defaultButtonBorder: '#e2e8f0',
                        defaultButtonText: '#334155',
                        dividerBackground: '#e7e5e4', // stone-200
                        inputBackground: '#fafaf9', // stone-50
                        inputBorder: '#e7e5e4', // stone-200
                        inputBorderFocus: '#334155', // slate-700
                        inputText: '#292524', // stone-800
                        inputLabelText: '#57534e', // stone-600
                        inputPlaceholder: '#a8a29e', // stone-400
                      },
                      space: {
                        spaceSmall: '4px',
                        spaceMedium: '8px',
                        spaceLarge: '16px',
                        labelBottomMargin: '8px',
                        anchorBottomMargin: '4px',
                        emailInputSpacing: '4px',
                        socialAuthSpacing: '4px',
                        buttonPadding: '10px 15px',
                        inputPadding: '10px 15px',
                      },
                      fontSizes: {
                        baseBodySize: '14px',
                        baseInputSize: '14px',
                        baseLabelSize: '14px',
                        baseButtonSize: '14px',
                      },
                      borderWidths: {
                        buttonBorderWidth: '1px',
                        inputBorderWidth: '1px',
                      },
                      radii: {
                        borderRadiusButton: '8px',
                        buttonBorderRadius: '8px',
                        inputBorderRadius: '8px',
                      }
                    }
                  }
                }}
                providers={[]}
                theme="light"
              />
            </div>
          </div>
        </div>
      ) : (
        // Logged-in state: Render the layout with routes
        <Routes>
          <Route path="/*" element={<MainLayout session={session} handleLogout={handleLogout} />}>
            {/* Nested routes render inside MainLayout's <Outlet /> */}
            <Route index element={<LogPage session={session} />} /> {/* Default route */}
            <Route path="today" element={<FoodEntryList session={session} />} />
            <Route path="summary" element={<SummaryDisplay session={session} />} />
            {/* Optional: Redirect any unknown nested paths back to the layout's default (index) */}
            {/* This assumes MainLayout is handling the base path correctly */}
            <Route path="*" element={<Navigate to="." replace />} /> 
          </Route>
        </Routes>
      )}
    </Router>
  );
}

export default App;
