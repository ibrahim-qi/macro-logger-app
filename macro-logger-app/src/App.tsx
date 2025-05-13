import React, { useState, useEffect } from 'react'; // Removed unused useRef
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
      // setLoading(false); // Potentially set loading false here too if initial was null
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Session state will be updated by the onAuthStateChange listener
  };

  // Display a simple loading text while session is being determined
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      {!session ? (
        // Auth UI centered
        <div className="flex items-center justify-center min-h-screen px-4 bg-gray-100">
          <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-xl">
            <h2 className="text-3xl font-bold text-center text-gray-900">Macro Logger</h2>
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#2563EB', // Tailwind blue-600
                      brandAccent: '#1D4ED8', // Tailwind blue-700 (for hover)
                      // You could also customize other colors like input backgrounds, borders, text, etc.
                      // For example:
                      // brandButtonText: 'white',
                      // defaultButtonBackground: '#E0E0E0',
                      // defaultButtonBackgroundHover: '#D1D1D1',
                    }
                  }
                }
              }}
              providers={[]}
              theme="light" // Keep the overall theme light, we're just changing accents
            />
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
