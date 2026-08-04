import React from 'react';

interface MacroLineProps {
  protein: number;
  carbs: number;
  fats: number;
  className?: string;
}

const MacroLine: React.FC<MacroLineProps> = ({ protein, carbs, fats, className = '' }) => (
  <span className={`meal-review-macro-line ${className}`.trim()}>
    {Math.round(protein)}P · {Math.round(carbs)}C · {Math.round(fats)}F
  </span>
);

export default MacroLine;
