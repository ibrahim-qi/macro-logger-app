import React from 'react';

interface CircularProgressProps {
  percentage: number; // 0-100
  size?: number; // diameter in pixels
  strokeWidth?: number;
  label: string;
  value: string; // display value (e.g., "45g", "1200 cal")
  color?: 'protein' | 'carbs' | 'fats' | 'calories';
  className?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  size = 120,
  strokeWidth = 8,
  label,
  value,
  color = 'calories',
  className = ''
}) => {
  // Ensure percentage is between 0 and 100
  const normalizedPercentage = Math.min(Math.max(percentage, 0), 100);
  
  // Calculate circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (normalizedPercentage / 100) * circumference;

  // Color schemes based on macro type
  const colorSchemes = {
    calories: {
      primary: '#334155', // slate-700 (our main color)
      secondary: '#e2e8f0', // slate-200
      text: '#334155'
    },
    protein: {
      primary: '#dc2626', // red-600 (muscle building)
      secondary: '#fecaca', // red-200
      text: '#dc2626'
    },
    carbs: {
      primary: '#ea580c', // orange-600 (energy)
      secondary: '#fed7aa', // orange-200
      text: '#ea580c'
    },
    fats: {
      primary: '#7c3aed', // violet-600 (essential fats)
      secondary: '#ddd6fe', // violet-200
      text: '#7c3aed'
    }
  };

  const colors = colorSchemes[color];

  // Determine text color based on progress
  const getProgressTextColor = () => {
    if (normalizedPercentage >= 100) return '#dc2626'; // red if over goal
    if (normalizedPercentage >= 80) return '#16a34a'; // green if close to goal
    return colors.text; // default color
  };

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      {/* SVG Circle */}
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.secondary}
            strokeWidth={strokeWidth}
            fill="transparent"
            className="opacity-30"
          />
          
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: normalizedPercentage >= 100 ? 'brightness(0.8)' : 'none'
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div 
            className="text-lg font-semibold leading-none"
            style={{ color: getProgressTextColor() }}
          >
            {value}
          </div>
          <div className="text-xs text-stone-500 mt-1 font-medium">
            {Math.round(normalizedPercentage)}%
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="mt-2 text-center">
        <div className="text-xs font-medium text-stone-700 uppercase tracking-wide">
          {label}
        </div>
      </div>
    </div>
  );
};

export default CircularProgress;
