import React from 'react';
import TrendIndicator from './TrendIndicator';

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface MacroStatGridProps {
  values: MacroTotals;
  previousValues?: MacroTotals | null;
  size?: 'sm' | 'md' | 'lg';
  showTrend?: boolean;
}

const MacroStatGrid: React.FC<MacroStatGridProps> = ({
  values,
  previousValues = null,
  size = 'md',
  showTrend = false,
}) => {
  const valueClass = size === 'lg' ? 'macro-stat__value macro-stat__value--lg' : size === 'sm' ? 'macro-stat__value macro-stat__value--sm' : 'macro-stat__value';

  const items = [
    { key: 'calories' as const, label: 'Cal', display: Math.round(values.calories).toLocaleString(), macroClass: 'macro-stat--calories' },
    { key: 'protein' as const, label: 'Protein', display: `${Math.round(values.protein).toLocaleString()}g`, macroClass: 'macro-stat--protein' },
    { key: 'carbs' as const, label: 'Carbs', display: `${Math.round(values.carbs).toLocaleString()}g`, macroClass: 'macro-stat--carbs' },
    { key: 'fats' as const, label: 'Fats', display: `${Math.round(values.fats).toLocaleString()}g`, macroClass: 'macro-stat--fats' },
  ];

  return (
    <div className="macro-stat-grid">
      {items.map(({ key, label, display, macroClass }) => (
        <div key={key} className={`macro-stat ${macroClass}`}>
          <div className={valueClass}>{display}</div>
          <div className="macro-stat__label">{label}</div>
          {showTrend && previousValues && (
            <TrendIndicator value={values[key]} previousValue={previousValues[key]} />
          )}
        </div>
      ))}
    </div>
  );
};

export default MacroStatGrid;
