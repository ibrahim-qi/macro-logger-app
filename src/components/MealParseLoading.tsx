import React from 'react';
import { SahhaMark } from './SahhaBrand';

interface MealParseLoadingProps {
  transcript: string | null;
  exiting?: boolean;
}

const MealParseLoading: React.FC<MealParseLoadingProps> = ({
  transcript,
  exiting = false,
}) => {
  const hasTranscript = Boolean(transcript?.trim());

  return (
    <div
      className={`parse-minimal ${exiting ? 'parse-minimal--out' : ''}`}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="parse-minimal__orb">
        <SahhaMark className="brand-mark--header-md parse-minimal__mark" glow />
      </div>

      {hasTranscript ? (
        <p className="parse-minimal__quote">&ldquo;{transcript}&rdquo;</p>
      ) : (
        <div className="parse-minimal__line" aria-hidden="true" />
      )}
    </div>
  );
};

export default MealParseLoading;
