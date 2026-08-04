import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { ToastContext } from './toast';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message && (
        <div className="app-toast safe-x" role="status" aria-live="polite">
          <p className="app-toast__text">{message}</p>
        </div>
      )}
    </ToastContext.Provider>
  );
}
