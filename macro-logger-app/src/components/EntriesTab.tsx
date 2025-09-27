import React from 'react';

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
}

const EntriesTab: React.FC<EntriesTabProps> = ({
  entries,
  dailyTotals,
  onEditEntry,
  onDeleteEntry,
  isActive
}) => {
  return (
    <div 
      className={`
        transition-all duration-300 ease-out
        ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
      `}
    >
      {/* Quick Daily Summary */}
      {entries.length > 0 && (
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-light text-slate-700">{dailyTotals.calories.toFixed(0)}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Cal</div>
              </div>
              <div>
                <div className="text-sm font-light text-stone-700">{dailyTotals.protein.toFixed(1)}g</div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Protein</div>
              </div>
              <div>
                <div className="text-sm font-light text-stone-700">{dailyTotals.carbs.toFixed(1)}g</div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Carbs</div>
              </div>
              <div>
                <div className="text-sm font-light text-stone-700">{dailyTotals.fats.toFixed(1)}g</div>
                <div className="text-xs text-stone-500 uppercase tracking-wide">Fats</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="text-center py-16">
          <div className="text-stone-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-stone-700 mb-2">No entries yet</h3>
          <p className="text-sm text-stone-500 mb-6 max-w-xs mx-auto">
            Start logging your meals to track your daily nutrition
          </p>
          <div className="space-y-3">
            <p className="text-xs text-stone-500">Go to the "Log" tab to add your first meal</p>
          </div>
        </div>
      )}

      {/* Food Entries List */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-stone-700 mb-3">
            Today's Entries ({entries.length})
          </h3>
          
          <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="divide-y divide-stone-50">
              {entries.map((entry, index) => (
                <div 
                  key={entry.id} 
                  className="flex items-center justify-between p-4 transition-all duration-200"
                >
                  <div className="flex-1 mr-4">
                    <p className="font-medium text-stone-900 capitalize leading-tight">
                      {entry.food_name}
                    </p>
                    <div className="flex items-center space-x-3 mt-1 text-sm text-stone-500">
                      <span>{new Date(entry.created_at).toLocaleTimeString([], { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}</span>
                      <span>×{entry.quantity}</span>
                      <span>{(entry.calories * entry.quantity).toFixed(0)} cal</span>
                      {(entry.protein ?? 0) > 0 && (
                        <span>{((entry.protein ?? 0) * entry.quantity).toFixed(1)}g protein</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => onEditEntry(entry)}
                      className="p-2 text-stone-400 hover:text-slate-700 hover:bg-stone-100 rounded-full transition-all duration-200"
                      aria-label={`Edit ${entry.food_name}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button 
                      onClick={() => onDeleteEntry(entry.id)}
                      className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
                      aria-label={`Delete ${entry.food_name}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EntriesTab;
