import React from 'react';

interface TrendIndicatorProps {
  value: number;
  previousValue: number;
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({ value, previousValue }) => {
  const percentChange = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0;
  const isUp = percentChange > 5;
  const isDown = percentChange < -5;

  if ((!isUp && !isDown) || previousValue === 0) return null;

  return (
    <div className="flex items-center justify-center mt-1">
      <div className={`trend-indicator ${isUp ? 'trend-indicator--up' : 'trend-indicator--down'}`}>
        {isUp ? (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {Math.abs(percentChange).toFixed(0)}%
      </div>
    </div>
  );
};

export default TrendIndicator;
