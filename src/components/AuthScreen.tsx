import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

type AuthMode = 'sign_in' | 'sign_up' | 'forgot';

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const resetFeedback = () => setMessage(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Reset link sent — check your email.' });
        return;
      }

      if (mode === 'sign_up') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: firstName.trim() || null,
            },
          },
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Account created.' });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    resetFeedback();
    setMode(next);
  };

  return (
    <div className="auth-panel">
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
          className="input-premium auth-input"
        />

        {mode === 'sign_up' && (
          <input
            id="auth-first-name"
            type="text"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            aria-label="First name"
            className="input-premium auth-input"
          />
        )}

        {mode !== 'forgot' && (
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className="input-premium auth-input"
          />
        )}

        {message && (
          <p className={`auth-message auth-message--${message.type}`}>{message.text}</p>
        )}

        <button type="submit" disabled={loading} className="auth-submit">
          {loading
            ? 'Please wait…'
            : mode === 'sign_in'
              ? 'Sign in'
              : mode === 'sign_up'
                ? 'Create account'
                : 'Send reset link'}
        </button>
      </form>

      <div className="auth-footer">
        <p className="auth-footer-text auth-footer-text--trust">
          Private by default — you review every meal before it&apos;s saved.
        </p>
        {mode === 'sign_in' && (
          <>
            <button type="button" onClick={() => switchMode('forgot')} className="auth-link">
              Forgot password
            </button>
            <p className="auth-footer-text">
              New here?{' '}
              <button type="button" onClick={() => switchMode('sign_up')} className="auth-link auth-link--accent">
                Create account
              </button>
            </p>
          </>
        )}
        {mode === 'sign_up' && (
          <p className="auth-footer-text">
            Have an account?{' '}
            <button type="button" onClick={() => switchMode('sign_in')} className="auth-link auth-link--accent">
              Sign in
            </button>
          </p>
        )}
        {mode === 'forgot' && (
          <button type="button" onClick={() => switchMode('sign_in')} className="auth-link auth-link--accent">
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;
