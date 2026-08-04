import React from 'react';
import { SahhaMark } from './SahhaBrand';

interface LoadingStateProps {
  label?: string;
  sublabel?: string;
  compact?: boolean;
  showMark?: boolean;
  showTrust?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'One moment',
  sublabel,
  compact = false,
  showMark = true,
  showTrust = false,
}) => (
  <div
    className={`loading-state ${compact ? 'loading-state--compact' : ''}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    {showMark ? (
      <div className="loading-state__pulse">
        <SahhaMark className="brand-mark--header-md loading-state__mark" glow />
      </div>
    ) : (
      <div className="spinner spinner--sm" aria-hidden="true" />
    )}
    <p className="loading-state__label">{label}</p>
    {sublabel && <p className="loading-state__sublabel">{sublabel}</p>}
    {showTrust && (
      <span className="trust-badge">Review before logging</span>
    )}
  </div>
);

export default LoadingState;
