import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SahhaMark } from './SahhaBrand';
import MacroStatGrid from './MacroStatGrid';
import { getEmptyStateBody, getEmptyStateCta, getEmptyStateTitle } from '../copy/experience';
import { useUserExperience } from '../context/userExperience';
import { getMealPeriod } from '../utils/mealTotals';

interface FoodEntry {
  id: number;
  created_at: string;
  food_name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  quantity: number;
}

interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface EntriesTabProps {
  entries: FoodEntry[];
  dailyTotals: DailyTotals;
  onEditEntry: (entry: FoodEntry) => void;
  onDeleteEntry: (id: number) => void;
  isActive: boolean;
  showDayTotals?: boolean;
  highlightLoggedAfter?: number | null;
}

const periodClass: Record<string, string> = {
  Breakfast: 'entry-card--breakfast',
  Lunch: 'entry-card--lunch',
  Snack: 'entry-card--snack',
  Dinner: 'entry-card--dinner',
};

const EntriesTab: React.FC<EntriesTabProps> = ({
  entries, dailyTotals, onEditEntry, onDeleteEntry, isActive, showDayTotals = true,
  highlightLoggedAfter = null,
}) => {
  const { experience } = useUserExperience();

  const grouped = useMemo(() => {
    const groups = new Map<string, FoodEntry[]>();
    for (const entry of entries) {
      const period = getMealPeriod(new Date(entry.created_at));
      const list = groups.get(period) ?? [];
      list.push(entry);
      groups.set(period, list);
    }
    const order = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
    return order
      .filter((p) => groups.has(p))
      .map((period) => ({ period, items: groups.get(period)! }));
  }, [entries]);

  return (
    <div className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {entries.length > 0 && showDayTotals && (
        <div className="card p-4 mb-5">
          <p className="section-label mb-3">Day totals</p>
          <MacroStatGrid
            size="sm"
            values={{
              calories: dailyTotals.calories,
              protein: dailyTotals.protein,
              carbs: dailyTotals.carbs,
              fats: dailyTotals.fats,
            }}
          />
        </div>
      )}

      {entries.length === 0 && (
        <div className="empty-panel">
          <div className="empty-panel__mark">
            <SahhaMark className="brand-mark--hero-sm" glow />
          </div>
          <h3 className="empty-panel__title">{getEmptyStateTitle(experience)}</h3>
          <p className="empty-panel__body">{getEmptyStateBody(experience)}</p>
          <Link to="/log" className="btn-primary max-w-[14rem] mx-auto">
            {getEmptyStateCta(experience)}
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <div className="entry-feed">
          {grouped.map(({ period, items }) => (
            <div key={period}>
              <p className="entry-group__label">{period}</p>
              <div className="space-y-2">
                {items.map((entry) => {
                  const isJustLogged = highlightLoggedAfter !== null
                    && new Date(entry.created_at).getTime() >= highlightLoggedAfter;
                  return (
                  <article
                    key={entry.id}
                    className={`entry-card ${periodClass[period] ?? ''}${isJustLogged ? ' entry-card--just-logged' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="entry-card__name">{entry.food_name}</p>
                      <div className="entry-card__meta">
                        <span className="type-meta">
                          {new Date(entry.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className="macro-pill macro-pill--calories">
                          {(entry.calories * entry.quantity).toFixed(0)} cal
                        </span>
                        {entry.quantity !== 1 && (
                          <span className="macro-pill macro-pill--neutral">×{entry.quantity}</span>
                        )}
                      </div>
                    </div>
                    <div className="entry-card__actions">
                      <button
                        type="button"
                        onClick={() => onEditEntry(entry)}
                        className="entry-card__action"
                        aria-label="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        className="entry-card__action entry-card__action--danger"
                        aria-label="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EntriesTab;
