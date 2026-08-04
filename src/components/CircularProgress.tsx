import React from 'react';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  value: string;
  color?: 'protein' | 'carbs' | 'fats' | 'calories';
  className?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  size = 120,
  strokeWidth = 7,
  label,
  value,
  color = 'calories',
  className = '',
}) => {
  const normalizedPercentage = Math.min(Math.max(percentage, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedPercentage / 100) * circumference;

  const colorSchemes = {
    calories: {
      primary: 'var(--color-accent-strong)',
      secondary: 'var(--color-accent-glow)',
    },
    protein: {
      primary: 'var(--color-protein)',
      secondary: 'rgba(232, 146, 138, 0.14)',
    },
    carbs: {
      primary: 'var(--color-carbs)',
      secondary: 'rgba(232, 192, 104, 0.14)',
    },
    fats: {
      primary: 'var(--color-fats)',
      secondary: 'rgba(139, 164, 188, 0.14)',
    },
  };

  const colors = colorSchemes[color];
  const overGoal = normalizedPercentage >= 100;
  const valueClass = size <= 80 ? 'text-sm' : 'text-xl';
  const pctClass = size <= 80 ? 'type-meta' : 'meta-label';

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.secondary}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={overGoal ? 'var(--color-danger)' : colors.primary}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`${valueClass} font-bold leading-none ${overGoal ? 'text-danger' : 'text-[var(--color-text-primary)]'}`}>
            {value}
          </div>
          <div className={`${pctClass} mt-1`}>
            {Math.round(normalizedPercentage)}%
          </div>
        </div>
      </div>
      <div className="mt-2.5 text-center">
        <div className="meta-label">{label}</div>
      </div>
    </div>
  );
};

export default CircularProgress;
