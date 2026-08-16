import React from 'react';

interface MacroLineProps {
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  className?: string;
}

function formatMacro(value: number | null, suffix: string): string {
  return value != null ? `${Math.round(value)}${suffix}` : `—${suffix}`;
}

const MacroLine: React.FC<MacroLineProps> = ({ protein, carbs, fats, className = '' }) => (
  <span className={`meal-review-macro-line ${className}`.trim()}>
    {formatMacro(protein, 'P')} · {formatMacro(carbs, 'C')} · {formatMacro(fats, 'F')}
  </span>
);

export default MacroLine;
